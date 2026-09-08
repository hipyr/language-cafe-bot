import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import LiveEvent from '../../../models/live-event.js';
import channelLog, { generateSystemLogContent } from '../../utils/channel-log.js';
import { refreshEventCalendar } from '../../utils/event-calendar.js';
import { findByIdOrName } from '../../utils/event-utils.js';
import { hasManageEventsPermission } from '../../utils/permissions.js';

/**
 * /live-event remove
 * Shows a confirmation prompt before permanently deleting a live event.
 */
export default async function liveEventRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!hasManageEventsPermission(interaction)) {
    return interaction.editReply('❌ You need the Manage Events permission to remove live events.');
  }

  const eventName = interaction.options.getString('event_name');

  const liveEvent = await findByIdOrName(LiveEvent, eventName);

  if (!liveEvent) {
    return interaction.editReply(`❌ No live event found with the name **${eventName}**.`);
  }

  const eventId = liveEvent._id.toString();
  const skipped = (liveEvent.skippedOccurrences ?? []).length;
  const rescheduled = (liveEvent.rescheduledOccurrences ?? []).length;
  const exceptionNote =
    skipped + rescheduled > 0
      ? `\n${skipped} skipped and ${rescheduled} rescheduled occurrence(s) will also be removed.`
      : '';

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`live-event-remove-confirm:${eventId}`)
      .setLabel('Yes, delete permanently')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`live-event-remove-cancel:${eventId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  return interaction.editReply({
    content:
      `⚠️ **Permanently delete live event "${liveEvent.name}"?**\n` +
      `This will remove the event, its schedule, and all occurrence data.${exceptionNote}\n` +
      'This action **cannot be undone**.',
    components: [confirmRow],
  });
}

export async function handleLiveEventRemoveConfirm(interaction) {
  await interaction.deferUpdate();

  if (!hasManageEventsPermission(interaction)) {
    return interaction.editReply({
      content: '❌ You need the Manage Events permission to remove live events.',
      components: [],
    });
  }

  const eventId = interaction.customId.split(':')[1];

  let liveEvent;
  try {
    liveEvent = await LiveEvent.findById(eventId);
  } catch {
    return interaction.editReply({ content: '❌ Invalid event ID.', components: [] });
  }

  if (!liveEvent) {
    return interaction.editReply({ content: '❌ Live event not found.', components: [] });
  }

  await LiveEvent.findByIdAndDelete(eventId);

  channelLog(
    generateSystemLogContent('Live Event Removed', {
      event: `\`${liveEvent.name}\``,
      id: `\`${eventId}\``,
      removedBy: `<@${interaction.user.id}>`,
    }),
  );

  await refreshEventCalendar();

  return interaction.editReply({
    content: `🗑️ Live Event **${liveEvent.name}** and all its data have been permanently deleted.`,
    components: [],
  });
}

export async function handleLiveEventRemoveCancel(interaction) {
  await interaction.deferUpdate();
  return interaction.editReply({ content: '✅ Removal cancelled.', components: [] });
}
