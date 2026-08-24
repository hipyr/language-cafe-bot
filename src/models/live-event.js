import mongoose from 'mongoose';

const { Schema } = mongoose;

const scheduleSlotSchema = new Schema(
  {
    // 0 = Sunday … 6 = Saturday
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true }, // "HH:MM" UTC
    endTime: { type: String, required: true }, // "HH:MM" UTC
  },
  { _id: false },
);

const skippedOccurrenceSchema = new Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    startTime: { type: String, required: true }, // "HH:MM" — identifies the slot
    skippedBy: { type: String, required: true }, // Discord user ID
    skippedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const rescheduledOccurrenceSchema = new Schema(
  {
    originalDate: { type: String, required: true }, // "YYYY-MM-DD"
    originalStartTime: { type: String, required: true }, // "HH:MM"
    newDate: { type: String, required: true }, // "YYYY-MM-DD"
    newStartTime: { type: String, required: true }, // "HH:MM"
    newEndTime: { type: String, required: true }, // "HH:MM"
    rescheduledBy: { type: String, required: true }, // Discord user ID
    rescheduledAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const liveEventSchema = new Schema(
  {
    name: { type: String, required: true },

    // Host Discord user IDs
    hostIds: { type: [String], default: [] },

    // Discord channel ID where the event takes place
    locationChannelId: { type: String, required: true },

    // Optional link to the event announcement post (Discord message link or URL)
    eventPostLink: { type: String, default: null },

    // ── Schedule ─────────────────────────────────────────────────────────────
    scheduleType: {
      type: String,
      enum: ['one-time', 'recurring'],
      required: true,
    },

    // One-time fields
    oneTimeDate: { type: String, default: null }, // "YYYY-MM-DD"
    oneTimeStartTime: { type: String, default: null }, // "HH:MM"
    oneTimeEndTime: { type: String, default: null }, // "HH:MM"

    // Recurring fields
    recurrenceStartDate: { type: String, default: null }, // "YYYY-MM-DD"
    recurrenceEndDate: { type: String, default: null }, // "YYYY-MM-DD"
    slots: { type: [scheduleSlotSchema], default: [] },

    // ── Exceptions ────────────────────────────────────────────────────────────
    skippedOccurrences: { type: [skippedOccurrenceSchema], default: [] },
    rescheduledOccurrences: { type: [rescheduledOccurrenceSchema], default: [] },

    // ── Meta ──────────────────────────────────────────────────────────────────
    creatorId: { type: String, required: true },

    // upcoming → live (during an occurrence) → ended (no future occurrences)
    status: {
      type: String,
      enum: ['upcoming', 'live', 'ended'],
      default: 'upcoming',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

liveEventSchema.index({ status: 1 });
liveEventSchema.index({ name: 'text' });

export default mongoose.model('live-event', liveEventSchema);
