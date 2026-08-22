import Event from '../../models/event.js';
import LiveEvent from '../../models/live-event.js';
import client from '../../client/index.js';
import config from '../../config/index.js';
import channelLog, { generateSystemLogContent } from './channel-log.js';
import { formatDateUTC, getOccurrencesOnDate, toUnixTimestamp } from './live-event-utils.js';

const { EVENT_CALENDAR_CHANNEL_ID: calendarChannelId } = config;

const CATEGORY_SQUARE = {
  Reading: '🟥',
  Listening: '🟨',
  Speaking: '🟦',
  Writing: '🟩',
  Mixed: '🟧',
  Other: '🟪',
};

const LEGEND =
  '🟥 Reading · 🟨 Listening · 🟦 Speaking · 🟩 Writing · 🩷 Live Event · 🟧 Mixed · 🟪 Other';

// ─── Standard events embed ────────────────────────────────────────────────────

function buildStandardEmbed(events, liveEvents) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  if (events.length === 0 && liveEvents.length === 0) {
    return {
      color: 0x5865f2,
      title: '🗓️ Language Cafe Event Calendar',
      description: `**Today's Events · ${today}**\n${LEGEND}\n\n*No active events at the moment.*`,
    };
  }

  const lines = events.map((event) => {
    const square = CATEGORY_SQUARE[event.eventType] ?? '🟪';
    const name = event.eventPostLink ? `[${event.name}](${event.eventPostLink})` : event.name;
    return `${square} ${name}`;
  });

  const liveLines = liveEvents.map(({ liveEvent, occurrences }) => {
    const name = liveEvent.eventPostLink
      ? `[${liveEvent.name}](${liveEvent.eventPostLink})`
      : liveEvent.name;
    const hosts = liveEvent.hostIds?.length
      ? ` · ${liveEvent.hostIds.map((id) => `<@${id}>`).join(', ')}`
      : '';
    const times = occurrences
      .map(
        (occurrence) =>
          `<t:${toUnixTimestamp(occurrence.date, occurrence.startTime)}:t>–<t:${toUnixTimestamp(occurrence.date, occurrence.endTime)}:t>`,
      )
      .join(', ');

    return `🩷 ${name} · ${times}${hosts} · <#${liveEvent.locationChannelId}>`;
  });

  return {
    color: 0x5865f2,
    title: '🗓️ Language Cafe Event Calendar',
    description:
      `**Today's Events · ${today}**\n${LEGEND}\n\n` + [...lines, ...liveLines].join('\n'),
  };
}

// ─── Channel refresh ──────────────────────────────────────────────────────────

export async function refreshEventCalendar() {
  try {
    if (!calendarChannelId) return;

    const channel = await client.channels.fetch(calendarChannelId).catch(() => null);
    if (!channel) return;

    // Delete existing bot messages
    const messages = await channel.messages.fetch({ limit: 100 });
    const botMessages = messages.filter((m) => m.author.id === client.user.id);

    if (botMessages.size > 0) {
      try {
        await channel.bulkDelete(botMessages);
      } catch {
        for (const msg of botMessages.values()) {
          await msg.delete().catch(() => {});
        }
      }
    }

    // Fetch active standard events
    const events = await Event.find({ status: 'active' }).sort({ startDate: 1 });

    // Only include live-event series with an occurrence scheduled for today.
    const todayStr = formatDateUTC(new Date());
    const liveEvents = (await LiveEvent.find({ status: { $in: ['upcoming', 'live'] } }))
      .map((liveEvent) => ({
        liveEvent,
        occurrences: getOccurrencesOnDate(liveEvent, todayStr),
      }))
      .filter(({ occurrences }) => occurrences.length > 0);

    await channel.send({
      embeds: [buildStandardEmbed(events, liveEvents)],
    });

    channelLog(
      generateSystemLogContent('Event Calendar Refreshed', {
        activeEvents: `\`${events.length}\``,
        liveEvents: `\`${liveEvents.length}\``,
      }),
    );
  } catch (err) {
    console.error('refreshEventCalendar error:', err);
  }
}
