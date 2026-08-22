import LiveEvent from '../../../models/live-event.js';
import { computeLiveEventStatus } from '../../utils/live-event-utils.js';
import { escapeRegex } from '../../utils/event-utils.js';
import queryWithTimeout from '../../utils/query-with-timeout.js';

/**
 * Autocomplete handler for live event name fields.
 * Returns up to 25 matching live events with explicit schedule and status labels.
 */
export async function handleLiveEventNameAutocomplete(interaction) {
  const focused = interaction.options.getFocused();

  const events =
    (await queryWithTimeout(
      LiveEvent.find({ name: { $regex: new RegExp(escapeRegex(focused), 'i') } })
        .limit(25)
        .lean(),
    )) ?? [];

  const STATUS_LABEL = {
    upcoming: 'Upcoming',
    live: 'Live now',
    ended: 'Ended',
  };

  await interaction.respond(
    events.map((event) => {
      const status = computeLiveEventStatus(event);
      const frequency = event.scheduleType === 'recurring' ? 'Recurring' : 'One-time';

      return {
        name: `${event.name} [${frequency} · ${STATUS_LABEL[status] ?? 'Unknown status'}]`,
        value: event._id.toString(),
      };
    }),
  );
}
