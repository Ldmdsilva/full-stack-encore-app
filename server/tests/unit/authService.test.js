import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import * as authService from '../../src/services/authService.js';
import User from '../../src/models/User.js';

describe('authService Unit Tests (§D4.1)', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('FR-1: should successfully register a new customer and return JWT token', async () => {
    const result = await authService.register({
      name: 'John Fan',
      email: 'john@example.com',
      password: 'password123',
      phone: '0771234567',
    });

    expect(result).toHaveProperty('token');
    // `result.user` here is the raw Mongoose document (service layer, not
    // the controller/serializer boundary) — mongoose's default `id` virtual
    // already exposes the string form alongside `_id`.
    expect(result.user.id).toBe(result.user._id.toString());
    expect(result.user.name).toBe('John Fan');
    expect(result.user.email).toBe('john@example.com');
    expect(result.user.role).toBe('customer');
    // Phone is normalised to the bare 94XXXXXXXXX form for notify.lk
    expect(result.user.phone).toBe('94771234567');

    // `select: false` governs the default query projection, not the shape of
    // an in-memory document returned straight from .create() — so assert the
    // guarantee where it actually applies: a default find does not surface a
    // value for it. (Mongoose documents always expose a getter for every
    // schema path, so `toHaveProperty` reports the key as "present" even when
    // excluded — checking the resolved value is the reliable assertion.)
    const defaultProjectionUser = await User.findById(result.user.id);
    expect(defaultProjectionUser.passwordHash).toBeUndefined();

    // Assert stored password in database is hashed with bcrypt (NFR-3)
    const storedUser = await User.findById(result.user.id).select('+passwordHash');
    expect(storedUser.passwordHash).toBeDefined();
    expect(storedUser.passwordHash).not.toBe('password123');
    expect(storedUser.passwordHash.startsWith('$2')).toBe(true);
  });

  it('FR-1: should reject registration if email is already registered (409 Conflict)', async () => {
    await authService.register({
      name: 'User One',
      email: 'duplicate@example.com',
      password: 'password123',
      phone: '0771234567',
    });

    await expect(
      authService.register({
        name: 'User Two',
        email: 'duplicate@example.com',
        password: 'password456',
        phone: '0777654321',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_EMAIL',
    });
  });

  it('FR-1: should reject registration with a missing phone (400 VALIDATION_ERROR)', async () => {
    await expect(
      authService.register({
        name: 'No Phone',
        email: 'nophone@example.com',
        password: 'password123',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('FR-1: should reject registration with an invalid/unnormalisable phone (400 VALIDATION_ERROR)', async () => {
    await expect(
      authService.register({
        name: 'Bad Phone',
        email: 'badphone@example.com',
        password: 'password123',
        phone: '12345', // too short to be a valid LK mobile number
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('FR-2: should successfully authenticate valid credentials and return token', async () => {
    await authService.register({
      name: 'Valid User',
      email: 'valid@example.com',
      password: 'secretPassword1',
      phone: '0771234567',
    });

    const loginResult = await authService.login({
      email: 'valid@example.com',
      password: 'secretPassword1',
    });

    expect(loginResult).toHaveProperty('token');
    expect(loginResult.user).toHaveProperty('id');
    expect(loginResult.user.email).toBe('valid@example.com');
  });

  it('FR-2: should reject invalid password with 401 and generic message', async () => {
    await authService.register({
      name: 'Valid User',
      email: 'valid2@example.com',
      password: 'secretPassword1',
      phone: '0771234567',
    });

    await expect(
      authService.login({
        email: 'valid2@example.com',
        password: 'wrongPassword',
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });
});
