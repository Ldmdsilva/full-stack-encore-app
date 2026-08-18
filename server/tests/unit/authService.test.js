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
    });

    expect(result).toHaveProperty('token');
    expect(result.user).toHaveProperty('_id');
    expect(result.user.name).toBe('John Fan');
    expect(result.user.email).toBe('john@example.com');
    expect(result.user.role).toBe('customer');
    expect(result.user).not.toHaveProperty('passwordHash');

    // Assert stored password in database is hashed with bcrypt (NFR-3)
    const storedUser = await User.findById(result.user._id).select('+passwordHash');
    expect(storedUser.passwordHash).toBeDefined();
    expect(storedUser.passwordHash).not.toBe('password123');
    expect(storedUser.passwordHash.startsWith('$2')).toBe(true);
  });

  it('FR-1: should reject registration if email is already registered (409 Conflict)', async () => {
    await authService.register({
      name: 'User One',
      email: 'duplicate@example.com',
      password: 'password123',
    });

    await expect(
      authService.register({
        name: 'User Two',
        email: 'duplicate@example.com',
        password: 'password456',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_EMAIL',
    });
  });

  it('FR-2: should successfully authenticate valid credentials and return token', async () => {
    await authService.register({
      name: 'Valid User',
      email: 'valid@example.com',
      password: 'secretPassword1',
    });

    const loginResult = await authService.login({
      email: 'valid@example.com',
      password: 'secretPassword1',
    });

    expect(loginResult).toHaveProperty('token');
    expect(loginResult.user.email).toBe('valid@example.com');
  });

  it('FR-2: should reject invalid password with 401 and generic message', async () => {
    await authService.register({
      name: 'Valid User',
      email: 'valid2@example.com',
      password: 'secretPassword1',
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
