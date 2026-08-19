import * as authService from '../services/authService.js';
import { serializeUser } from '../serializers/userSerializer.js';

export async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;
    const { user, token } = await authService.register({ name, email, password, phone });
    return res.status(201).json({ user: serializeUser(user), token });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login({ email, password });
    return res.status(200).json({ user: serializeUser(user), token });
  } catch (error) {
    next(error);
  }
}
