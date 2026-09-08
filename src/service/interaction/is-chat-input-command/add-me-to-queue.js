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

    if (isExist) {
      await interaction.editReply({
        embeds: [
          {
            color: COLORS.PRIMARY,
            description: 'You are already in the queue.',
          },
        ],
      });
      return;
    }

    await Queue.create({ id: userId });

    const queueLength = await Queue.countDocuments();

    await interaction.editReply({
      embeds: [
        {
          color: COLORS.PRIMARY,
          description: `You have been added to the queue.\nCurrent queue position: \`${queueLength}\`\n\nYou're now in the queue. Please wait for your turn. If you wish to remove yourself from the queue, use </remove-me-from-queue:${config.REMOVE_ME_FROM_QUEUE_COMMAND_ID}>`,
        },
      ],
    });

    await channel.send({
      embeds: [
        {
          color: COLORS.PRIMARY,
          footer: {
            icon_url: interaction.user.avatarURL(),
            text: `${interaction.user.globalName}(${interaction.user.username}#${interaction.user.discriminator}) has been added to the queue.`,
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
