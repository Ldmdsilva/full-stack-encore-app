import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { AppError } from '../middleware/errorHandler.js';

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
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function register({ name, email, password }) {
  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are required', 400, 'VALIDATION_ERROR');
  }

  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters long', 400, 'VALIDATION_ERROR', {
      field: 'password',
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
    role: 'customer',
  });

  const token = generateToken(user);

  return {
    user: user.toJSON(),
    token,
  };
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

  return {
    user: user.toJSON(),
    token,
  };
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
  return user.toJSON();
}

/**
 * Update user profile (FR-5)
 * @param {string} userId
 * @param {object} updates
 * @param {string} [updates.name]
 * @param {string} [updates.email]
 * @returns {Promise<object>}
 */
export async function updateUserProfile(userId, { name, email }) {
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

  const user = await User.findByIdAndUpdate(userId, updates, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  return user.toJSON();
}

/**
 * Delete user account and anonymize existing bookings (FR-6)
 * @param {string} userId
 */
export async function deleteUserAccount(userId) {
  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Anonymize user reference on existing bookings
  await Booking.updateMany({ userRef: userId }, { status: 'cancelled' });
}
