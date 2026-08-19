import '../config/env.js';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { normaliseLk } from '../utils/phone.js';
import User from '../models/User.js';
import Venue from '../models/Venue.js';
import Event from '../models/Event.js';

const SEAT_SECTIONS = [
  { code: 'STALLS', rows: ['A', 'B', 'C', 'D'], multiplier: 1.6 },
  { code: 'CIRCLE', rows: ['E', 'F', 'G'], multiplier: 1.15 },
  { code: 'BALCONY', rows: ['H', 'J'], multiplier: 0.85 },
];
const SEATS_PER_ROW = 12;

function buildSeatLayout() {
  const seatLayout = [];
  for (const section of SEAT_SECTIONS) {
    for (const row of section.rows) {
      for (let number = 1; number <= SEATS_PER_ROW; number++) {
        seatLayout.push({ id: `${row}-${number}`, section: section.code, row, number });
      }
    }
  }
  return seatLayout;
}

const PRICE_MULTIPLIER_BY_SECTION = Object.fromEntries(
  SEAT_SECTIONS.map((section) => [section.code, section.multiplier])
);

const VENUES = [
  { name: 'The Half Moon', address: '93 Lower Richmond Road', city: 'London' },
  { name: 'Corn Exchange', address: 'Corn Street', city: 'Bristol' },
];

const EVENTS = [
  {
    title: 'The Marfa Sessions',
    artist: 'Phoebe Wren',
    genre: 'Folk',
    date: '2026-09-12T20:00:00',
    basePrice: 6500,
    venueName: 'The Half Moon',
    description:
      'A candlelit evening of desert-country songwriting, recorded live to tape. Phoebe Wren brings the full seven-piece band and a string section for one night only.',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&h=800&fit=crop&auto=format',
  },
  {
    title: 'Nightbus, Live',
    artist: 'Kojo & the Meridian',
    genre: 'Soul',
    date: '2026-09-19T21:00:00',
    basePrice: 5500,
    venueName: 'Corn Exchange',
    description:
      'Late-night soul and low-slung funk from a band built for the small hours. Support from the Meridian horns.',
    imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=800&fit=crop&auto=format',
  },
  {
    title: 'Cartography',
    artist: 'Atlas Quartet',
    genre: 'Contemporary',
    date: '2026-10-03T19:30:00',
    basePrice: 8500,
    venueName: 'The Half Moon',
    description:
      'The Atlas Quartet map new terrain across four movements, pairing minimalist string writing with field recordings gathered on tour.',
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&h=800&fit=crop&auto=format',
  },
  {
    title: 'Neon Meridian Tour',
    artist: 'Vela',
    genre: 'Synth-pop',
    date: '2026-10-11T20:30:00',
    basePrice: 7500,
    venueName: 'Corn Exchange',
    description:
      'Vela returns with a wall of analogue synths and a light rig built for the record. Expect the new album front to back.',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&h=800&fit=crop&auto=format',
  },
  {
    title: 'Hymnal',
    artist: 'The Oak Choir',
    genre: 'Choral',
    date: '2026-10-18T19:00:00',
    basePrice: 4500,
    venueName: 'The Half Moon',
    description:
      'Forty voices under a vaulted roof. A programme of new commissions and reworked standards, sung in the round.',
    imageUrl: 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1200&h=800&fit=crop&auto=format',
  },
  {
    title: 'Static Bloom',
    artist: 'Riven',
    genre: 'Post-rock',
    date: '2026-10-25T21:00:00',
    basePrice: 6000,
    venueName: 'Corn Exchange',
    description:
      'Instrumental crescendos and slow-building noise from a band that treats volume as an instrument.',
    imageUrl: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&h=800&fit=crop&auto=format',
  },
];

const ADMIN_USER = {
  name: 'Encore Admin',
  email: 'admin@encore.live',
  password: 'Admin123!',
  phone: '0771234567',
  role: 'admin',
};

const CUSTOMER_USERS = [
  { name: 'Miriam Osei', email: 'miriam.osei@example.com', password: 'Password123!', phone: '0711234567' },
  { name: 'Theo Blackwell', email: 'theo.blackwell@example.com', password: 'Password123!', phone: '0721234567' },
  { name: 'Priya Nair', email: 'priya.nair@example.com', password: 'Password123!', phone: '0731234567' },
];

async function seedUsers() {
  for (const candidate of [ADMIN_USER, ...CUSTOMER_USERS]) {
    const existing = await User.findOne({ email: candidate.email });
    if (existing) {
      console.log(`[seed] user already exists, skipping: ${candidate.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(candidate.password, 10);
    await User.create({
      name: candidate.name,
      email: candidate.email,
      passwordHash,
      phone: normaliseLk(candidate.phone),
      role: candidate.role || 'customer',
    });
    console.log(`[seed] created user: ${candidate.email}`);
  }
}

async function seedVenues() {
  const venueByName = new Map();

  for (const candidate of VENUES) {
    let venue = await Venue.findOne({ name: candidate.name });
    if (!venue) {
      venue = await Venue.create({
        name: candidate.name,
        address: candidate.address,
        city: candidate.city,
        seatLayout: buildSeatLayout(),
      });
      console.log(`[seed] created venue: ${candidate.name}`);
    } else {
      console.log(`[seed] venue already exists, skipping: ${candidate.name}`);
    }
    venueByName.set(candidate.name, venue);
  }

  return venueByName;
}

async function seedEvents(venueByName) {
  for (const candidate of EVENTS) {
    const existing = await Event.findOne({ title: candidate.title });
    if (existing) {
      console.log(`[seed] event already exists, skipping: ${candidate.title}`);
      continue;
    }

    const venue = venueByName.get(candidate.venueName);
    const seats = venue.seatLayout.map((seat) => ({
      id: seat.id,
      section: seat.section,
      row: seat.row,
      number: seat.number,
      status: 'available',
      price: Math.round(candidate.basePrice * PRICE_MULTIPLIER_BY_SECTION[seat.section]),
    }));

    await Event.create({
      title: candidate.title,
      artist: candidate.artist,
      genre: candidate.genre,
      imageUrl: candidate.imageUrl,
      description: candidate.description,
      date: new Date(candidate.date),
      basePrice: candidate.basePrice,
      venueRef: venue._id,
      seats,
      status: 'scheduled',
    });
    console.log(`[seed] created event: ${candidate.title}`);
  }
}

async function run() {
  await connectDB(env.MONGODB_URI);
  await seedUsers();
  const venueByName = await seedVenues();
  await seedEvents(venueByName);
  await disconnectDB();
  console.log('[seed] Done.');
}

run().catch((error) => {
  console.error('[seed] Failed:', error);
  process.exit(1);
});
