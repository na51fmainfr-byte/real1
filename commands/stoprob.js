const { EmbedBuilder } = require('discord.js');
const robCmd = require('./rob');

async function sendSavedDM(targetUser) {
  const descriptionLines = [
    '**Saved yourself!**',
    'you reacted in time and saved yourself from being robbed. now get revenge!'
  ];
  const embed = new EmbedBuilder()
    .setDescription(descriptionLines.join('\n'))
    .setColor('#fff3c7');
  return targetUser.send({ embeds: [embed] });
}

module.exports = {
  name: 'stoprob',
  description: 'Stop an active robbery against you',
  async execute({ message, interaction }) {
    const userId = message ? message.author.id : interaction.user.id;
    const targetUser = message ? message.author : interaction.user;

    const pending = await robCmd.cancelRobbery(userId);
    if (!pending) {
      const reply = 'You are not being robbed right now.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    let robberName = 'Someone';
    try {
      const robberUser = await (message ? message.client.users.fetch(pending.robberId) : interaction.client.users.fetch(pending.robberId));
      if (robberUser) robberName = robberUser.username;
    } catch {}

    const stoppedContent = `**${targetUser.username}** stopped you before you could get anything...\nBetter luck next time!`;
    if (pending.pendingMessage && !pending.pendingMessage.deleted) {
      try {
        await pending.pendingMessage.reply({ content: stoppedContent });
      } catch {}
    }

    try {
      await sendSavedDM(targetUser);
    } catch {}

    const reply = 'You stopped the robbery!';
    if (message) return message.channel.send(reply);
    return interaction.reply({ content: reply, ephemeral: true });
  }
};
