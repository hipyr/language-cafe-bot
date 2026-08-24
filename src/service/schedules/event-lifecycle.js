import Event from '../../models/event.js';
import LiveEvent from '../../models/live-event.js';
import channelLog, { generateSystemLogContent } from '../utils/channel-log.js';
import { refreshEventCalendar } from '../utils/event-calendar.js';
import { computeLiveEventStatus } from '../utils/live-event-utils.js';

/**
 * Runs every hour and on startup.
 *
 * Standard events: pending → active → ended based on startDate/endDate.
 * Live events: upcoming → live → ended based on scheduled occurrences.
 */
export default async function eventLifecycle() {
  try {
    const now = new Date();
    let changed = 0;

    // ── Standard events ───────────────────────────────────────────────────────
    const toActivate = await Event.find({ status: 'pending', startDate: { $lte: now } });
    for (const event of toActivate) {
      event.status = 'active';
      await event.save();
      changed++;
      channelLog(
        generateSystemLogContent('Event Activated', {
          event: `\`${event.name}\``,
          id: `\`${event._id}\``,
        }),
      );
    }

    const toClose = await Event.find({ status: 'active', endDate: { $lte: now } });
    for (const event of toClose) {
      event.status = 'ended';
      await event.save();
      changed++;
      channelLog(
        generateSystemLogContent('Event Ended', {
          event: `\`${event.name}\``,
          id: `\`${event._id}\``,
        }),
      );
    }

    // ── Live events ───────────────────────────────────────────────────────────
    const liveEvents = await LiveEvent.find({ status: { $in: ['upcoming', 'live'] } });
    for (const liveEvent of liveEvents) {
      const newStatus = computeLiveEventStatus(liveEvent, now);
      if (liveEvent.status !== newStatus) {
        const old = liveEvent.status;
        liveEvent.status = newStatus;
        await liveEvent.save();
        changed++;
        channelLog(
          generateSystemLogContent('Live Event Status Changed', {
            event: `\`${liveEvent.name}\``,
            from: `\`${old}\``,
            to: `\`${newStatus}\``,
          }),
        );
      }
    }

    if (changed > 0) {
      channelLog(generateSystemLogContent('Event Lifecycle Run', { changes: `\`${changed}\`` }));
      await refreshEventCalendar();
    }
  } catch (err) {
    console.error('Error in eventLifecycle:', err);
  }
}
