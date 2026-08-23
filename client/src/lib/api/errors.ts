import { isAxiosError } from 'axios'
import type { ApiError, ApiErrorCode } from '../types'

const MESSAGE_BY_CODE: Partial<Record<ApiErrorCode, string>> = {
  SEAT_UNAVAILABLE: 'Those seats were just taken. The map has been updated.',
  DUPLICATE_EMAIL: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  EVENT_INACTIVE: 'This event is no longer open for booking.',
  EVENT_STARTED: 'This event has already started and can no longer be changed.',
  EVENT_NOT_FOUND: 'This event could not be found.',
  VENUE_IN_USE: 'This venue has events booked against it and cannot be deleted.',
  BOOKING_NOT_PENDING: 'This booking is no longer awaiting payment.',
  BOOKING_NOT_CANCELLABLE: 'This booking can no longer be cancelled.',
  TOO_MANY_REQUESTS: 'Too many attempts. Please wait a moment and try again.',
  UNAUTHORIZED: 'Please sign in to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  INVALID_TOKEN: 'Your session is invalid. Please sign in again.',
  FORBIDDEN: "You don't have permission to do that.",
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
  INTERNAL_SERVER_ERROR: 'Something went wrong on our end. Please try again shortly.',
}

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.'

/**
 * Normalise any thrown value from an API call into a consistent ApiError,
 * covering a well-formed error body, a malformed body, no response at all
 * (network failure), and a non-axios throw.
 */
function isAlreadyParsed(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    !(err instanceof Error) &&
    typeof (err as ApiError).code === 'string' &&
    typeof (err as ApiError).message === 'string'
  )
}

export function parseApiError(err: unknown): ApiError {
  // The axios response interceptor already runs every rejection through
  // this function once — pass an already-parsed ApiError straight through
  // instead of collapsing it into a generic error on a second parse.
  if (isAlreadyParsed(err)) {
    return err
  }

  if (isAxiosError(err)) {
    if (!err.response) {
      return { code: 'NETWORK_ERROR', message: MESSAGE_BY_CODE.NETWORK_ERROR! }
    }

    const body = err.response.data as { error?: { code?: string; message?: string; details?: unknown } } | undefined
    const code = (body?.error?.code as ApiErrorCode) || 'INTERNAL_SERVER_ERROR'
    const message = body?.error?.message || MESSAGE_BY_CODE[code] || DEFAULT_MESSAGE

    return { code, message, details: body?.error?.details }
  }

  if (err instanceof Error) {
    return { code: 'INTERNAL_SERVER_ERROR', message: err.message || DEFAULT_MESSAGE }
  }

  return { code: 'INTERNAL_SERVER_ERROR', message: DEFAULT_MESSAGE }
}
