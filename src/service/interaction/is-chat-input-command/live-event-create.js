import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import LiveEvent from '../../../models/live-event.js';
import channelLog, { generateSystemLogContent } from '../../utils/channel-log.js';
import { refreshEventCalendar } from '../../utils/event-calendar.js';
import {
  computeLiveEventStatus,
  parseOneTimeScheduleInput,
  parseRecurringScheduleInput,
} from '../../utils/live-event-utils.js';

/**
 * /live-event create
 *
 * Slash command collects: name, location (channel picker), schedule_type, up to 3 hosts.
 * A modal then collects: schedule dates/times, and optional event post link.
 *
 * The customId carries: name, locationChannelId, scheduleType, hostIds (comma-separated).
 * Event post link goes in the modal so URLs don't blow the 100-char customId limit.
 */
export default async function liveEventCreate(interaction) {
  const name = interaction.options.getString('name');
  const locationChannel = interaction.options.getChannel('location');
  const scheduleType = interaction.options.getString('schedule_type');
  const host1 = interaction.options.getUser('host');
  const host2 = interaction.options.getUser('host_2');
  const host3 = interaction.options.getUser('host_3');

  const hostIds = [host1, host2, host3].filter(Boolean).map((u) => u.id);

  // Keep customId short: encode only what can't go in the modal
  const payload = [
    encodeURIComponent(name),
    locationChannel.id,
    scheduleType,
    hostIds.join(','),
  ].join('\x01');

  const customId = `live-event-create-modal\x00${payload}`;

  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(
      scheduleType === 'one-time'
        ? 'Create Live Event — Date & Time'
        : 'Create Live Event — Schedule',
    );

  // Field 1: event post link (optional) — in modal so URLs don't hit customId limit
  const postLinkInput = new TextInputBuilder()
    .setCustomId('event_post_link')
    .setLabel('Event post link (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://discord.com/channels/...')
    .setRequired(false)
    .setMaxLength(500);

  if (scheduleType === 'one-time') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(postLinkInput),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('date')
          .setLabel('Date in UTC (YYYY-MM-DD)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('2026-08-28')
          .setRequired(true)
          .setMaxLength(10),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('start_time')
          .setLabel('Start time in UTC (HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('18:00')
          .setRequired(true)
          .setMaxLength(5),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('end_time')
          .setLabel('End time in UTC (HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('19:00')
          .setRequired(true)
          .setMaxLength(5),
      ),
    );
  } else {
    modal.addComponents(
      new ActionRowBuilder().addComponents(postLinkInput),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('recurrence_range')
          .setLabel('Recurrence range (YYYY-MM-DD to YYYY-MM-DD)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('2026-08-01 to 2026-12-31')
          .setRequired(true)
          .setMaxLength(25),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('slots')
          .setLabel('Weekly slots — one per line (Day HH:MM-HH:MM)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Tuesday 18:00-19:00\nSaturday 10:00-11:00')
          .setRequired(true)
          .setMaxLength(500),
      ),
    );
  }

  await interaction.showModal(modal);
}

// ─── Modal submit ─────────────────────────────────────────────────────────────

export async function handleLiveEventCreateModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const [, payload] = interaction.customId.split('\x00');
  const [encodedName, locationChannelId, scheduleType, hostIdsStr] = payload.split('\x01');

  const name = decodeURIComponent(encodedName);
  const hostIds = hostIdsStr ? hostIdsStr.split(',').filter(Boolean) : [];
  const eventPostLink = interaction.fields.getTextInputValue('event_post_link').trim() || null;

  let scheduleData;

  if (scheduleType === 'one-time') {
    const date = interaction.fields.getTextInputValue('date').trim();
    const startTime = interaction.fields.getTextInputValue('start_time').trim();
    const endTime = interaction.fields.getTextInputValue('end_time').trim();

    const result = parseOneTimeScheduleInput(date, `${startTime}-${endTime}`);
    if (result.error) return interaction.editReply(`❌ ${result.error}`);
    scheduleData = result;
  } else {
    const recurrenceRaw = interaction.fields.getTextInputValue('recurrence_range').trim();
    const slotsRaw = interaction.fields.getTextInputValue('slots').trim();

    const result = parseRecurringScheduleInput(recurrenceRaw, slotsRaw);
    if (result.error) return interaction.editReply(`❌ ${result.error}`);
    scheduleData = result;
  }

  const doc = {
    name,
    locationChannelId,
    hostIds,
    eventPostLink,
    scheduleType,
    creatorId: interaction.user.id,
  };

  if (scheduleType === 'one-time') {
    doc.oneTimeDate = scheduleData.date;
    doc.oneTimeStartTime = scheduleData.startTime;
    doc.oneTimeEndTime = scheduleData.endTime;
  } else {
    doc.recurrenceStartDate = scheduleData.recurrenceStartDate;
    doc.recurrenceEndDate = scheduleData.recurrenceEndDate;
    doc.slots = scheduleData.slots;
  }

  const liveEvent = new LiveEvent(doc);
  liveEvent.status = computeLiveEventStatus(liveEvent);
  await liveEvent.save();

  await refreshEventCalendar();

  channelLog(
    generateSystemLogContent('Live Event Created', {
      event: `\`${name}\``,
      id: `\`${liveEvent._id}\``,
      scheduleType: `\`${scheduleType}\``,
      location: `<#${locationChannelId}>`,
      hosts: hostIds.length ? hostIds.map((id) => `<@${id}>`).join(', ') : '*(none)*',
      creator: `<@${interaction.user.id}>`,
    }),
  );

  const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const scheduleLines =
    scheduleType === 'one-time'
      ? `📅 ${scheduleData.date} · ${scheduleData.startTime}–${scheduleData.endTime} UTC`
      : [
          `📅 ${scheduleData.recurrenceStartDate} → ${scheduleData.recurrenceEndDate}`,
          ...scheduleData.slots.map(
            (s) => `  • ${DAY_ABBR[s.dayOfWeek]} ${s.startTime}–${s.endTime} UTC`,
          ),
        ].join('\n');

  const hostLine = hostIds.length
    ? `**Host(s):** ${hostIds.map((id) => `<@${id}>`).join(', ')}\n`
    : '';

  return interaction.editReply(
    `✅ Live Event **${name}** created (ID: \`${liveEvent._id}\`).\n` +
      hostLine +
      `**Location:** <#${locationChannelId}>\n` +
      scheduleLines,
  );
}
