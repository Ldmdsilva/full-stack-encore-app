import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import { serializeEventSummary } from '../serializers/eventSerializer.js';

/**
 * Aggregate dashboard statistics across all events and bookings (FR-25).
 * @returns {Promise<object>}
 */
export async function getStats() {
  const [totalEvents, upcomingEvents, totalBookings, confirmedBookings, cancelledBookings, revenueAgg, seatAgg] =
    await Promise.all([
      Event.countDocuments({}),
      Event.countDocuments({ status: 'scheduled' }),
      Booking.countDocuments({}),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      Booking.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),
      Event.aggregate([
        {
          $project: {
            totalSeats: { $size: '$seats' },
            bookedSeats: {
              $size: {
                $filter: { input: '$seats', as: 's', cond: { $eq: ['$$s.status', 'booked'] } },
              },
            },
          },
        },
        { $group: { _id: null, totalSeats: { $sum: '$totalSeats' }, bookedSeats: { $sum: '$bookedSeats' } } },
      ]),
    ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const totalSeats = seatAgg[0]?.totalSeats || 0;
  const bookedSeats = seatAgg[0]?.bookedSeats || 0;

  return {
    totalEvents,
    upcomingEvents,
    totalBookings,
    confirmedBookings,
    cancelledBookings,
    totalRevenue,
    totalSeats,
    bookedSeats,
    availableSeats: totalSeats - bookedSeats,
    occupancyRate: totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
  };
}

/**
 * List every event (including cancelled and past) with revenue and booking
 * count derived from confirmed bookings, for the admin events table (FR-25).
 * @param {object} queryParams
 * @returns {Promise<{ events: Array, total: number, page: number, totalPages: number }>}
 */
export async function listAdminEvents(queryParams = {}) {
  const { page = 1, limit = 20 } = queryParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [events, total] = await Promise.all([
    Event.find({})
      .populate('venueRef', 'name address city capacity')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum),
    Event.countDocuments({}),
  ]);

  const eventIds = events.map((event) => event._id);
  const revenueByEvent = await Booking.aggregate([
    { $match: { eventRef: { $in: eventIds }, status: 'confirmed' } },
    { $group: { _id: '$eventRef', revenue: { $sum: '$totalPrice' }, bookingCount: { $sum: 1 } } },
  ]);
  const statsByEventId = new Map(revenueByEvent.map((row) => [row._id.toString(), row]));

  return {
    events: events.map((event) => {
      const stats = statsByEventId.get(event._id.toString());
      return {
        ...serializeEventSummary(event),
        revenue: stats?.revenue || 0,
        bookingCount: stats?.bookingCount || 0,
      };
    }),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  };
}
