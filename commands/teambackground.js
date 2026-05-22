const User = require('../models/User');

module.exports = {
  name: 'teambackground',
  description: 'Set your custom team background image',
  options: [
    {
      name: 'add',
      type: 1,
      description: 'Add or update your team background URL',
      options: [
        { name: 'url', type: 3, description: 'Image URL for your team background', required: true }
      ]
    }
  ],
  async execute({ message, interaction, args = [] }) {
    const userId = message ? message.author.id : interaction.user.id;
    let user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account yet. Run `op start` or /start to register.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    let sub = null;
    if (interaction) {
      try {
        sub = interaction.options.getSubcommand();
      } catch (e) {
        sub = null;
      }
    } else {
      sub = args[0] && args[0].toLowerCase();
    }

    if (!sub || sub !== 'add') {
      const reply = 'Usage: `op teambg add "url"` or `/teambackground add url`';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const url = interaction ? interaction.options.getString('url') : args.slice(1).join(' ').replace(/^"|"$/g, '');
    if (!url) {
      const reply = 'Please provide a valid image URL.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    user.teamBackgroundUrl = url;
    await user.save();

    const reply = `Team background set! Using: ${url}`;
    if (message) return message.reply(reply);
    return interaction.reply({ content: reply, ephemeral: true });
  }
};
