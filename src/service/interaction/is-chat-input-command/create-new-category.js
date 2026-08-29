import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default async (interaction) => {
  const modal = new ModalBuilder()
    .setCustomId('create-new-category')
    .setTitle('Create new category (categories)');

  const message = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Categories to create, one per line')
    .setPlaceholder('Types of fruit\nThings found in a kitchen\nCity names')
    .setStyle(TextInputStyle.Paragraph);

  modal.addComponents(new ActionRowBuilder().addComponents(message));

  await interaction.showModal(modal);
};
