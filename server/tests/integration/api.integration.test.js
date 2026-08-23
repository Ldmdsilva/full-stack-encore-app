import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { createStripeMock, mockStripeModule } from '../helpers/mocks.js';
import Venue from '../../src/models/Venue.js';
import Event from '../../src/models/Event.js';
import User from '../../src/models/User.js';

// Stripe must be mocked before app.js is dynamically imported below, since
// app.js -> bookingRoutes/paymentRoutes -> bookingService/paymentService ->
// config/stripe.js -> 'stripe'. POST /api/bookings is exercised repeatedly
// in this suite and must never hit the real Stripe API.
const stripeMock = createStripeMock();
mockStripeModule(stripeMock);

let app;
let authService;

describe('Encore REST API Integration Tests (§C7.1, §D4.2, ADR-008)', () => {
  beforeAll(async () => {
    await connectTestDB();
    app = (await import('../../src/app.js')).default;
    authService = await import('../../src/services/authService.js');
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
    it('POST /api/auth/register returns 202 with a generic message and no token (D14)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          password: 'securePassword99',
          phone: '0771234567',
        });

      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('message');
      expect(res.body).not.toHaveProperty('token');
      expect(res.body).not.toHaveProperty('user');

      const created = await User.findOne({ email: 'sarah@example.com' });
      expect(created).toBeTruthy();
      expect(created.emailVerified).toBe(false);
    });

    it('POST /api/auth/register responds identically for an already-registered email (FR-7, no enumeration)', async () => {
      const payload = {
        name: 'Sarah Connor',
        email: 'sarahdup@example.com',
        password: 'securePassword99',
        phone: '0771234567',
      };

      const first = await request(app).post('/api/auth/register').send(payload);
      const second = await request(app)
        .post('/api/auth/register')
        .send({ ...payload, name: 'Someone Else', password: 'differentPassword1' });

      expect(second.status).toBe(202);
      expect(second.body).toEqual(first.body);

      const users = await User.find({ email: 'sarahdup@example.com' });
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Sarah Connor');
    });

    it('POST /api/auth/register rejects a missing phone (400 VALIDATION_ERROR)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'No Phone',
          email: 'nophone@example.com',
          password: 'securePassword99',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/auth/login logs in user and returns 200 with JWT', async () => {
      await authService.register({
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        password: 'securePassword99',
        phone: '0771234567',
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

    it('GET /api/users/me returns 401 when the Authorization header is not a Bearer token (FR-3)', async () => {
      const res = await request(app).get('/api/users/me').set('Authorization', 'Basic somecredentials');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/users/me returns 401 INVALID_TOKEN for a garbage/malformed token (ADR-005)', async () => {
      const res = await request(app).get('/api/users/me').set('Authorization', 'Bearer not-a-real-jwt');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('GET /api/users/me returns 401 TOKEN_EXPIRED for an expired token (ADR-005)', async () => {
      const expiredToken = jwt.sign({ id: 'someid', email: 'x@example.com', role: 'customer' }, process.env.JWT_SECRET, {
        expiresIn: -10, // already expired
      });

      const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('GET /api/users/me returns 200 with profile when valid token provided (FR-5)', async () => {
      await authService.register({
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        password: 'securePassword99',
        phone: '0771234567',
      });
      // register() no longer issues a JWT (D14) — login is the only token
      // issuer, and it doesn't require email verification first.
      const { token } = await authService.login({ email: 'sarah@example.com', password: 'securePassword99' });

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('sarah@example.com');
      expect(res.body.user).toHaveProperty('id');
    });
  });

  describe('Events and Booking Lifecycle (FR-7, FR-8, FR-17, FR-18, FR-19)', () => {
    let customerToken;
    let adminToken;
    let venueId;
    let eventId;

    beforeEach(async () => {
      stripeMock.checkout.sessions.create.mockClear();

      // 1. Create customer user & token. register() no longer issues a JWT
      // (D14) — log in afterwards to get one; login doesn't require
      // verification, and nothing in this old Event/Booking flow gates on
      // emailVerified yet.
      await authService.register({
        name: 'Customer One',
        email: 'customer@test.com',
        password: 'password123',
        phone: '0771234567',
      });
      const customer = await authService.login({ email: 'customer@test.com', password: 'password123' });
      customerToken = customer.token;

      // 2. Create admin user & token
      const adminUser = await User.create({
        name: 'Admin Boss',
        email: 'admin@test.com',
        passwordHash: 'dummyHash',
        phone: '94777654321',
        role: 'admin',
      });
      adminToken = authService.generateToken(adminUser);

      // 3. Create Venue
      const venue = await Venue.create({
        name: 'Grand Concert Hall',
        address: '42 Melody Lane',
        city: 'Colombo',
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
        genre: 'Classical',
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

    it('GET /api/events returns paginated upcoming events with the serialized summary shape (FR-7)', async () => {
      const res = await request(app).get('/api/events');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(res.body.events).toHaveLength(1);

      const [summary] = res.body.events;
      expect(summary.title).toBe('Symphony Night');
      expect(summary).toHaveProperty('id');
      expect(summary).not.toHaveProperty('_id');
      expect(summary).not.toHaveProperty('venueRef');
      expect(summary.venue).toEqual({ id: venueId.toString(), name: 'Grand Concert Hall', city: 'Colombo' });
      expect(summary.totalSeats).toBe(3);
      expect(summary.availableSeats).toBe(3);
    });

    it('GET /api/events/:id returns event details and full seat map (FR-8, FR-13)', async () => {
      const res = await request(app).get(`/api/events/${eventId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('event');
      expect(res.body).toHaveProperty('seats');
      expect(res.body.seats).toHaveLength(3);
      expect(res.body.event.venue.city).toBe('Colombo');
    });

    it('POST /api/bookings holds available seats, opens a Stripe session, and returns 201 pending (FR-17)', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          eventId: eventId.toString(),
          seatIds: ['A-1', 'A-2'],
        });

      expect(res.status).toBe(201);
      expect(res.body.booking).toHaveProperty('id');
      expect(res.body.booking).not.toHaveProperty('_id');
      expect(res.body.booking).toHaveProperty('reference');
      expect(res.body.booking.seats.map((s) => s.id)).toEqual(['A-1', 'A-2']);
      expect(res.body.booking.totalPrice).toBe(100); // 50 * 2 computed server-side
      // ADR-009: hold->pay->confirm — pending until the Stripe webhook lands
      expect(res.body.booking.status).toBe('pending');
      expect(res.body.booking.holdExpiresAt).toBeTruthy();
      expect(res.body.clientSecret).toBeTruthy();
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);

      // Verify event seats updated in DB — held, not booked, until confirmed
      const updatedEvent = await Event.findById(eventId);
      const heldSeats = updatedEvent.seats.filter((s) => s.status === 'held');
      expect(heldSeats).toHaveLength(2);
    });

    it('POST /api/bookings returns 409 Conflict when attempting to book an already held seat', async () => {
      // First booking succeeds and holds the seat
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

    it('GET /api/bookings/me returns customer bookings with subdoc seats (FR-18)', async () => {
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
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].seats.map((s) => s.id)).toEqual(['B-1']);
      expect(res.body.items[0].status).toBe('pending');
      expect(res.body.limit).toBe(10);
    });

    it('PATCH /api/bookings/:id/cancel cancels a pending booking and releases its held seats (FR-19)', async () => {
      const bookRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          eventId: eventId.toString(),
          seatIds: ['A-1'],
        });

      expect(bookRes.body.booking.status).toBe('pending');
      const bookingId = bookRes.body.booking.id;

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

    it('GET /api/venues and POST /api/venues handle venue CRUD with city (FR-22)', async () => {
      const getRes = await request(app).get('/api/venues');
      expect(getRes.status).toBe(200);
      expect(getRes.body.venues).toBeInstanceOf(Array);

      const createRes = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'The Hydro Arena',
          address: 'Exhibition Way',
          city: 'Glasgow',
          seatLayout: [{ id: 'H-1', section: 'Main', row: 'A', number: 1 }],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.venue.name).toBe('The Hydro Arena');
      expect(createRes.body.venue.city).toBe('Glasgow');
      expect(createRes.body.venue).toHaveProperty('id');

      const singleRes = await request(app).get(`/api/venues/${createRes.body.venue.id}`);
      expect(singleRes.status).toBe(200);
      expect(singleRes.body.venue.address).toBe('Exhibition Way');
    });

    it('POST /api/venues rejects a missing city (400 VALIDATION_ERROR)', async () => {
      const res = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'No City Arena',
          address: 'Nowhere Street',
          seatLayout: [{ id: 'N-1', section: 'Main', row: 'A', number: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
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
      expect(res.body).toHaveProperty('items');
    });

    it('POST /api/events returns 403 Forbidden for non-admin customer (FR-4)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Unauthorized Event',
          artist: 'No Access',
          genre: 'Rock',
          date: new Date(Date.now() + 86400000),
          basePrice: 40,
          venueRef: venueId.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /api/events rejects a missing genre for an admin (400 VALIDATION_ERROR)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'No Genre Event',
          artist: 'Mystery Band',
          date: new Date(Date.now() + 86400000),
          basePrice: 40,
          venueRef: venueId.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
