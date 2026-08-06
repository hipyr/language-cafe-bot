import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default async (interaction) => {
  const modal = new ModalBuilder()
    .setCustomId('create-a-new-match-match-topic')
    .setTitle('Create new match-match topic(s)');

  const topic = new TextInputBuilder()
    .setCustomId('topic')
    .setLabel('Topics to create, one per line')
    .setPlaceholder('Animals\nCountries\nFood and drinks')
    .setStyle(TextInputStyle.Paragraph);

  modal.addComponents(new ActionRowBuilder().addComponents(topic));

  await interaction.showModal(modal);
};
