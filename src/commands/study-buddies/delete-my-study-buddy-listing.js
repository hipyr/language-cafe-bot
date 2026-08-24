import { SlashCommandBuilder, userMention } from 'discord.js';
import { COLORS } from '../../constants/index.js';
import StudyBuddy from '../../models/study-buddy.js';
import channelLog, {
  generateInteractionCreateLogContent,
} from '../../service/utils/channel-log.js';

export default {
  data: new SlashCommandBuilder()
    .setName('delete-my-study-buddy-listing')
    .setDescription('Delete study-buddy listing'),

  async execute(interaction) {
    channelLog(generateInteractionCreateLogContent(interaction));

    await interaction.deferReply({ ephemeral: true });

    await StudyBuddy.deleteOne({
      id: interaction.user.id,
    });

    const content = `${userMention(
      interaction.user.id,
    )}, your study buddy listing was removed from our database.`;

    await interaction.editReply({
      embeds: [
        {
          color: COLORS.PRIMARY,
          title: 'Delete Study Buddy Listing',
          description: content,
        },
      ],
    });
  },
};
