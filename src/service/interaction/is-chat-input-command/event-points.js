import Event from '../../../models/event.js';
import EventParticipant from '../../../models/event-participant.js';
import channelLog, { generateSystemLogContent } from '../../utils/channel-log.js';
import {
  findByIdOrName,
  incrementParticipantTotals,
  updateLiveLeaderboard,
} from '../../utils/event-utils.js';
import { hasManageEventsPermission } from '../../utils/permissions.js';

async function findEventByName(name) {
  return findByIdOrName(Event, name);
}

/**
 * /event points add
 * Manually adds points to a participant. Capped at maxPoints.
 */
export async function eventPointsAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!hasManageEventsPermission(interaction)) {
    return interaction.editReply('❌ You need the Manage Events permission to change points.');
  }

  const eventName = interaction.options.getString('event_name');
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  const event = await findEventByName(eventName);
  if (!event) return interaction.editReply(`❌ No event found with the name **${eventName}**.`);

  if (!event.pointsPerSubmission) {
    return interaction.editReply(`❌ **${event.name}** has no points configured.`);
  }

  const participant = await EventParticipant.findOne({
    eventId: event._id.toString(),
    userId: targetUser.id,
  });

  const before = participant?.points ?? 0;
  const actual = Math.min(amount, Math.max(0, event.maxPoints - before));
  const updatedParticipant = await incrementParticipantTotals({
    eventId: event._id.toString(),
    userId: targetUser.id,
    points: actual,
  });

  channelLog(
    generateSystemLogContent('Event Points Added (Manual)', {
      event: `\`${event.name}\``,
      user: `<@${targetUser.id}>`,
      added: `\`+${actual}\``,
      total: `\`${updatedParticipant.points}/${event.maxPoints}\``,
      moderator: `<@${interaction.user.id}>`,
    }),
  );

  await updateLiveLeaderboard(event);

  return interaction.editReply(
    `✅ Added **${actual}** points to <@${targetUser.id}> for **${event.name}**.\n` +
      `New total: **${updatedParticipant.points}** / ${event.maxPoints}`,
  );
}

/**
 * /event points remove
 * Manually removes points from a participant. Floors at 0.
 */
export async function eventPointsRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!hasManageEventsPermission(interaction)) {
    return interaction.editReply('❌ You need the Manage Events permission to change points.');
  }

  const eventName = interaction.options.getString('event_name');
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  const event = await findEventByName(eventName);
  if (!event) return interaction.editReply(`❌ No event found with the name **${eventName}**.`);

  if (!event.pointsPerSubmission) {
    return interaction.editReply(`❌ **${event.name}** has no points configured.`);
  }

  const participant = await EventParticipant.findOne({
    eventId: event._id.toString(),
    userId: targetUser.id,
  });

  if (!participant) {
    return interaction.editReply(`ℹ️ <@${targetUser.id}> has no recorded points for this event.`);
  }

  const before = participant.points;
  const actual = Math.min(amount, before);
  const updatedParticipant = await EventParticipant.findOneAndUpdate(
    { eventId: event._id.toString(), userId: targetUser.id },
    { $inc: { points: -actual } },
    { new: true },
  );

  channelLog(
    generateSystemLogContent('Event Points Removed (Manual)', {
      event: `\`${event.name}\``,
      user: `<@${targetUser.id}>`,
      removed: `\`-${actual}\``,
      total: `\`${updatedParticipant.points}/${event.maxPoints}\``,
      moderator: `<@${interaction.user.id}>`,
    }),
  );

  await updateLiveLeaderboard(event);

  return interaction.editReply(
    `✅ Removed **${actual}** points from <@${targetUser.id}> for **${event.name}**.\n` +
      `New total: **${updatedParticipant.points}** / ${event.maxPoints}`,
  );
}
