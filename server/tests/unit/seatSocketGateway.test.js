import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { setIO } from '../../src/config/socket.js';
import {
  registerSeatSocketGateway,
  broadcastSeatUpdate,
  broadcastEventCancelled,
  broadcastBookingUpdated,
  broadcastShowtimeSeatsUpdated,
  broadcastShowtimeCancelled,
  broadcastBookingConfirmed,
} from '../../src/sockets/seatSocketGateway.js';

/**
 * A fake socket that records handlers registered via `.on(event, handler)`
 * so tests can invoke them directly, mirroring how the real socket.io
 * server would dispatch an incoming client event.
 */
function createFakeSocket(user = null) {
  const handlers = {};
  return {
    user,
    joinedRooms: [],
    leftRooms: [],
    emitted: [],
    on(event, handler) {
      handlers[event] = handler;
    },
    trigger(event, payload) {
      handlers[event]?.(payload);
    },
    join(room) {
      this.joinedRooms.push(room);
    },
    leave(room) {
      this.leftRooms.push(room);
    },
    emit(event, payload) {
      this.emitted.push({ event, payload });
    },
  };
}

function createFakeIO() {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  return { to, emit };
}

describe('sockets/seatSocketGateway.js', () => {
  describe('registerSeatSocketGateway — connection wiring', () => {
    it('joins the authenticated user room on connection', () => {
      let connectionHandler;
      const io = { on: (event, handler) => { connectionHandler = handler; } };
      registerSeatSocketGateway(io);

      const socket = createFakeSocket({ id: 'user-1' });
      connectionHandler(socket);

      expect(socket.joinedRooms).toContain('user:user-1');
    });

    it('does not auto-join a user room for an unauthenticated socket', () => {
      let connectionHandler;
      const io = { on: (event, handler) => { connectionHandler = handler; } };
      registerSeatSocketGateway(io);

      const socket = createFakeSocket(null);
      connectionHandler(socket);

      expect(socket.joinedRooms).toEqual([]);
    });

    it('join:event joins the event room (legacy — must keep working)', () => {
      let connectionHandler;
      const io = { on: (event, handler) => { connectionHandler = handler; } };
      registerSeatSocketGateway(io);

      const socket = createFakeSocket();
      connectionHandler(socket);
      socket.trigger('join:event', { eventId: 'evt-1' });

      expect(socket.joinedRooms).toContain('event:evt-1');
    });

    it('join:event without an eventId emits an INVALID_SUBSCRIPTION error', () => {
      let connectionHandler;
      const io = { on: (event, handler) => { connectionHandler = handler; } };
      registerSeatSocketGateway(io);

      const socket = createFakeSocket();
      connectionHandler(socket);
      socket.trigger('join:event', {});

      expect(socket.emitted).toEqual([
        { event: 'error', payload: { code: 'INVALID_SUBSCRIPTION', message: 'eventId is required to join an event room' } },
      ]);
    });

    it('leave:event leaves the event room', () => {
      let connectionHandler;
      const io = { on: (event, handler) => { connectionHandler = handler; } };
      registerSeatSocketGateway(io);

      const socket = createFakeSocket();
      connectionHandler(socket);
      socket.trigger('leave:event', { eventId: 'evt-1' });

      expect(socket.leftRooms).toContain('event:evt-1');
    });

    it('join:showtime joins the showtime room', () => {
      let connectionHandler;
      const io = { on: (event, handler) => { connectionHandler = handler; } };
      registerSeatSocketGateway(io);

      const socket = createFakeSocket();
      connectionHandler(socket);
      socket.trigger('join:showtime', { showtimeId: 'show-1' });

      expect(socket.joinedRooms).toContain('showtime:show-1');
    });

    it('join:showtime without a showtimeId emits an INVALID_SUBSCRIPTION error', () => {
      let connectionHandler;
      const io = { on: (event, handler) => { connectionHandler = handler; } };
      registerSeatSocketGateway(io);

      const socket = createFakeSocket();
      connectionHandler(socket);
      socket.trigger('join:showtime', {});

      expect(socket.emitted).toEqual([
        { event: 'error', payload: { code: 'INVALID_SUBSCRIPTION', message: 'showtimeId is required to join a showtime room' } },
      ]);
    });

    it('leave:showtime leaves the showtime room', () => {
      let connectionHandler;
      const io = { on: (event, handler) => { connectionHandler = handler; } };
      registerSeatSocketGateway(io);

      const socket = createFakeSocket();
      connectionHandler(socket);
      socket.trigger('leave:showtime', { showtimeId: 'show-1' });

      expect(socket.leftRooms).toContain('showtime:show-1');
    });

    it('leave:showtime with no showtimeId is a no-op', () => {
      let connectionHandler;
      const io = { on: (event, handler) => { connectionHandler = handler; } };
      registerSeatSocketGateway(io);

      const socket = createFakeSocket();
      connectionHandler(socket);
      socket.trigger('leave:showtime', {});

      expect(socket.leftRooms).toEqual([]);
    });
  });

  describe('broadcast* helpers — via setIO() fake injection', () => {
    let fakeIO;

    beforeEach(() => {
      fakeIO = createFakeIO();
      setIO(fakeIO);
    });

    it('broadcastSeatUpdate emits seats:updated to the event room (legacy — must keep working)', () => {
      broadcastSeatUpdate('evt-1', ['A-1', 'A-2'], 'held');

      expect(fakeIO.to).toHaveBeenCalledWith('event:evt-1');
      expect(fakeIO.emit).toHaveBeenCalledWith('seats:updated', {
        eventId: 'evt-1',
        seatIds: ['A-1', 'A-2'],
        status: 'held',
      });
    });

    it('broadcastEventCancelled emits event:cancelled to the event room (legacy — must keep working)', () => {
      broadcastEventCancelled('evt-1');

      expect(fakeIO.to).toHaveBeenCalledWith('event:evt-1');
      expect(fakeIO.emit).toHaveBeenCalledWith('event:cancelled', { eventId: 'evt-1' });
    });

    it('broadcastShowtimeSeatsUpdated emits seats:updated to the showtime room', () => {
      broadcastShowtimeSeatsUpdated('show-1', ['B-1'], 'booked');

      expect(fakeIO.to).toHaveBeenCalledWith('showtime:show-1');
      expect(fakeIO.emit).toHaveBeenCalledWith('seats:updated', {
        showtimeId: 'show-1',
        seatIds: ['B-1'],
        status: 'booked',
      });
    });

    it('broadcastShowtimeCancelled emits showtime:cancelled to the showtime room', () => {
      broadcastShowtimeCancelled('show-1');

      expect(fakeIO.to).toHaveBeenCalledWith('showtime:show-1');
      expect(fakeIO.emit).toHaveBeenCalledWith('showtime:cancelled', { showtimeId: 'show-1' });
    });

    it('broadcastBookingConfirmed emits booking:confirmed to the user room', () => {
      broadcastBookingConfirmed('user-1', { holdId: 'hold-1', bookingId: 'bk-1', reference: 'ENC-1' });

      expect(fakeIO.to).toHaveBeenCalledWith('user:user-1');
      expect(fakeIO.emit).toHaveBeenCalledWith('booking:confirmed', {
        holdId: 'hold-1',
        bookingId: 'bk-1',
        reference: 'ENC-1',
      });
    });

    it('broadcastBookingUpdated includes paymentStatus when present', () => {
      broadcastBookingUpdated('user-1', { id: 'bk-1', status: 'confirmed', paymentStatus: 'succeeded' });

      expect(fakeIO.to).toHaveBeenCalledWith('user:user-1');
      expect(fakeIO.emit).toHaveBeenCalledWith('booking:updated', {
        bookingId: 'bk-1',
        status: 'confirmed',
        paymentStatus: 'succeeded',
      });
    });

    it('broadcastBookingUpdated has paymentStatus undefined when absent (harmless, backward compatible)', () => {
      broadcastBookingUpdated('user-1', { id: 'bk-1', status: 'cancelled' });

      expect(fakeIO.emit).toHaveBeenCalledWith('booking:updated', {
        bookingId: 'bk-1',
        status: 'cancelled',
        paymentStatus: undefined,
      });
    });
  });
});
