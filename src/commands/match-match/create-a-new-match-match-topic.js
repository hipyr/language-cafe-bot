import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import createANewMatchMatchTopic from '../../service/interaction/is-chat-input-command/create-a-new-match-match-topic.js';

export default {
  data: new SlashCommandBuilder()
    .setName('create-a-new-match-match-topic')
    .setDescription('Create one or more match match topics (one per line)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    createANewMatchMatchTopic(interaction);
  },
};
