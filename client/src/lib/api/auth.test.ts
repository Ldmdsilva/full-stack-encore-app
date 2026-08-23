import { describe, expect, it } from 'vitest'
import { setToken } from '../tokenStore'
import * as authApi from './auth'

describe('auth api', () => {
  it('registers a new account', async () => {
    const { user, token } = await authApi.register({
      name: 'New User',
      email: 'newuser@example.com',
      password: 'password123',
      phone: '0771234567',
    })
    expect(user.email).toBeTruthy()
    expect(token).toBeTruthy()
  })

  it('rejects a duplicate email on register', async () => {
    await expect(
      authApi.register({ name: 'Dup', email: 'taken@example.com', password: 'password123', phone: '0771234567' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_EMAIL' })
  })

  it('logs in with valid credentials', async () => {
    const { user, token } = await authApi.login({ email: 'alex@example.com', password: 'Password123' })
    expect(user.email).toBe('alex@example.com')
    expect(token).toBeTruthy()
  })

  it('updates the current user profile', async () => {
    setToken('test-token')
    const { user } = await authApi.updateMe({ name: 'Updated Name' })
    expect(user.name).toBe('Updated Name')
  })

  it('deletes the current user account', async () => {
    setToken('test-token')
    await expect(authApi.deleteMe()).resolves.toBeUndefined()
  })
})
