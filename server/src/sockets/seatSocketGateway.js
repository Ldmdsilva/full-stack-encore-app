import { getIO } from '../config/socket.js';

/**
 * Register socket event listeners and room management (§C7.2, ADR-003)
 * @param {import('socket.io').Server} io
 */
export function registerSeatSocketGateway(io) {
  io.on('connection', (socket) => {
    // Authenticated sockets auto-join their own booking-update room (§C7.2)
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }

    // Client joins an event's seat room
    socket.on('join:event', ({ eventId }) => {
      if (!eventId) {
        return socket.emit('error', {
          code: 'INVALID_SUBSCRIPTION',
          message: 'eventId is required to join an event room',
        });
      }

      const roomName = `event:${eventId}`;
      socket.join(roomName);
    });

    // Client leaves an event's seat room
    socket.on('leave:event', ({ eventId }) => {
      if (eventId) {
        socket.leave(`event:${eventId}`);
      }
    });

    socket.on('disconnect', () => {
      // Automatic cleanup handled by socket.io
    });
  });
}

/**
 * Broadcast seat updates to all clients in the event room
 * Emitted only AFTER database write commits (§C7.2)
 * @param {string} eventId
 * @param {Array<string>} seatIds
 * @param {'available'|'held'|'booked'} status
 */
export function broadcastSeatUpdate(eventId, seatIds, status) {
  try {
    const io = getIO();
    io.to(`event:${eventId}`).emit('seats:updated', {
      eventId,
      seatIds,
      status,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[Socket] Could not broadcast seat update: ${err.message}`);
    }
  }
}

/**
 * Broadcast event cancellation to all clients in the event room
 * @param {string} eventId
 */
export function broadcastEventCancelled(eventId) {
  try {
    const io = getIO();
    io.to(`event:${eventId}`).emit('event:cancelled', {
      eventId,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[Socket] Could not broadcast event cancellation: ${err.message}`);
    }
  }
}

/**
 * Notify a single user's connected sockets that one of their bookings
 * changed status, e.g. `pending` → `confirmed` after a webhook lands (§C7.2)
 * @param {string} userId
 * @param {{ id: string, status: string }} booking
 */
export function broadcastBookingUpdated(userId, booking) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit('booking:updated', {
      bookingId: booking.id,
      status: booking.status,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[Socket] Could not broadcast booking update: ${err.message}`);
    }
  }
}
