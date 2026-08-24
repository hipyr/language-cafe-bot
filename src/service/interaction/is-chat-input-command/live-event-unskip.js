import LiveEvent from '../../../models/live-event.js';
import channelLog, { generateSystemLogContent } from '../../utils/channel-log.js';
import { refreshEventCalendar } from '../../utils/event-calendar.js';
import {
  isValidDate,
  isValidTime,
  computeLiveEventStatus,
  discordTimestamp,
} from '../../utils/live-event-utils.js';
import { findByIdOrName } from '../../utils/event-utils.js';

function getLiveEventName(interaction) {
  const selectedName = interaction.options.getString('event_name');
  return selectedName.replace(/\s+\[(?:Recurring|One-time)\s+·\s+[^\]]+\]$/, '');
}

/**
 * /live-event unskip
 * Restores one or more previously skipped occurrences.
 */
export default async function liveEventUnskip(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const eventName = getLiveEventName(interaction);
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

  if ((liveEvent.skippedOccurrences ?? []).length === 0) {
    return interaction.editReply(`ℹ️ **${liveEvent.name}** has no skipped occurrences.`);
  }

  const rescheduledByOriginal = new Map(
    (liveEvent.rescheduledOccurrences ?? []).map((rescheduled) => [
      `${rescheduled.originalDate}|${rescheduled.originalStartTime}`,
      rescheduled,
    ]),
  );

  const matchesRequestedOccurrence = (skipped) => {
    const rescheduled = rescheduledByOriginal.get(`${skipped.date}|${skipped.startTime}`);
    const dateMatches = (candidateDate) =>
      candidateDate === skipped.date || candidateDate === rescheduled?.newDate;
    const timeMatches = (candidateStartTime) =>
      !startTime ||
      candidateStartTime === skipped.startTime ||
      candidateStartTime === rescheduled?.newStartTime;

    return dateMatches(dateStr) && timeMatches(startTime);
  };

  // Find matching skipped entries
  let targets;
  if (endDateStr) {
    targets = liveEvent.skippedOccurrences.filter(
      (s) => {
        const rescheduled = rescheduledByOriginal.get(`${s.date}|${s.startTime}`);
        const candidateDates = [s.date, rescheduled?.newDate].filter(Boolean);
        return (
          candidateDates.some(
            (candidateDate) => candidateDate >= dateStr && candidateDate <= endDateStr,
          ) &&
          (!startTime || s.startTime === startTime || rescheduled?.newStartTime === startTime)
        );
      },
    );
  } else {
    targets = liveEvent.skippedOccurrences.filter(matchesRequestedOccurrence);
  }

  if (targets.length === 0) {
    return interaction.editReply('❌ No skipped occurrences found matching the given criteria.');
  }

  const targetKeys = new Set(targets.map((s) => `${s.date}|${s.startTime}`));
  liveEvent.skippedOccurrences = liveEvent.skippedOccurrences.filter(
    (s) => !targetKeys.has(`${s.date}|${s.startTime}`),
  );

  liveEvent.status = computeLiveEventStatus(liveEvent);
  await liveEvent.save();

  await refreshEventCalendar();

  channelLog(
    generateSystemLogContent('Live Event Occurrences Unskipped', {
      event: `\`${liveEvent.name}\``,
      count: `\`${targets.length}\``,
      by: `<@${interaction.user.id}>`,
    }),
  );

  const lines = targets
    .slice(0, 10)
    .map((s) => `  • ${discordTimestamp(s.date, s.startTime, 'F')}`)
    .join('\n');
  const overflow = targets.length > 10 ? `\n  *(and ${targets.length - 10} more)*` : '';

  return interaction.editReply(
    `✅ Restored **${targets.length}** skipped occurrence${targets.length === 1 ? '' : 's'} of **${liveEvent.name}**.\n${lines}${overflow}`,
  );
}
