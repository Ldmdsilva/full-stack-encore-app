import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import app from '../../src/app.js';
import * as authService from '../../src/services/authService.js';
import Venue from '../../src/models/Venue.js';
import Event from '../../src/models/Event.js';
import User from '../../src/models/User.js';

describe('Encore REST API Integration Tests (§C7.1, §D4.2, ADR-008)', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('Health Check Endpoint (NFR-7, §C7.1)', () => {
    it('GET /api/health returns 200 and healthy db status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('db', 'connected');
    });
  });

  describe('Authentication Endpoints (FR-1, FR-2, FR-3, FR-4)', () => {
    it('POST /api/auth/register registers user and returns 201 with JWT', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          password: 'securePassword99',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('_id');
      expect(res.body.user.email).toBe('sarah@example.com');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('POST /api/auth/login logs in user and returns 200 with JWT', async () => {
      await authService.register({
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        password: 'securePassword99',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sarah@example.com',
          password: 'securePassword99',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('GET /api/users/me returns 401 when token is missing (FR-3)', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/users/me returns 200 with profile when valid token provided (FR-5)', async () => {
      const { token } = await authService.register({
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        password: 'securePassword99',
      });

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('sarah@example.com');
    });
  });

  describe('Events and Booking Lifecycle (FR-7, FR-8, FR-17, FR-18, FR-19)', () => {
    let customerToken;
    let adminToken;
    let venueId;
    let eventId;

    beforeEach(async () => {
      // 1. Create customer user & token
      const customer = await authService.register({
        name: 'Customer One',
        email: 'customer@test.com',
        password: 'password123',
      });
      customerToken = customer.token;

      // 2. Create admin user & token
      const adminUser = await User.create({
        name: 'Admin Boss',
        email: 'admin@test.com',
        passwordHash: 'dummyHash',
        role: 'admin',
      });
      adminToken = authService.generateToken(adminUser);

      // 3. Create Venue
      const venue = await Venue.create({
        name: 'Grand Concert Hall',
        address: '42 Melody Lane',
        seatLayout: [
          { id: 'A-1', section: 'Stalls', row: 'A', number: 1 },
          { id: 'A-2', section: 'Stalls', row: 'A', number: 2 },
          { id: 'B-1', section: 'Balcony', row: 'B', number: 1 },
        ],
        capacity: 3,
      });
      venueId = venue._id;

      // 4. Create Event
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const event = await Event.create({
        title: 'Symphony Night',
        artist: 'London Philharmonic',
        date: futureDate,
        basePrice: 50,
        venueRef: venueId,
        seats: [
          { id: 'A-1', section: 'Stalls', row: 'A', number: 1, status: 'available', price: 50 },
          { id: 'A-2', section: 'Stalls', row: 'A', number: 2, status: 'available', price: 50 },
          { id: 'B-1', section: 'Balcony', row: 'B', number: 1, status: 'available', price: 50 },
        ],
        status: 'scheduled',
      });
      eventId = event._id;
    });

    it('GET /api/events returns paginated upcoming events (FR-7)', async () => {
      const res = await request(app).get('/api/events');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].title).toBe('Symphony Night');
    });

    it('GET /api/events/:id returns event details and full seat map (FR-8, FR-13)', async () => {
      const res = await request(app).get(`/api/events/${eventId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('event');
      expect(res.body).toHaveProperty('seats');
      expect(res.body.seats).toHaveLength(3);
    });

    it('POST /api/bookings books available seats and returns 201 (FR-17)', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          eventId: eventId.toString(),
          seatIds: ['A-1', 'A-2'],
        });

      expect(res.status).toBe(201);
      expect(res.body.booking).toHaveProperty('reference');
      expect(res.body.booking.seats).toEqual(['A-1', 'A-2']);
      expect(res.body.booking.totalPrice).toBe(100); // 50 * 2 computed server-side
      expect(res.body.booking.status).toBe('confirmed');

      // Verify event seats updated in DB
      const updatedEvent = await Event.findById(eventId);
      const bookedSeats = updatedEvent.seats.filter((s) => s.status === 'booked');
      expect(bookedSeats).toHaveLength(2);
    });

    it('POST /api/bookings returns 409 Conflict when attempting to book already booked seat', async () => {
      // First booking succeeds
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          eventId: eventId.toString(),
          seatIds: ['A-1'],
        });

      // Second booking on same seat fails with 409
      const conflictRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          eventId: eventId.toString(),
          seatIds: ['A-1'],
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.code).toBe('SEAT_UNAVAILABLE');
    });

    it('GET /api/bookings/me returns customer bookings (FR-18)', async () => {
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          eventId: eventId.toString(),
          seatIds: ['B-1'],
        });

      const res = await request(app)
        .get('/api/bookings/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings).toHaveLength(1);
      expect(res.body.bookings[0].seats).toEqual(['B-1']);
    });

    it('PATCH /api/bookings/:id/cancel cancels booking and releases seats (FR-19)', async () => {
      const bookRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          eventId: eventId.toString(),
          seatIds: ['A-1'],
        });

      const bookingId = bookRes.body.booking._id;

      const cancelRes = await request(app)
        .patch(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.booking.status).toBe('cancelled');

      // Verify seat is available again in Event
      const eventAfter = await Event.findById(eventId);
      const seatA1 = eventAfter.seats.find((s) => s.id === 'A-1');
      expect(seatA1.status).toBe('available');
    });

    it('GET /api/venues and POST /api/venues handle venue CRUD (FR-22)', async () => {
      const getRes = await request(app).get('/api/venues');
      expect(getRes.status).toBe(200);
      expect(getRes.body.venues).toBeInstanceOf(Array);

      const createRes = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'The Hydro Arena',
          address: 'Exhibition Way',
          seatLayout: [{ id: 'H-1', section: 'Main', row: 'A', number: 1 }],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.venue.name).toBe('The Hydro Arena');

      const singleRes = await request(app).get(`/api/venues/${createRes.body.venue._id}`);
      expect(singleRes.status).toBe(200);
      expect(singleRes.body.venue.address).toBe('Exhibition Way');
    });

    it('PATCH /api/users/me updates profile (FR-5)', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Updated Name');
    });

    it('GET /api/bookings returns all bookings for Admin (FR-24)', async () => {
      const res = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('bookings');
    });

    it('POST /api/events returns 403 Forbidden for non-admin customer (FR-4)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Unauthorized Event',
          artist: 'No Access',
          date: new Date(Date.now() + 86400000),
          basePrice: 40,
          venueRef: venueId.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
