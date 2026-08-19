import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import { AppError } from '../middleware/errorHandler.js';
import { normaliseLk } from '../utils/phone.js';
import { notifyWelcome } from './notification/notificationService.js';
import { refundPayment } from './paymentService.js';
import { broadcastSeatUpdate } from '../sockets/seatSocketGateway.js';
import { logger } from '../config/logger.js';

/**
 * Generate signed JWT token
 * @param {object} user - User document
 * @returns {string} Signed JWT
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    }
  );
}

/**
 * Register a new user account (FR-1)
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} params.phone
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function register({ name, email, password, phone }) {
  if (!name || !email || !password || !phone) {
    throw new AppError('Name, email, password, and phone are required', 400, 'VALIDATION_ERROR');
  }

  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters long', 400, 'VALIDATION_ERROR', {
      field: 'password',
    });
  }

  const normalizedPhone = normaliseLk(phone);
  if (!normalizedPhone) {
    throw new AppError('Phone must be a valid Sri Lankan mobile number', 400, 'VALIDATION_ERROR', {
      field: 'phone',
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new AppError('An account with this email already exists', 409, 'DUPLICATE_EMAIL', {
      email: normalizedEmail,
    });
  }

  // Hash password using bcrypt (cost factor 10, NFR-3)
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    phone: normalizedPhone,
    role: 'customer',
  });

  const token = generateToken(user);

  notifyWelcome(user);

  return { user, token };
}

/**
 * Authenticate existing user and issue token (FR-2)
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user) {
    // Return generic 401 with no detail on which field failed (FR-2)
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const token = generateToken(user);

  return { user, token };
}

/**
 * Get user profile by ID (FR-5)
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getUserProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  return user;
}

/**
 * Update user profile (FR-5)
 * @param {string} userId
 * @param {object} updates
 * @param {string} [updates.name]
 * @param {string} [updates.email]
 * @param {string} [updates.phone]
 * @returns {Promise<object>}
 */
export async function updateUserProfile(userId, { name, email, phone }) {
  const updates = {};
  if (name) updates.name = name.trim();
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
    if (existing) {
      throw new AppError('Email is already in use by another account', 409, 'DUPLICATE_EMAIL');
    }
    updates.email = normalizedEmail;
  }
  if (phone) {
    const normalizedPhone = normaliseLk(phone);
    if (!normalizedPhone) {
      throw new AppError('Phone must be a valid Sri Lankan mobile number', 400, 'VALIDATION_ERROR', {
        field: 'phone',
      });
    }
    updates.phone = normalizedPhone;
  }

  const user = await User.findByIdAndUpdate(userId, updates, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  return user;
}

/**
 * Delete a user account (FR-6). Releases seats and refunds any confirmed
 * bookings, then anonymises the account in place rather than hard-deleting
 * it — a hard delete would leave existing bookings' `userRef` dangling.
 * @param {string} userId
 */
export async function deleteUserAccount(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const activeBookings = await Booking.find({ userRef: userId, status: { $in: ['pending', 'confirmed'] } });

  for (const booking of activeBookings) {
    if (booking.status === 'confirmed' && booking.payment?.paymentIntentId) {
      try {
        const refund = await refundPayment(booking.payment.paymentIntentId);
        booking.payment.refundId = refund.id;
      } catch (error) {
        logger.error({ err: error, reference: booking.reference }, '[AuthService] Refund failed during account deletion');
      }
    }

    const seatIds = booking.seats.map((seat) => seat.id);
    await Event.updateOne(
      { _id: booking.eventRef },
      { $set: { 'seats.$[elem].status': 'available' } },
      { arrayFilters: [{ 'elem.id': { $in: seatIds } }] }
    );
    broadcastSeatUpdate(booking.eventRef.toString(), seatIds, 'available');

    booking.status = 'cancelled';
    booking.holdExpiresAt = undefined;
    await booking.save();
  }

  user.name = 'Deleted user';
  user.email = `deleted-${user._id}@encore.invalid`;
  user.phone = '94100000000';
  user.passwordHash = await bcrypt.hash(randomUUID(), 10);
  await user.save();
}
