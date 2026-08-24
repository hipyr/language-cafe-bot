import LiveEvent from '../../../models/live-event.js';
import channelLog, { generateSystemLogContent } from '../../utils/channel-log.js';
import { refreshEventCalendar } from '../../utils/event-calendar.js';
import {
  isValidDate,
  isValidTime,
  isScheduledOccurrence,
  isSkipped,
  isRescheduled,
  getOccurrencesBetween,
  discordTimestamp,
} from '../../utils/live-event-utils.js';
import { findByIdOrName } from '../../utils/event-utils.js';

/**
 * /live-event reschedule
 * Moves a single occurrence to a different date/time without changing the schedule.
 */
export default async function liveEventReschedule(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const eventName = interaction.options.getString('event_name');
  // Accept the old option names until the updated slash-command schema is deployed.
  const dateStr =
    interaction.options.getString('occurrence_date') ?? interaction.options.getString('date');
  const startTime =
    interaction.options.getString('occurrence_start_time') ??
    interaction.options.getString('start_time') ??
    null;
  const newDateStr = interaction.options.getString('new_date');
  const newStartTime = interaction.options.getString('new_start_time');
  const newEndTime = interaction.options.getString('new_end_time');

  if (!isValidDate(dateStr)) return interaction.editReply('❌ Invalid occurrence date. Use `YYYY-MM-DD`.');
  if (startTime && !isValidTime(startTime)) return interaction.editReply('❌ Invalid occurrence start time. Use `HH:MM`.');
  if (!isValidDate(newDateStr)) return interaction.editReply('❌ Invalid new date. Use `YYYY-MM-DD`.');
  if (!isValidTime(newStartTime)) return interaction.editReply('❌ Invalid new start time. Use `HH:MM`.');
  if (!isValidTime(newEndTime)) return interaction.editReply('❌ Invalid new end time. Use `HH:MM`.');
  if (newStartTime >= newEndTime) return interaction.editReply('❌ New start time must be before new end time.');

  const liveEvent = await findByIdOrName(LiveEvent, eventName);
  if (!liveEvent) {
    return interaction.editReply(`❌ No live event found with the name **${eventName}**.`);
  }

  let resolvedStartTime = startTime;
  if (!resolvedStartTime) {
    const occurrencesOnDate = getOccurrencesBetween(liveEvent, dateStr, dateStr);
    if (occurrencesOnDate.length === 0) {
      return interaction.editReply(`❌ No scheduled occurrence found on \`${dateStr}\`.`);
    }
    if (occurrencesOnDate.length > 1) {
      const slots = occurrencesOnDate.map((occurrence) => `\`${occurrence.startTime}\``).join(', ');
      return interaction.editReply(
        `❌ Multiple occurrences found on \`${dateStr}\` (${slots}). Provide the occurrence start time to identify which one to move.`,
      );
    }
    resolvedStartTime = occurrencesOnDate[0].originalStartTime ?? occurrencesOnDate[0].startTime;
  } else if (!isScheduledOccurrence(liveEvent, dateStr, resolvedStartTime)) {
    return interaction.editReply(`❌ No scheduled occurrence found on \`${dateStr}\` at \`${resolvedStartTime}\`.`);
  }

  if (isSkipped(liveEvent, dateStr, resolvedStartTime)) {
    return interaction.editReply(
      '❌ That occurrence is currently skipped. Unskip it before rescheduling.',
    );
  }

  // Replace existing reschedule if one exists for this slot
  if (isRescheduled(liveEvent, dateStr, resolvedStartTime)) {
    liveEvent.rescheduledOccurrences = liveEvent.rescheduledOccurrences.filter(
      (r) => !(r.originalDate === dateStr && r.originalStartTime === resolvedStartTime),
    );
  }

  liveEvent.rescheduledOccurrences.push({
    originalDate: dateStr,
    originalStartTime: resolvedStartTime,
    newDate: newDateStr,
    newStartTime,
    newEndTime,
    rescheduledBy: interaction.user.id,
  });

  await liveEvent.save();
  await refreshEventCalendar();

  channelLog(
    generateSystemLogContent('Live Event Occurrence Rescheduled', {
      event: `\`${liveEvent.name}\``,
      original: `\`${dateStr}\` at \`${resolvedStartTime}\``,
      replacement: `\`${newDateStr}\` \`${newStartTime}\`–\`${newEndTime}\``,
      by: `<@${interaction.user.id}>`,
    }),
  );

  const originalTs = discordTimestamp(dateStr, resolvedStartTime, 'F');
  const newTs = discordTimestamp(newDateStr, newStartTime, 'F');
  const newEndTs = discordTimestamp(newDateStr, newEndTime, 't');

  return interaction.editReply(
    `✅ Rescheduled one occurrence of **${liveEvent.name}**.\n\n` +
      `**Original:** ${originalTs}\n` +
      `**New time:** ${newTs} – ${newEndTs}\n\n` +
      'The recurring schedule is unchanged. Only this occurrence has been moved.',
  );
}
