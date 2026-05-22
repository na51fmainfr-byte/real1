const User = require('../models/User');
const { selectAutoTeam } = require('../utils/autoteam');
const { tryAcquire } = require('../utils/heavyCommandCooldown');

module.exports = {
  name: 'autoteam',
  description: 'Automatically choose your best active team (max 3 cards)',
  async execute({ message, interaction }) {
    const userId = message ? message.author.id : interaction.user.id;

    // Enforce 10s per-user cooldown across heavy commands
    if (!tryAcquire(userId)) {
      const errMsg = 'Please wait a moment before running this command again.';
      if (message) {
        // For prefix invocation, reply and delete immediately to mimic ephemeral
        try {
          const m = await message.reply(errMsg);
          setTimeout(() => m.delete().catch(() => {}), 1000);
        } catch (e) {}
        return;
      }
      return interaction.reply({ content: errMsg, ephemeral: true });
    }

    // Immediate acknowledgement to improve perceived responsiveness
    try {
      if (message) {
        // For prefix invocation, reply and delete immediately to mimic ephemeral
        try {
          const m = await message.reply('Applying autoteam...');
          setTimeout(() => m.delete().catch(() => {}), 1000);
        } catch (e) {}
      } else {
        await interaction.reply({ content: 'Applying autoteam...', ephemeral: true });
      }
    } catch (e) {
      // ignore reply errors and continue
    }

    let user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.channel.send(reply);
      return interaction.followUp({ content: reply, ephemeral: true });
    }

    const selectedIds = selectAutoTeam(user, 3);
    if (!selectedIds || selectedIds.length === 0) {
      const reply = 'You don\'t have any eligible cards to form a team.';
      if (message) return message.channel.send(reply);
      return interaction.followUp({ content: reply, ephemeral: true });
    }

    user.team = selectedIds;
    await user.save();

    const reply = 'Your team has been set to the strongest possible cards!';
    if (message) return message.channel.send(reply);
    return interaction.followUp({ content: reply });
  }
};
