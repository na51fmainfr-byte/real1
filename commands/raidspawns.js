const { getBotConfig, setBotConfig, deleteBotConfig } = require('../models/BotConfig');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { cards } = require('../data/cards');
const path = require('path');
const RaidCmd = require('./raid');

// Active spawns: spawnId -> { messageId, channelId, card, rank, expiresAt }
const activeSpawns = new Map();
const messageCounts = new Map();
const channelThresholds = new Map();
const configuredRaidChannels = new Set();
let raidClient = null;
let raidIntervalTimer = null;
let messageListener = null;

async function loadRaidChannelIds() {
  try {
    const channels = await getBotConfig('raidChannels');
    if (Array.isArray(channels)) {
      return channels.map(c => ({ channelId: c.channelId, threshold: typeof c.threshold === 'number' ? c.threshold : 200, progress: typeof c.progress === 'number' ? c.progress : 0 }));
    }
  } catch (err) {
    console.error('Error loading raid channel config from DB:', err);
  }
  return [];
}

async function saveRaidChannelIds(channelConfigs) {
  try {
    let channels = [];
    if (Array.isArray(channelConfigs)) {
      if (channelConfigs.length && typeof channelConfigs[0] === 'string') {
        channels = channelConfigs.map(cid => ({ channelId: cid, threshold: channelThresholds.get(cid) || 200, progress: messageCounts.get(cid) || 0 }));
      } else {
        channels = channelConfigs.map(c => {
          if (typeof c === 'string') return { channelId: c, threshold: channelThresholds.get(c) || 200, progress: messageCounts.get(c) || 0 };
          return { channelId: c.channelId, threshold: typeof c.threshold === 'number' ? c.threshold : (channelThresholds.get(c.channelId) || 200), progress: typeof c.progress === 'number' ? c.progress : (messageCounts.get(c.channelId) || 0) };
        });
      }
    } else {
      channels = Array.from(configuredRaidChannels).map(cid => ({ channelId: cid, threshold: channelThresholds.get(cid) || 200, progress: messageCounts.get(cid) || 0 }));
    }
    await setBotConfig('raidChannels', channels);
  } catch (err) {
    console.error('Error saving raid config to DB:', err);
  }
}

async function validateRaidChannel(client, channelId) {
  if (!client || !channelId) return null;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || (typeof channel.isTextBased === 'function' && !channel.isTextBased())) return null;
    return channel;
  } catch {
    return null;
  }
}

