import * as bookingService from '../services/bookingService.js';

export async function createBooking(req, res, next) {
  try {
    const { eventId, seatIds } = req.body;
    const booking = await bookingService.createBooking({
      userId: req.user.id,
      eventId,
      seatIds,
    });
    return res.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
}

export async function cancelBooking(req, res, next) {
  try {
    const booking = await bookingService.cancelBooking({
      userId: req.user.id,
      bookingId: req.params.id,
      role: req.user.role,
    });
    return res.status(200).json({ booking });
  } catch (error) {
    next(error);
  }
}

export async function getMyBookings(req, res, next) {
  try {
    const result = await bookingService.getUserBookings(req.user.id, req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAllBookings(req, res, next) {
  try {
    const result = await bookingService.getAllBookings(req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
