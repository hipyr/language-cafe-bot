import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import liveEventCreate from '../../service/interaction/is-chat-input-command/live-event-create.js';
import liveEventEdit from '../../service/interaction/is-chat-input-command/live-event-edit.js';
import liveEventInfo from '../../service/interaction/is-chat-input-command/live-event-info.js';
import liveEventRemove from '../../service/interaction/is-chat-input-command/live-event-remove.js';
import liveEventSkip from '../../service/interaction/is-chat-input-command/live-event-skip.js';
import liveEventUnskip from '../../service/interaction/is-chat-input-command/live-event-unskip.js';
import liveEventReschedule from '../../service/interaction/is-chat-input-command/live-event-reschedule.js';
import channelLog, {
  generateInteractionCreateLogContent,
} from '../../service/utils/channel-log.js';
import { handleLiveEventNameAutocomplete } from '../../service/interaction/is-autocomplete/live-event-name-autocomplete.js';

const liveEventNameOption = (o) =>
  o.setName('event_name').setDescription('Live event name').setRequired(true).setAutocomplete(true);

const data = new SlashCommandBuilder()
  .setName('live-event')
  .setDescription('Manage live and recurring events')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)

  // ── /live-event create ─────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Create a one-time or recurring live event')
      .addStringOption((o) =>
        o.setName('name').setDescription('Event name').setRequired(true).setMaxLength(100),
      )
      .addChannelOption((o) =>
        o
          .setName('location')
          .setDescription('Channel where the event takes place (voice, stage, text, etc.)')
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('schedule_type')
          .setDescription('One-time or recurring schedule')
          .setRequired(true)
          .addChoices(
            { name: 'One-time', value: 'one-time' },
            { name: 'Recurring', value: 'recurring' },
          ),
      )
      .addUserOption((o) =>
        o.setName('host').setDescription('Primary host of the event').setRequired(false),
      )
      .addUserOption((o) =>
        o.setName('host_2').setDescription('Additional host').setRequired(false),
      )
      .addUserOption((o) =>
        o.setName('host_3').setDescription('Additional host').setRequired(false),
      ),
  )

  // ── /live-event edit ───────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Edit live event details or its recurring schedule')
      .addStringOption(liveEventNameOption)
      .addStringOption((o) =>
        o.setName('name').setDescription('New event name').setRequired(false).setMaxLength(100),
      )
      .addChannelOption((o) =>
        o.setName('location').setDescription('New location channel').setRequired(false),
      )
      .addUserOption((o) => o.setName('host').setDescription('New primary host').setRequired(false))
      .addUserOption((o) =>
        o.setName('host_2').setDescription('New additional host').setRequired(false),
      )
      .addUserOption((o) =>
        o.setName('host_3').setDescription('New additional host').setRequired(false),
      )
      .addStringOption((o) =>
        o
          .setName('event_post_link')
          .setDescription('New event post link (leave blank to clear)')
          .setRequired(false),
      ),
  )

  // ── /live-event info ───────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('info')
      .setDescription('Display live event details, schedule, and next occurrence')
      .addStringOption(liveEventNameOption),
  )

  // ── /live-event remove ─────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Permanently remove a live event and all its data')
      .addStringOption(liveEventNameOption),
  )

  // ── /live-event skip ───────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('skip')
      .setDescription('Cancel one or more scheduled occurrences without changing the schedule')
      .addStringOption(liveEventNameOption)
      .addStringOption((o) =>
        o
          .setName('date')
          .setDescription('Date of the occurrence to skip (YYYY-MM-DD)')
          .setRequired(true)
          .setMaxLength(10),
      )
      .addStringOption((o) =>
        o
          .setName('start_time')
          .setDescription('Start time of the slot (HH:MM) — required if multiple slots on same day')
          .setRequired(false)
          .setMaxLength(5),
      )
      .addStringOption((o) =>
        o
          .setName('end_date')
          .setDescription('Skip all occurrences from date through this date (YYYY-MM-DD)')
          .setRequired(false)
          .setMaxLength(10),
      ),
  )

  // ── /live-event unskip ─────────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('unskip')
      .setDescription('Restore a previously skipped occurrence')
      .addStringOption(liveEventNameOption)
      .addStringOption((o) =>
        o
          .setName('date')
          .setDescription('Date of the skipped occurrence to restore (YYYY-MM-DD)')
          .setRequired(true)
          .setMaxLength(10),
      )
      .addStringOption((o) =>
        o
          .setName('start_time')
          .setDescription('Start time of the slot (HH:MM) — required if multiple slots on same day')
          .setRequired(false)
          .setMaxLength(5),
      )
      .addStringOption((o) =>
        o
          .setName('end_date')
          .setDescription(
            'Restore all skipped occurrences from date through this date (YYYY-MM-DD)',
          )
          .setRequired(false)
          .setMaxLength(10),
      ),
  )

  // ── /live-event reschedule ─────────────────────────────────────────────────
  .addSubcommand((sub) =>
    sub
      .setName('reschedule')
      .setDescription('Move one scheduled occurrence to a different date/time')
      .addStringOption(liveEventNameOption)
      .addStringOption((o) =>
        o
          .setName('occurrence_date')
          .setDescription('Date of the scheduled occurrence you want to move (YYYY-MM-DD)')
          .setRequired(true)
          .setMaxLength(10),
      )
      .addStringOption((o) =>
        o
          .setName('new_date')
          .setDescription('New date for this occurrence (YYYY-MM-DD)')
          .setRequired(true)
          .setMaxLength(10),
      )
      .addStringOption((o) =>
        o
          .setName('new_start_time')
          .setDescription('New start time for this occurrence in UTC (HH:MM)')
          .setRequired(true)
          .setMaxLength(5),
      )
      .addStringOption((o) =>
        o
          .setName('new_end_time')
          .setDescription('New end time for this occurrence in UTC (HH:MM)')
          .setRequired(true)
          .setMaxLength(5),
          )
      .addStringOption((o) =>
        o
          .setName('occurrence_start_time')
          .setDescription('Start time of the occurrence you want to move (HH:MM, if needed)')
          .setRequired(false)
          .setMaxLength(5),
          ),
  );

export default {
  data,

  async execute(interaction) {
    if (interaction.isAutocomplete()) {
      return handleLiveEventNameAutocomplete(interaction);
    }

    channelLog(generateInteractionCreateLogContent(interaction));

    const sub = interaction.options.getSubcommand();

    if (sub === 'create') return liveEventCreate(interaction);
    if (sub === 'edit') return liveEventEdit(interaction);
    if (sub === 'info') return liveEventInfo(interaction);
    if (sub === 'remove') return liveEventRemove(interaction);
    if (sub === 'skip') return liveEventSkip(interaction);
    if (sub === 'unskip') return liveEventUnskip(interaction);
    if (sub === 'reschedule') return liveEventReschedule(interaction);

    return interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
  },
};
