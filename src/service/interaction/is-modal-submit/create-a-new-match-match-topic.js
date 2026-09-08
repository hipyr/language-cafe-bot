import { COLORS } from '../../../constants/index.js';
import MatchMatchTopic from '../../../models/match-match-topic.js';
import { formatBulkList, parseBulkLines } from '../../utils/parse-bulk-lines.js';

const editReplyWithEmbed = (interaction, description) =>
  interaction.editReply({
    embeds: [
      {
        color: COLORS.PRIMARY,
        description,
      },
    ],
  });

export default async (interaction) => {
  try {
    await interaction.deferReply({ ephemeral: true });

    const input = interaction.fields.getTextInputValue('topic');
    const { entries, duplicateInInputCount } = parseBulkLines(input);

    if (entries.length === 0) {
      await editReplyWithEmbed(
        interaction,
        'No topic was submitted, put at least one topic per line.',
      );
      return;
    }

    const existingTopics = await MatchMatchTopic.find({}, 'topic').lean();
    const existingKeys = new Set(existingTopics.map(({ topic }) => topic.trim().toLowerCase()));

    const newTopics = entries.filter((topic) => !existingKeys.has(topic.toLowerCase()));
    const alreadyExistingCount = entries.length - newTopics.length;

    if (newTopics.length === 0) {
      await editReplyWithEmbed(
        interaction,
        `No match-match topic created, all ${entries.length} submitted topic(s) already exist.`,
      );
      return;
    }

    const res = await MatchMatchTopic.insertMany(newTopics.map((topic) => ({ topic })));

    if (!res || res.length === 0) {
      await editReplyWithEmbed(interaction, 'Failed to create match-match topic(s)');
      return;
    }

    const skippedNotes = [];
    if (duplicateInInputCount > 0) {
      skippedNotes.push(`${duplicateInInputCount} duplicate line(s) in your input`);
    }
    if (alreadyExistingCount > 0) {
      skippedNotes.push(`${alreadyExistingCount} topic(s) that already exist`);
    }

    const skippedText = skippedNotes.length > 0 ? `\n\nSkipped ${skippedNotes.join(' and ')}.` : '';

    await editReplyWithEmbed(
      interaction,
      `${res.length} match-match topic(s) created successfully\n\nTopics${formatBulkList(
        newTopics,
      )}${skippedText}`,
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    await editReplyWithEmbed(
      interaction,
      'Failed to create match-match topic(s) (Internal Server Error)',
    );
  }
};
