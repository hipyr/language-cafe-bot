import { COLORS } from '../../../constants/index.js';
import A_TO_Z from '../../../data/a2z.js';
import Category from '../../../models/category.js';
import { formatBulkList, parseBulkLines } from '../../utils/parse-bulk-lines.js';

const replyWithEmbed = (interaction, description) =>
  interaction.reply({
    embeds: [
      {
        color: COLORS.PRIMARY,
        description,
      },
    ],
    ephemeral: true,
  });

export default async (interaction) => {
  try {
    const input = interaction.fields.getTextInputValue('message');
    const { entries, duplicateInInputCount } = parseBulkLines(input);

    if (entries.length === 0) {
      await replyWithEmbed(
        interaction,
        'No category was submitted, put at least one category per line.',
      );
      return;
    }

    const existingCategories = await Category.find({}, 'message').lean();
    const existingKeys = new Set(
      existingCategories.map(({ message }) => message.trim().toLowerCase()),
    );

    const newMessages = entries.filter((message) => !existingKeys.has(message.toLowerCase()));
    const alreadyExistingCount = entries.length - newMessages.length;

    if (newMessages.length === 0) {
      await replyWithEmbed(
        interaction,
        `No category created, all ${entries.length} submitted category (categories) already exist.`,
      );
      return;
    }

    const res = await Category.insertMany(
      newMessages.map((message) => ({ message, alphabet: A_TO_Z })),
    );

    if (!res || res.length === 0) {
      await replyWithEmbed(interaction, 'Failed to create category (categories)');
      return;
    }

    const skippedNotes = [];
    if (duplicateInInputCount > 0) {
      skippedNotes.push(`${duplicateInInputCount} duplicate line(s) in your input`);
    }
    if (alreadyExistingCount > 0) {
      skippedNotes.push(`${alreadyExistingCount} category (categories) that already exist`);
    }

    const skippedText = skippedNotes.length > 0 ? `\n\nSkipped ${skippedNotes.join(' and ')}.` : '';

    await replyWithEmbed(
      interaction,
      `${res.length} category (categories) created successfully\n\nMessages${formatBulkList(
        newMessages,
      )}${skippedText}`,
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    await replyWithEmbed(
      interaction,
      'Failed to create category (categories) (Internal Server Error)',
    );
  }
};