async function _spawnRaid(channelId) {
  if (!raidClient || !channelId) return;
  try {
    const channel = await validateRaidChannel(raidClient, channelId);
    if (!channel) {
      configuredRaidChannels.delete(channelId);
      messageCounts.delete(channelId);
      channelThresholds.delete(channelId);
      return;
    }

    // Choose rank using owner-specified distribution
    const raidRates = [
      ['D', 0], ['C', 5], ['B', 20], ['A', 30], ['S', 30], ['SS', 20], ['UR', 5]
    ];
    const totalRate = raidRates.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * totalRate;
    let chosenRank = raidRates[raidRates.length - 1][0];
    for (const [rk, wt] of raidRates) {
      r -= wt;
      if (r <= 0) { chosenRank = rk; break; }
    }

    // Prefer non-artifact, non-ship cards of that rank
    let pool = cards.filter(c => !c.artifact && !c.ship && c.rank === chosenRank);
    if (!pool.length) pool = cards.filter(c => !c.artifact && !c.ship && c.rank);
    if (!pool.length) return;
    const card = pool[Math.floor(Math.random() * pool.length)];

    const spawnId = `raid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`raidspawn_join:${spawnId}`).setLabel('add a card').setStyle(ButtonStyle.Secondary)
    );

    const displayEmoji = card && card.emoji ? `${card.emoji} ` : '';
    const content = `A raid appears: **${displayEmoji}${card.character} (${card.rank})**! Click **add a card** to claim and host this raid.`;
    const msg = await channel.send({ content, components: [row] });

    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    activeSpawns.set(spawnId, { messageId: msg.id, channelId: channel.id, card, rank: card.rank, expiresAt });

    // Auto-cleanup after 10 minutes
    setTimeout(() => {
      const s = activeSpawns.get(spawnId);
      if (s) {
        try { msg.edit({ components: [] }).catch(() => {}); } catch {}
        activeSpawns.delete(spawnId);
      }
    }, 10 * 60 * 1000);
  } catch (err) {
    console.error('Error spawning raid:', err);
  }
}

async function startRaidTimer(client, channelId, threshold = 200, initialProgress = 0) {
  const channel = await validateRaidChannel(client, channelId);
  if (!channel) throw new Error('Unable to access raid channel. Make sure the bot can access it.');
  raidClient = client;
  configuredRaidChannels.add(channelId);
  channelThresholds.set(channelId, Number.isFinite(Number(threshold)) ? Number(threshold) : 200);
  if (!messageCounts.has(channelId)) messageCounts.set(channelId, Number.isFinite(Number(initialProgress)) ? Number(initialProgress) : 0);
  saveRaidChannelIds(Array.from(configuredRaidChannels).map(cid => ({ channelId: cid, threshold: channelThresholds.get(cid) || 200, progress: messageCounts.get(cid) || 0 }))).catch(() => {});

  try {
    if (!messageListener) {
      messageListener = (message) => {
        try {
          if (!message || !message.channel) return;
          const cid = message.channel.id;
          if (!configuredRaidChannels.has(cid)) return;
          if (message.author && message.author.bot) return;
          const cur = messageCounts.get(cid) || 0;
          const next = cur + 1;
          messageCounts.set(cid, next);
          const thresh = channelThresholds.get(cid) || 200;
          if (next >= thresh) {
            const times = Math.floor(next / thresh);
            messageCounts.set(cid, next - (times * thresh));
            for (let i = 0; i < times; i++) {
              _spawnRaid(cid).catch(() => {});
            }
          }
        } catch (err) { console.error('Error in raid message listener:', err); }
      };
      if (raidClient && typeof raidClient.on === 'function') raidClient.on('messageCreate', messageListener);
    }
  } catch (err) {}

  if (!raidIntervalTimer) {
    raidIntervalTimer = setInterval(() => {
      try {
        for (const cid of Array.from(configuredRaidChannels)) {
          try {
            const cur = messageCounts.get(cid) || 0;
            const next = cur + 1;
            messageCounts.set(cid, next);
            const thresh = channelThresholds.get(cid) || 200;
            if (next >= thresh) {
              const times = Math.floor(next / thresh);
              messageCounts.set(cid, next - (times * thresh));
              for (let i = 0; i < times; i++) _spawnRaid(cid).catch(() => {});
            }
          } catch (e) {}
        }
      } catch (err) {}
    }, 60000);
  }
  return true;
}

function stopRaidTimer(channelId = null) {
  if (channelId) {
    configuredRaidChannels.delete(channelId);
    saveRaidChannelIds(Array.from(configuredRaidChannels).map(cid => ({ channelId: cid, threshold: channelThresholds.get(cid) || 200, progress: messageCounts.get(cid) || 0 }))).catch(() => {});
    messageCounts.delete(channelId);
    channelThresholds.delete(channelId);
    if (configuredRaidChannels.size === 0) stopRaidTimer();
    return;
  }
  if (raidIntervalTimer) { clearInterval(raidIntervalTimer); raidIntervalTimer = null; }
  try { if (messageListener && raidClient && typeof raidClient.off === 'function') raidClient.off('messageCreate', messageListener); } catch (err) {}
  messageListener = null;
  configuredRaidChannels.clear();
  messageCounts.clear();
  deleteBotConfig('raidChannels').catch(() => {});
}

function getRaidStatus() {
  return {
    configured: Array.from(configuredRaidChannels).map(cid => ({ channelId: cid, threshold: channelThresholds.get(cid) || 200, progress: messageCounts.get(cid) || 0 })),
    actives: Array.from(activeSpawns.values()).map(a => ({ channelId: a.channelId, messageId: a.messageId, cardName: a.card && a.card.character, rank: a.rank, expiresIn: Math.max(0, a.expiresAt - Date.now()) }))
  };
}

// Button handler: show modal to claim spawn
async function handleButton(interaction, rawAction, spawnId) {
  const spawn = activeSpawns.get(spawnId);
  if (!spawn) return interaction.reply({ content: 'This raid has expired or been claimed.', ephemeral: true });
  // show modal
  try {
    const modal = new ModalBuilder().setCustomId(`raidspawn_join_modal:${spawnId}`).setTitle('Join Raid');
    const input = new TextInputBuilder().setCustomId('card_name').setLabel('Enter your card name').setStyle(TextInputStyle.Short).setPlaceholder('e.g. Zoro, uss_luffy').setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  } catch (e) {
    console.error('Failed to show raid spawn modal:', e);
    return interaction.reply({ content: 'Failed to open pick form.', ephemeral: true });
  }
}

// Handle modal submit and convert into a real raid + initial join
async function handleModal(interaction) {
  const parts = interaction.customId.split(':');
  const spawnId = parts[1];
  const spawn = activeSpawns.get(spawnId);
  if (!spawn) return interaction.reply({ content: 'This raid has expired or been claimed.', ephemeral: true });
  // Ensure no active raid already in this channel
  const channelId = interaction.channelId;
  const existing = RaidCmd.getRaidState(channelId);
  if (existing) return interaction.reply({ content: 'There is already an active raid in this channel.', ephemeral: true });

  const userId = interaction.user.id;
  const username = interaction.user.username;
  // Check crew membership
  const Crew = require('../models/Crew');
  const crew = await Crew.findOne({ members: userId });
  if (!crew) return interaction.reply({ content: 'You must be in a crew to claim a raid.', ephemeral: true });

  try {
    // Create raid state in raid module (owner is this claimant)
    const state = await RaidCmd.createRaidFromSpawn(userId, username, await interaction.channel.fetch(), spawn.card, crew);
    // Remove spawn message and active spawn
    try { const spawnMsg = await interaction.channel.messages.fetch(spawn.messageId).catch(() => null); if (spawnMsg) await spawnMsg.delete().catch(() => {}); } catch (e) {}
    activeSpawns.delete(spawnId);
    // Now delegate to existing raid join modal handler to process the card pick
    return await RaidCmd.handleJoinModal(interaction);
  } catch (err) {
    console.error('Failed to claim raid spawn:', err);
    return interaction.reply({ content: 'Failed to claim raid.', ephemeral: true });
  }
}

async function initializeRaidSpawns(client) {
  raidClient = client;
  if (!client) return;
  const saved = await loadRaidChannelIds();
  if (Array.isArray(saved) && saved.length) {
    for (const e of saved) {
      try { await startRaidTimer(client, e.channelId, e.threshold || 200, e.progress || 0); console.log(`Resumed raids in channel ${e.channelId} (threshold=${e.threshold || 200})`); } catch (err) { console.error('Unable to resume raid channel:', e.channelId, err && err.message ? err.message : err); }
    }
  }
}

module.exports = {
  startRaidTimer,
  stopRaidTimer,
  getRaidStatus,
  handleButton,
  handleModal,
  initializeRaidSpawns,
};
