import mongoose from 'mongoose';

const webhookEventSchema = new mongoose.Schema(
  {
    stripeEventId: {
      type: String,
      required: [true, 'Stripe event id is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Stripe event type is required'],
      trim: true,
    },
    processedAt: {
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

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
export default WebhookEvent;
