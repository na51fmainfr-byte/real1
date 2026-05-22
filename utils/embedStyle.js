// Helper to apply consistent styling to embeds across the bot.
// This is intentionally not used by card embeds, as those have their own color tradition.

const DEFAULT_EMBED_COLOR = '#FFFFFF';
const DEFAULT_EMBED_IMAGE = 'https://files.catbox.moe/n292ji.png';

/**
 * Apply the default embed appearance to an EmbedBuilder.
 *
 * @param {import('discord.js').EmbedBuilder} embed
 * @param {import('discord.js').User | import('discord.js').GuildMember | null | undefined} user
 * @returns {import('discord.js').EmbedBuilder}
 */
function applyDefaultEmbedStyle(embed, user) {
  if (!embed) return embed;

  // Only set default color if not already set
  if (!embed.data || !embed.data.color) {
    embed.setColor(DEFAULT_EMBED_COLOR);
  }

  // Only set the image if not already set.
  const hasImage = embed.data && embed.data.image;
  if (!hasImage) {
    embed.setImage(DEFAULT_EMBED_IMAGE);
  }

  if (user && user.username) {
    const iconURL = typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL() : undefined;
    embed.setAuthor({ name: user.username, iconURL });
  }

  return embed;
}

module.exports = {
  applyDefaultEmbedStyle,
};
