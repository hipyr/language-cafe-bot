import { COLORS } from '../../../constants/index.js';
import Queue from '../../../models/queue.js';
import { getCurrentQueueDescription } from './get-queue.js';

export default async (interaction) => {
  try {
    const { channel } = interaction;

    const oldestQueue = await Queue.findOne().sort({ createdAt: 1 });

    // The empty-queue notice stays private; an actual shift is announced publicly.
    await interaction.deferReply({ ephemeral: !oldestQueue });

    if (!oldestQueue) {
      await interaction.editReply({
        embeds: [
          {
            color: COLORS.PRIMARY,
            description: 'Queue is empty.',
          },
        ],
      });
      return;
    }

    await Queue.findByIdAndDelete(oldestQueue._id);

    await interaction.editReply({
      embeds: [
        {
          color: COLORS.PRIMARY,
          description: 'Queue has been shifted.',
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
