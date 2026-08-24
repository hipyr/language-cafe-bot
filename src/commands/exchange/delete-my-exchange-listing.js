import { SlashCommandBuilder, userMention } from 'discord.js';
import { COLORS } from '../../constants/index.js';
import ExchangePartner from '../../models/ExchangePartner.js';
import channelLog, {
  generateInteractionCreateLogContent,
} from '../../service/utils/channel-log.js';

export default {
  data: new SlashCommandBuilder()
    .setName('delete-my-exchange-listing')
    .setDescription('Delete exchange partner listing'),

  async execute(interaction) {
    channelLog(generateInteractionCreateLogContent(interaction));

    await interaction.deferReply({ ephemeral: true });

    await ExchangePartner.deleteOne({ id: interaction.user.id });

    const content = `${userMention(
      interaction.user.id,
    )}, your language exchange partner listing was removed from our database.`;

    await interaction.editReply({
      embeds: [
        {
          color: COLORS.PRIMARY,
          title: 'Delete Language Exchange Partner Listing',
          description: content,
        },
      ],
    });
  },
};
