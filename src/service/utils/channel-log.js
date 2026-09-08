import { time, userMention } from 'discord.js';
import client from '../../client/index.js';
import config from '../../config/index.js';

const { LOG_SERVER_ID: logServerId, LOG_CHANNEL_ID: logChannelId } = config;

// Must never throw - almost every handler calls this on its first line.
const sendToLogChannel = (payload) => {
  try {
    const channel = client.guilds.cache.get(logServerId)?.channels.cache.get(logChannelId);

    if (!channel) {
      // eslint-disable-next-line no-console
      console.error('channelLog: log channel not resolvable', logServerId, logChannelId);
      return;
    }

    channel.send(payload).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('channelLog failed:', error);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('channelLog failed:', error);
  }
};

export default (content) => {
  sendToLogChannel({
    embeds: [
      {
        description: content,
      },
    ],
  });
};

export const channelLogWithoutEmbeds = (content) => {
  sendToLogChannel(content);
};

// For system events with no interaction/message behind them. Empty fields are dropped.
export const generateSystemLogContent = (title, fields) =>
  `### ${title}\ntime: ${time(Math.floor(Date.now() / 1000), 'F')}\n${Object.entries(fields)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}`;

export const generateInteractionCreateLogContent = (interaction, additionalMessage) => {
  const guildName = interaction.guild == null ? '`undefined`' : interaction.guild.name;
  return `### Interaction Message\ntime: ${time(+Date.now().toString().slice(0, 10), 'F')}\nserver: ${
    guildName
  }\nchannel: \`#${interaction.channel?.name}\`\ncommand: \`/${
    interaction.commandName
  }\`\nuser: ${userMention(interaction.user.id)}${
    additionalMessage ? `\n\`\`\`${additionalMessage.replaceAll('`', '')}\`\`\`` : ''
  }`;
};

export const generateMessageCreateLogContent = (message, additionalMessage) =>
  `### Create Message\ntime: ${time(+Date.now().toString().slice(0, 10), 'F')}\nserver: ${
    message.guild?.name
  }\nchannel: \`#${message.channel?.name}\`\nuser: ${userMention(message.author.id)}
${additionalMessage ? `\n\`\`\`${additionalMessage.replaceAll('`', '')}\`\`\`` : ''}`;
