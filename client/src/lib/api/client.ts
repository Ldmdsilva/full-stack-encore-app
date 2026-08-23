import axios from 'axios'
import { getToken, setToken } from '../tokenStore'
import { parseApiError } from './errors'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = parseApiError(error)

    // Client guards are UX only — the server authorises every write. This
    // interceptor just reacts to a 401 the server already enforced.
    if (
      (apiError.code === 'UNAUTHORIZED' || apiError.code === 'TOKEN_EXPIRED' || apiError.code === 'INVALID_TOKEN') &&
      typeof window !== 'undefined'
    ) {
      setToken(null)
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }

    return Promise.reject(apiError)
  },
)

/**
 * Retry a GET request up to 3 times with exponential backoff. Never used
 * for writes — POST /bookings in particular must never be retried (§C7.3),
 * since a retried hold attempt could double-charge the seat guard's 409
 * semantics or create a duplicate Stripe session.
 */
export async function getWithRetry<T>(url: string, config?: Parameters<typeof apiClient.get>[1], attempt = 0): Promise<T> {
  try {
    const response = await apiClient.get<T>(url, config)
    return response.data
  } catch (error) {
    if (attempt >= 2) throw error
    const delayMs = 300 * 2 ** attempt
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return getWithRetry<T>(url, config, attempt + 1)
  }
}
