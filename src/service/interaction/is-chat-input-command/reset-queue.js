import { COLORS } from '../../../constants/index.js';
import Queue from '../../../models/queue.js';

export default async (interaction) => {
  try {
    await interaction.deferReply();

    await Queue.deleteMany({});

    await interaction.editReply({
      embeds: [
        {
          color: COLORS.PRIMARY,
          description: 'Queue has been reset.',
        },
      ],
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
};
