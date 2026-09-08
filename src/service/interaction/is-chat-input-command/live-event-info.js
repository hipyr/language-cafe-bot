import LiveEvent from '../../../models/live-event.js';
import channelLog, { generateInteractionCreateLogContent } from '../../utils/channel-log.js';
import {
  discordTimestamp,
  getNextOccurrence,
  getCurrentOccurrence,
  computeLiveEventStatus,
} from '../../utils/live-event-utils.js';
import { findByIdOrName } from '../../utils/event-utils.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * /live-event info
 */
export default async function liveEventInfo(interaction) {
  await interaction.deferReply({ ephemeral: false });

  channelLog(generateInteractionCreateLogContent(interaction));

  const eventName = interaction.options.getString('event_name');

  const liveEvent = await findByIdOrName(LiveEvent, eventName);

  if (!liveEvent) {
    return interaction.editReply(`❌ No live event found with the name **${eventName}**.`);
  }

  const now = new Date();
  const status = computeLiveEventStatus(liveEvent, now);

  const statusLabel =
    status === 'live' ? '🔴 Live now' : status === 'upcoming' ? '🕐 Upcoming' : '⚫ Ended';

  const fields = [];

  // Hosts
  fields.push({
    name: 'Host(s)',
    value: liveEvent.hostIds.length
      ? liveEvent.hostIds.map((id) => `<@${id}>`).join(', ')
      : '*(none set)*',
    inline: true,
  });

  fields.push({
    name: 'Location',
    value: `<#${liveEvent.locationChannelId}>`,
    inline: true,
  });
  fields.push({ name: 'Status', value: statusLabel, inline: true });

  // Schedule
  const scheduleTypeLabel = liveEvent.scheduleType === 'one-time' ? '📅 One-time' : '🔁 Recurring';
  fields.push({ name: 'Schedule Type', value: scheduleTypeLabel, inline: true });
  fields.push({ name: 'Creator', value: `<@${liveEvent.creatorId}>`, inline: true });

  if (liveEvent.scheduleType === 'one-time') {
    const startTs = discordTimestamp(liveEvent.oneTimeDate, liveEvent.oneTimeStartTime, 'F');
    const endTs = discordTimestamp(liveEvent.oneTimeDate, liveEvent.oneTimeEndTime, 't');
    fields.push({ name: 'Date & Time', value: `${startTs} – ${endTs}`, inline: false });
  } else {
    // Recurrence period
    const recStartTs = discordTimestamp(liveEvent.recurrenceStartDate, '00:00', 'D');
    const recEndTs = discordTimestamp(liveEvent.recurrenceEndDate, '00:00', 'D');
    fields.push({
      name: 'Recurrence Period',
      value: `${recStartTs} → ${recEndTs}`,
      inline: false,
    });

    // Weekly slots
    const slotLines = (liveEvent.slots ?? [])
      .map((s) => `${DAY_NAMES[s.dayOfWeek]} · ${s.startTime}–${s.endTime} UTC`)
      .join('\n');
    if (slotLines) {
      fields.push({ name: 'Weekly Schedule', value: slotLines, inline: false });
    }

    // Exceptions count
    const skipped = (liveEvent.skippedOccurrences ?? []).length;
    const rescheduled = (liveEvent.rescheduledOccurrences ?? []).length;
    if (skipped > 0 || rescheduled > 0) {
      const parts = [];
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (rescheduled > 0) parts.push(`${rescheduled} rescheduled`);
      fields.push({ name: 'Exceptions', value: parts.join(' · '), inline: true });
    }
  }

  // Next / current occurrence
  if (status === 'live') {
    const curr = getCurrentOccurrence(liveEvent, now);
    if (curr) {
      const endTs = discordTimestamp(curr.date, curr.endTime, 't');
      fields.push({ name: 'Ends at', value: endTs, inline: true });
    }
  }

  const next = getNextOccurrence(liveEvent, now);
  if (next) {
    const nextStart = discordTimestamp(next.date, next.startTime, 'F');
    const nextEnd = discordTimestamp(next.date, next.endTime, 't');
    const note = next.rescheduled ? ' *(rescheduled)*' : '';
    fields.push({
      name: 'Next Occurrence',
      value: `${nextStart} – ${nextEnd}${note}`,
      inline: false,
    });
  }

  if (liveEvent.eventPostLink) {
    fields.push({ name: 'Event Post', value: liveEvent.eventPostLink, inline: false });
  }

  return interaction.editReply({
    embeds: [
      {
        color: 0xe91e8c,
        title: `🩷 ${liveEvent.name}`,
        fields,
        footer: { text: `Live Event ID: ${liveEvent._id}` },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
