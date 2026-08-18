import mongoose from 'mongoose';

const seatSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
    },
    row: {
      type: String,
      required: true,
      trim: true,
    },
    number: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'booked'],
      default: 'available',
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Seat price cannot be negative'],
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
    },
    artist: {
      type: String,
      required: [true, 'Artist name is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Base price cannot be negative'],
    },
    venueRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: [true, 'Venue reference is required'],
    },
    seats: {
      type: [seatSchema],
      required: true,
      default: [],
    },
    status: {
      type: String,
      enum: ['scheduled', 'cancelled'],
      default: 'scheduled',
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (_, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes (§C6.3)
eventSchema.index({ date: 1, status: 1 });
eventSchema.index({ artist: 'text', title: 'text' });

const Event = mongoose.model('Event', eventSchema);
export default Event;
