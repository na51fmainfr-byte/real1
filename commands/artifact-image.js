const { AttachmentBuilder } = require('discord.js');
const { generateArtifactImage } = require('../utils/artifactImage');

module.exports = {
  name: 'artifact-image',
  description: 'Generate a preview image for an artifact (by id or name)',
  async execute({ message, interaction, args }) {
    const input = (args && args.length) ? args.join(' ') : null;
    if (!input) {
      const reply = 'Please provide an artifact id or name, e.g. `a017` or `Iron Mace`.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const artifacts = require('../data/artifactcards').cards || [];
    const q = input.toLowerCase().trim();
    const artifact = artifacts.find(c => c.id === q || (c.character && c.character.toLowerCase() === q) || (c.title && c.title.toLowerCase() === q) || (c.alias && c.alias.map(a => a.toLowerCase()).includes(q)));
    if (!artifact) {
      const reply = `Artifact not found: ${input}`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    try {
      const buffer = await generateArtifactImage(artifact);
      const attachment = new AttachmentBuilder(buffer, { name: `artifact-${artifact.id}.png` });
      if (message) return message.reply({ files: [attachment] });
      return interaction.reply({ files: [attachment] });
    } catch (e) {
      console.error('artifact-image error', e);
      const reply = 'Failed to generate artifact image.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }
  }
};
