import { SlashCommandBuilder, userMention } from 'discord.js';
import { COLORS } from '../../constants/index.js';
import ExchangePartner from '../../models/ExchangePartner.js';
import channelLog, {
  generateInteractionCreateLogContent,
} from '../../service/utils/channel-log.js';
import deleteListingMessage from '../../service/utils/delete-listing-message.js';

export default {
  data: new SlashCommandBuilder()
    .setName('delete-my-exchange-listing')
    .setDescription('Delete exchange partner listing'),

  async execute(interaction) {
    channelLog(generateInteractionCreateLogContent(interaction));

    await interaction.deferReply({ ephemeral: true });

    const listing = await ExchangePartner.findOneAndDelete({ id: interaction.user.id });
    await deleteListingMessage(interaction.client, listing);

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
