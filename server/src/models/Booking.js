import mongoose from 'mongoose';

const bookedSeatSchema = new mongoose.Schema(
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
    price: {
      type: Number,
      required: true,
      min: [0, 'Seat price cannot be negative'],
    },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      default: 'stripe',
    },
    sessionId: {
      type: String,
    },
    paymentIntentId: {
      type: String,
    },
    status: {
      type: String,
    },
    amountMinor: {
      type: Number,
    },
    currency: {
      type: String,
    },
    refundId: {
      type: String,
    },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: [true, 'Booking reference is required'],
      unique: true,
      trim: true,
    },
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: false,
    },
    // New showtime/hold-based flow (ADR-014, additive — legacy Event flow
    // above is untouched). Exactly one of eventRef/showtimeRef is enforced
    // by the pre('validate') hook below, not by `required` on either field.
    showtimeRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Showtime',
    },
    holdRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hold',
      unique: true,
      sparse: true,
    },
    // Deliberately separate from the nested `payment.paymentIntentId` used by
    // the legacy Checkout Session flow — the new flow writes here instead,
    // with its own independent uniqueness guarantee.
    paymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: undefined,
    },
    // Denormalised from Showtime.screenName so a booking's ticket can show
    // its screen without populating Cinema.screens.
    screenName: {
      type: String,
    },
    seats: {
      type: [bookedSeatSchema],
      required: [true, 'At least one seat must be selected'],
      validate: [
        {
          validator: (arr) => Array.isArray(arr) && arr.length > 0,
          message: 'Booking must include at least one seat',
        },
      ],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'expired'],
      default: 'pending',
    },
    holdExpiresAt: {
      type: Date,
    },
    payment: {
      type: paymentSchema,
      default: () => ({}),
    },
    createdAt: {
      type: Date,
      default: Date.now,
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

// Cross-reference invariant: a booking belongs to exactly one flow — the
// legacy Event flow (eventRef) or the new Showtime/Hold flow (showtimeRef) —
// never both, never neither. Enforced structurally here rather than via
// `required` on either field, since which one is required depends on the
// other.
bookingSchema.pre('validate', function crossReferenceGuard() {
  const hasEventRef = !!this.eventRef;
  const hasShowtimeRef = !!this.showtimeRef;
  if (hasEventRef === hasShowtimeRef) {
    this.invalidate('eventRef', 'Exactly one of eventRef or showtimeRef is required');
  }
});

// Indexes (§C6.3)
bookingSchema.index({ userRef: 1, createdAt: -1 });
bookingSchema.index({ eventRef: 1 });
bookingSchema.index({ showtimeRef: 1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
