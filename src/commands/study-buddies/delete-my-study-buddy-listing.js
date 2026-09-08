import { SlashCommandBuilder, userMention } from 'discord.js';
import { COLORS } from '../../constants/index.js';
import StudyBuddy from '../../models/study-buddy.js';
import channelLog, {
  generateInteractionCreateLogContent,
} from '../../service/utils/channel-log.js';
import deleteListingMessage from '../../service/utils/delete-listing-message.js';

export default {
  data: new SlashCommandBuilder()
    .setName('delete-my-study-buddy-listing')
    .setDescription('Delete study-buddy listing'),

  async execute(interaction) {
    channelLog(generateInteractionCreateLogContent(interaction));

    await interaction.deferReply({ ephemeral: true });

    const listing = await StudyBuddy.findOneAndDelete({ id: interaction.user.id });
    await deleteListingMessage(interaction.client, listing);

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
