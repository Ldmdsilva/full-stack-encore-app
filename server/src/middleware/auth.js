import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';

/**
 * Middleware to verify JWT token and attach user payload to req.user (FR-3, ADR-005)
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('Authentication token is missing or invalid', 401, 'UNAUTHORIZED')
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id: userId, email: userEmail, role: userRole }
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Authentication token has expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid authentication token', 401, 'INVALID_TOKEN'));
  }
}
