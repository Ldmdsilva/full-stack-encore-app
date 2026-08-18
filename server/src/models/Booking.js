import mongoose from 'mongoose';

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
      required: [true, 'Event reference is required'],
    },
    seats: {
      type: [String],
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
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
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

// Indexes (§C6.3)
bookingSchema.index({ userRef: 1, createdAt: -1 });
bookingSchema.index({ eventRef: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
