import mongoose from 'mongoose';

const seatLayoutSchema = new mongoose.Schema(
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
  },
  { _id: false }
);

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Venue address is required'],
      trim: true,
    },
    seatLayout: {
      type: [seatLayoutSchema],
      required: [true, 'Seat layout is required'],
      validate: [
        {
          validator: (arr) => arr && arr.length > 0 && arr.length <= 500,
          message: 'Seat layout must contain between 1 and 500 seats (ADR-002)',
        },
      ],
    },
    capacity: {
      type: Number,
      default: function () {
        return this.seatLayout ? this.seatLayout.length : 0;
      },
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

// Keep capacity synchronized with seatLayout length
venueSchema.pre('save', function () {
  if (this.seatLayout) {
    this.capacity = this.seatLayout.length;
  }
});

const Venue = mongoose.model('Venue', venueSchema);
export default Venue;
