import { EmbedBuilder } from 'discord.js';
import Event from '../../../models/event.js';
import LiveEvent from '../../../models/live-event.js';
import channelLog, { generateInteractionCreateLogContent } from '../../utils/channel-log.js';
import { buildCalendarEmbed } from '../../utils/event-utils.js';
import {
  computeLiveEventStatus,
  formatScheduleSummary,
  getNextOccurrence,
  discordTimestamp,
} from '../../utils/live-event-utils.js';

function buildLiveEventCalendarEmbed(liveEvent) {
  const status = computeLiveEventStatus(liveEvent);
  const nextOccurrence = getNextOccurrence(liveEvent);
  const hostText = liveEvent.hostIds?.length
    ? liveEvent.hostIds.map((id) => `<@${id}>`).join(', ')
    : 'Not specified';
  const title = liveEvent.eventPostLink
    ? `[🩷 ${liveEvent.name}](${liveEvent.eventPostLink})`
    : `🩷 ${liveEvent.name}`;
  const nextText = nextOccurrence
    ? `${discordTimestamp(nextOccurrence.date, nextOccurrence.startTime, 'F')} → ${discordTimestamp(nextOccurrence.date, nextOccurrence.endTime, 't')}`
    : 'No upcoming occurrence';

  return new EmbedBuilder()
    .setColor(0xed77a8)
    .setTitle(title)
    .addFields(
      { name: 'Frequency', value: liveEvent.scheduleType === 'recurring' ? 'Recurring' : 'One-time', inline: true },
      { name: 'Status', value: status, inline: true },
      { name: 'Host(s)', value: hostText, inline: true },
      { name: 'Location', value: `<#${liveEvent.locationChannelId}>`, inline: true },
      { name: 'Schedule', value: formatScheduleSummary(liveEvent), inline: false },
      { name: 'Next occurrence', value: nextText, inline: false },
    );
}

/**
 * /calendar
 * Displays all upcoming and active events.
 */
export default async function eventCalendar(interaction) {
  await interaction.deferReply({ ephemeral: false });

  channelLog(generateInteractionCreateLogContent(interaction));

  const events = await Event.find({
    status: { $in: ['pending', 'active'] },
  }).sort({ startDate: 1 });

  const liveEvents = await LiveEvent.find({ status: { $in: ['upcoming', 'live'] } });
  const liveEmbeds = liveEvents.map((liveEvent) => buildLiveEventCalendarEmbed(liveEvent));

  const embeds = [...events.map((event) => buildCalendarEmbed(event)), ...liveEmbeds];

  if (embeds.length === 0) {
    return interaction.editReply('📅 No upcoming or active events right now. Check back later!');
  }

  // Discord allows up to 10 embeds per message
  if (embeds.length <= 10) {
    return interaction.editReply({ content: '## 📅 Event Calendar', embeds });
  }

  // More than 10 — send in batches
  await interaction.editReply({ content: '## 📅 Event Calendar', embeds: embeds.slice(0, 10) });
  for (let i = 10; i < embeds.length; i += 10) {
    await interaction.followUp({ embeds: embeds.slice(i, i + 10) });
  }

  return undefined;
}
