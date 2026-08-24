import { Events, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import NewMember from '../models/NewMember.js';

export default {
  name: Events.GuildMemberAdd,
  execute: async (member) => {
    const newMember = await NewMember.findOne({ id: member.id });

    if (newMember) {
      return;
    }

    const startButton = new ButtonBuilder()
      .setCustomId('dm-server-tutorial-start')
      .setLabel('Start Guide')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(startButton);

    let dm;
    try {
      dm = await member.send({
        content: `# Welcome to the Language Cafe Discord Server!

I'd be happy to walk you through the server and set up a personalized guide to its most useful channels and features.

Press the button below to begin.
If you'd rather explore on your own, you can ignore this message.

*Note: To make sure the guide is visible, turn on "Show embeds and link previews" via \`Settings > Chat / Appearance > Show embeds and link previews\` to see the tutorial.*`,
        components: [row],
      });
    } catch (error) {
      // DMs disabled, or the member already left the server (no mutual guilds)
      // eslint-disable-next-line no-console
      console.error(`Could not send welcome DM to ${member.id}:`, error.message);
      return;
    }

    await NewMember.create({
      id: member.id,
      tutorialStep: 0,
      tutorialChannelId: dm.channelId,
    });
  },
};
