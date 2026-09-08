import config from '../../../config/index.js';
import { COLORS } from '../../../constants/index.js';
import Queue from '../../../models/queue.js';
import { getCurrentQueueDescription } from './get-queue.js';

export default async (interaction) => {
  try {
    const userId = interaction.user.id;
    const { channel } = interaction;

    await interaction.deferReply({ ephemeral: true });

    const isExist = await Queue.findOne({ id: userId });

    if (!isExist) {
      await interaction.editReply({
        embeds: [
          {
            color: COLORS.PRIMARY,
            description: 'You are not in the queue.',
          },
        ],
      });
      return;
    }

    await Queue.deleteOne({ id: userId });

    await interaction.editReply({
      embeds: [
        {
          color: COLORS.PRIMARY,
          description: `You have been removed from the queue.\nFeel free to rejoin at any time using </add-me-to-queue:${config.ADD_ME_TO_QUEUE_COMMAND_ID}>.`,
        },
      ],
    });

    await channel.send({
      embeds: [
        {
          color: COLORS.PRIMARY,
          footer: {
            icon_url: interaction.user.avatarURL(),
            text: `${interaction.user.globalName}(${interaction.user.username}#${interaction.user.discriminator}) has been removed from the queue.`,
          },
        },
      ],
    });

    const currentQueueDescription = await getCurrentQueueDescription();

    await channel.send({
      embeds: [
        {
          color: COLORS.PRIMARY,
          description: currentQueueDescription,
        },
      ],
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
};
