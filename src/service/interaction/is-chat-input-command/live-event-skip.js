import LiveEvent from '../../../models/live-event.js';
import channelLog, { generateSystemLogContent } from '../../utils/channel-log.js';
import { refreshEventCalendar } from '../../utils/event-calendar.js';
import {
  isValidDate,
  isValidTime,
  isSkipped,
  getOccurrencesBetween,
  discordTimestamp,
} from '../../utils/live-event-utils.js';
import { findByIdOrName } from '../../utils/event-utils.js';

/**
 * /live-event skip
 * Cancels one or more occurrences without modifying the recurring schedule.
 */
export default async function liveEventSkip(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const eventName = interaction.options.getString('event_name');
  const dateStr = interaction.options.getString('date');
  const startTime = interaction.options.getString('start_time') ?? null;
  const endDateStr = interaction.options.getString('end_date') ?? null;

  if (!isValidDate(dateStr)) {
    return interaction.editReply('❌ Invalid date. Use format `YYYY-MM-DD`.');
  }
  if (startTime && !isValidTime(startTime)) {
    return interaction.editReply('❌ Invalid start time. Use format `HH:MM`.');
  }
  if (endDateStr) {
    if (!isValidDate(endDateStr)) {
      return interaction.editReply('❌ Invalid end date. Use format `YYYY-MM-DD`.');
    }
    if (endDateStr < dateStr) {
      return interaction.editReply('❌ End date must be on or after the start date.');
    }
  }

  const liveEvent = await findByIdOrName(LiveEvent, eventName);
  if (!liveEvent) {
    return interaction.editReply(`❌ No live event found with the name **${eventName}**.`);
  }

  // Collect targets
  let targets;

  if (endDateStr) {
    targets = getOccurrencesBetween(liveEvent, dateStr, endDateStr);
    if (startTime) targets = targets.filter((o) => o.startTime === startTime);
    if (targets.length === 0) {
      return interaction.editReply(
        `❌ No scheduled occurrences found between \`${dateStr}\` and \`${endDateStr}\`${startTime ? ` at \`${startTime}\`` : ''}.`,
      );
    }
  } else {
    const onDate = getOccurrencesBetween(liveEvent, dateStr, dateStr);
    const movedToDate = (liveEvent.rescheduledOccurrences ?? [])
      .filter(
        (rescheduled) =>
          rescheduled.newDate === dateStr &&
          (!startTime || rescheduled.newStartTime === startTime),
      )
      .map((rescheduled) => ({
        date: rescheduled.newDate,
        startTime: rescheduled.newStartTime,
        originalDate: rescheduled.originalDate,
        originalStartTime: rescheduled.originalStartTime,
      }));
    const movedFromDate = (liveEvent.rescheduledOccurrences ?? [])
      .filter(
        (rescheduled) =>
          rescheduled.originalDate === dateStr &&
          (!startTime || rescheduled.originalStartTime === startTime),
      )
      .map((rescheduled) => ({
        date: rescheduled.newDate,
        startTime: rescheduled.newStartTime,
        originalDate: rescheduled.originalDate,
        originalStartTime: rescheduled.originalStartTime,
      }));

    const candidates = [...onDate, ...movedToDate, ...movedFromDate].filter(
      (occurrence, index, all) =>
        all.findIndex(
          (candidate) =>
            (candidate.originalDate ?? candidate.date) ===
              (occurrence.originalDate ?? occurrence.date) &&
            (candidate.originalStartTime ?? candidate.startTime) ===
              (occurrence.originalStartTime ?? occurrence.startTime),
        ) === index,
    );

    if (candidates.length === 0) {
      return interaction.editReply(
        `❌ No scheduled occurrence on \`${dateStr}\`. Check the date falls within the recurrence period.`,
      );
    }
    if (!startTime && candidates.length > 1) {
      const slots = candidates.map((o) => `\`${o.startTime}\``).join(', ');
      return interaction.editReply(
        `❌ Multiple slots on \`${dateStr}\` (${slots}). Provide \`start_time\` to specify which one.`,
      );
    }
    targets = startTime ? candidates.filter((o) => o.startTime === startTime) : candidates;
    if (targets.length === 0) {
      return interaction.editReply(
        `❌ No occurrence found for \`${dateStr}\` at \`${startTime}\`.`,
      );
    }
  }

  let newlySkipped = 0;
  let alreadySkipped = 0;

  for (const occ of targets) {
    const originalDate = occ.originalDate ?? occ.date;
    const originalStartTime = occ.originalStartTime ?? occ.startTime;

    if (isSkipped(liveEvent, originalDate, originalStartTime)) {
      alreadySkipped++;
      continue;
    }
    liveEvent.skippedOccurrences.push({
      date: originalDate,
      startTime: originalStartTime,
      skippedBy: interaction.user.id,
    });
    newlySkipped++;
  }

  if (newlySkipped === 0) {
    return interaction.editReply(
      `ℹ️ ${alreadySkipped === 1 ? 'That occurrence was' : 'All those occurrences were'} already skipped.`,
    );
  }

  await liveEvent.save();
  await refreshEventCalendar();

  channelLog(
    generateSystemLogContent('Live Event Occurrences Skipped', {
      event: `\`${liveEvent.name}\``,
      count: `\`${newlySkipped}\``,
      by: `<@${interaction.user.id}>`,
    }),
  );

  const lines = targets
    .slice(0, 10)
    .map((o) => `  • ${discordTimestamp(o.date, o.startTime, 'F')}`)
    .join('\n');
  const overflow = targets.length > 10 ? `\n  *(and ${targets.length - 10} more)*` : '';

  let reply = `✅ Skipped **${newlySkipped}** occurrence${newlySkipped === 1 ? '' : 's'} of **${liveEvent.name}**.`;
  if (alreadySkipped > 0) reply += ` *(${alreadySkipped} already skipped)*`;
  if (lines) reply += `\n${lines}${overflow}`;

  return interaction.editReply(reply);
}
