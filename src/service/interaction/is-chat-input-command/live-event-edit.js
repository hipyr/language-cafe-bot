import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import LiveEvent from '../../../models/live-event.js';
import channelLog, { generateSystemLogContent } from '../../utils/channel-log.js';
import { refreshEventCalendar } from '../../utils/event-calendar.js';
import {
  computeLiveEventStatus,
  parseOneTimeScheduleInput,
  parseRecurringScheduleInput,
} from '../../utils/live-event-utils.js';
import { findByIdOrName } from '../../utils/event-utils.js';

/**
 * /live-event edit
 *
 * Non-schedule fields (name, location, hosts, event_post_link) are applied directly
 * from slash options before the modal opens.
 * Schedule fields are collected via a pre-filled modal.
 *
 * customId carries: eventId only (applied changes tracked in DB before modal shown)
 */
export default async function liveEventEdit(interaction) {
  const eventName = interaction.options.getString('event_name');

  const liveEvent = await findByIdOrName(LiveEvent, eventName);

  if (!liveEvent) {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply(`❌ No live event found with the name **${eventName}**.`);
  }

  // Apply simple field changes immediately before showing modal
  const newName = interaction.options.getString('name');
  const newLocationChannel = interaction.options.getChannel('location');
  const host1 = interaction.options.getUser('host');
  const host2 = interaction.options.getUser('host_2');
  const host3 = interaction.options.getUser('host_3');
  const newHostIds = [host1, host2, host3].filter(Boolean).map((u) => u.id);
  // getString returns null if not provided, empty string if provided but blank
  const postLinkOption = interaction.options.getString('event_post_link');

  if (newName) liveEvent.name = newName;
  if (newLocationChannel) liveEvent.locationChannelId = newLocationChannel.id;
  if (newHostIds.length > 0) liveEvent.hostIds = newHostIds;
  if (postLinkOption !== null) liveEvent.eventPostLink = postLinkOption || null;

  await liveEvent.save();

  // Now show the modal for schedule editing
  const customId = `live-event-edit-modal\x00${liveEvent._id.toString()}`;

  const modal = new ModalBuilder().setCustomId(customId).setTitle('Edit Live Event — Schedule');

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (liveEvent.scheduleType === 'one-time') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('date')
          .setLabel('Date in UTC (YYYY-MM-DD)')
          .setStyle(TextInputStyle.Short)
          .setValue(liveEvent.oneTimeDate ?? '')
          .setRequired(true)
          .setMaxLength(10),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('start_time')
          .setLabel('Start time in UTC (HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setValue(liveEvent.oneTimeStartTime ?? '')
          .setRequired(true)
          .setMaxLength(5),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('end_time')
          .setLabel('End time in UTC (HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setValue(liveEvent.oneTimeEndTime ?? '')
          .setRequired(true)
          .setMaxLength(5),
      ),
    );
  } else {
    const currentRange =
      liveEvent.recurrenceStartDate && liveEvent.recurrenceEndDate
        ? `${liveEvent.recurrenceStartDate} to ${liveEvent.recurrenceEndDate}`
        : '';
    const currentSlots = (liveEvent.slots ?? [])
      .map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}-${s.endTime}`)
      .join('\n');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('recurrence_range')
          .setLabel('Recurrence range (YYYY-MM-DD to YYYY-MM-DD)')
          .setStyle(TextInputStyle.Short)
          .setValue(currentRange)
          .setRequired(true)
          .setMaxLength(25),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('slots')
          .setLabel('Weekly slots — one per line (Day HH:MM-HH:MM)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentSlots)
          .setRequired(true)
          .setMaxLength(500),
      ),
    );
  }

  return interaction.showModal(modal);
}

// ─── Modal submit ─────────────────────────────────────────────────────────────

export async function handleLiveEventEditModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const [, eventId] = interaction.customId.split('\x00');

  let liveEvent;
  try {
    liveEvent = await LiveEvent.findById(eventId);
  } catch {
    return interaction.editReply('❌ Invalid event ID.');
  }
  if (!liveEvent) return interaction.editReply('❌ Live event not found.');

  // Apply schedule changes from modal
  if (liveEvent.scheduleType === 'one-time') {
    const date = interaction.fields.getTextInputValue('date').trim();
    const startTime = interaction.fields.getTextInputValue('start_time').trim();
    const endTime = interaction.fields.getTextInputValue('end_time').trim();

    const result = parseOneTimeScheduleInput(date, `${startTime}-${endTime}`);
    if (result.error) return interaction.editReply(`❌ ${result.error}`);

    liveEvent.oneTimeDate = result.date;
    liveEvent.oneTimeStartTime = result.startTime;
    liveEvent.oneTimeEndTime = result.endTime;
  } else {
    const recurrenceRaw = interaction.fields.getTextInputValue('recurrence_range').trim();
    const slotsRaw = interaction.fields.getTextInputValue('slots').trim();

    const result = parseRecurringScheduleInput(recurrenceRaw, slotsRaw);
    if (result.error) return interaction.editReply(`❌ ${result.error}`);

    liveEvent.recurrenceStartDate = result.recurrenceStartDate;
    liveEvent.recurrenceEndDate = result.recurrenceEndDate;
    liveEvent.slots = result.slots;
  }

  liveEvent.status = computeLiveEventStatus(liveEvent);
  await liveEvent.save();

  await refreshEventCalendar();

  channelLog(
    generateSystemLogContent('Live Event Edited', {
      event: `\`${liveEvent.name}\``,
      id: `\`${eventId}\``,
      editor: `<@${interaction.user.id}>`,
    }),
  );

  return interaction.editReply(`✅ **${liveEvent.name}** updated successfully.`);
}
