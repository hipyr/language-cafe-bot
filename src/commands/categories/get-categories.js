import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../../constants/index.js';
import Category from '../../models/category.js';
import channelLog, {
  generateInteractionCreateLogContent,
} from '../../service/utils/channel-log.js';

export default {
  data: new SlashCommandBuilder()
    .setName('get-categories')
    .setDescription('Get categories')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      channelLog(generateInteractionCreateLogContent(interaction));

      await interaction.deferReply({ ephemeral: true });

      const categories = await Category.find().sort({ createdAt: 1 });

      const description = categories.map((category) => category.message).join('\n\n');

      await interaction.editReply({
        embeds: [
          {
            color: COLORS.PRIMARY,
            title: 'Categories',
            description: `\`\`\`\n${description}\n\`\`\``,
          },
        ],
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  },
};
