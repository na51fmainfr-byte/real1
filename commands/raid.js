const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const Crew = require('../models/Crew');
const { getCardById, searchCards } = require('../utils/cards');
const { resolveStats } = require('../utils/statResolver');
const { getDamageMultiplier } = require('../utils/attributeSystem');
const { calculateUserDamage, hasStatusLock, getStatusLockReason } = require('../src/battle/statusManager');
const { RANK_MAX_LEVEL } = require('../utils/starLevel');

const raidStates = new Map(); // channelId -> state

const BELI_BY_RANK = { D: 100, C: 300, B: 700, A: 1200, S: 2000, SS: 2800, UR: 3500 };
const RAID_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_PLAYERS = 10;
const MIN_PLAYERS = 3;
const GOD_TOKEN_EMOJI = '<:godtoken:1499957056650608753>';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function findItemCount(items, itemId) {
  if (!Array.isArray(items)) return 0;
  const it = items.find(i => i.itemId === itemId);
  return it ? (it.quantity || 0) : 0;
}

function removeItem(items, itemId, count) {
  if (!Array.isArray(items) || count <= 0) return items;
  const idx = items.findIndex(i => i.itemId === itemId);
  if (idx === -1) return items;
  items[idx].quantity = (items[idx].quantity || 0) - count;
  if (items[idx].quantity <= 0) items.splice(idx, 1);
  return items;
}

function hpBar(current, max) {
  if (max <= 0 || current <= 0) {
    return '<:Healthemptyleft:1481750325151928391>'
      + '<:Healthemptymiddle:1481750341489004596>'.repeat(6)
      + '<:healthemptyright:1481750363286667334>';
  }
  const healthPercent = Math.max(0, Math.min(1, current / max));
  const filledSections = Math.floor(healthPercent * 6);
  let bar = '<:Healthfullleft:1481750264074469437>';
  for (let i = 0; i < filledSections; i++) bar += '<:healthfullmiddle:1481750286795149435>';
  for (let i = filledSections; i < 6; i++) bar += '<:Healthemptymiddle:1481750341489004596>';
  bar += filledSections === 6 ? '<:healthfullright:1481750302679105710>' : '<:healthemptyright:1481750363286667334>';
  return bar;
}

function energyDisplay(energy) {
  if (!energy || energy <= 0) return '0';
  return '<:energy:1478051414558118052>'.repeat(Math.min(energy, 3));
}

function findCardByQuery(query) {
  if (!query) return null;
  const byId = getCardById(query.trim());
  if (byId) return byId;
  const results = searchCards(query.trim());
  return results && results.length > 0 ? results[0] : null;
}

function buildBossFromDef(def) {
  const baseMin = typeof def.attack_min === 'number' ? def.attack_min : (def.power || 20);
  const baseMax = typeof def.attack_max === 'number' ? def.attack_max : baseMin;
  const hp = def.health || def.hp || 100;
  return {
    name: def.character || 'Boss',
    title: def.title || '',
    emoji: def.emoji || '',
    image: def.image_url || def.image || null,
    cardId: def.id,
    rank: def.rank || 'D',
    attribute: def.attribute || 'STR',
    maxHP: Math.floor(hp * 5),
    currentHP: Math.floor(hp * 5),
    attack_min: Math.floor(baseMin * 2),
    attack_max: Math.max(Math.floor(baseMin * 2), Math.floor(baseMax * 2)),
    status: []
  };
}

function buildPlayerCard(def, userEntry, ownedCards) {
  const scaled = resolveStats(userEntry, ownedCards);
  const maxHP = scaled ? scaled.health : (def.health || def.hp || 100);
  return {
    def,
    userEntry,
    scaled,
    maxHP,
    currentHP: maxHP,
    energy: 3,
    alive: true,
    status: [],
    turnsUntilRecharge: 0
  };
}

function getEmojiId(emoji) {
  if (!emoji) return null;
  const match = emoji.match(/<a?:[^:]+:(\d+)>/);
  return match ? match[1] : null;
}

function buildLobbyEmbed(state) {
  const boss = state.boss;
  const title = `${boss.name}${boss.title ? ` - ${boss.title}` : ''} | Boss Raid`;
  const embed = new EmbedBuilder().setColor('#FFFFFF').setTitle(title);

  if (boss.image) embed.setImage(boss.image);

  const emojiId = getEmojiId(boss.emoji);
  if (emojiId) embed.setThumbnail(`https://cdn.discordapp.com/emojis/${emojiId}.png`);

  embed.addFields({
    name: `${boss.emoji || ''} **${boss.name}**`,
    value: `${hpBar(boss.currentHP, boss.maxHP)}\n${boss.name} | Raid boss\n${boss.currentHP}/${boss.maxHP}`,
    inline: false
  });

  embed.addFields({ name: '__________________', value: '        ', inline: false });

  if (state.players.length === 0) {
    embed.addFields({ name: '  ', value: 'no cards added yet ..', inline: false });
  } else {
    const sorted = [...state.players].sort((a, b) => (b.card?.def?.speed || 0) - (a.card?.def?.speed || 0));
    for (const p of sorted) {
      if (!p.card) continue;
      const speed = p.card.def.speed || 0;
      embed.addFields({
        name: `${p.card.def.emoji || ''} ${p.username}`,
        value: `${p.card.def.character} | Lv. ${p.entry ? p.entry.level : 1} | Spd: ${speed}\n${hpBar(p.card.currentHP, p.card.maxHP)}\n${p.card.currentHP}/${p.card.maxHP} ${energyDisplay(p.card.energy)}`,
        inline: true
      });
    }
  }

  const joined = state.players.length;
  embed.setFooter({ text: `add a card to the raid with \`/raid add <cardID/name>\` • ${joined}/${MAX_PLAYERS} players` });
  return embed;
}

function buildBattleEmbed(state) {
  const boss = state.boss;
  const title = `${boss.name}${boss.title ? ` - ${boss.title}` : ''} | Boss Raid`;
  const embed = new EmbedBuilder().setColor('#FFFFFF').setTitle(title);

  if (boss.image) embed.setImage(boss.image);

  const emojiId = getEmojiId(boss.emoji);
  if (emojiId) embed.setThumbnail(`https://cdn.discordapp.com/emojis/${emojiId}.png`);

  embed.addFields({
    name: `${boss.emoji || ''} **${boss.name}**`,
    value: `${hpBar(boss.currentHP, boss.maxHP)}\n${boss.name} | Raid boss\n${boss.currentHP}/${boss.maxHP}`,
    inline: false
  });

  embed.addFields({ name: '__________________', value: '        ', inline: false });

  const currentPlayerId = state.turnOrder[state.currentTurnIndex];
  const sorted = [...state.players].sort((a, b) => (b.card?.def?.speed || 0) - (a.card?.def?.speed || 0));

  for (const p of sorted) {
    if (!p.card) continue;
    const isTurn = !state.finished && p.userId === currentPlayerId;
    const alive = p.card.alive;
    const statusIcons = (p.card.status || []).slice(0, 2).map(st => st.type).join(' ');
    let val = `${hpBar(p.card.currentHP, p.card.maxHP)}\nLv. ${p.entry ? p.entry.level : 1} | ${energyDisplay(p.card.energy)}`;
    if (statusIcons) val += ` ${statusIcons}`;
    if (!alive) val = `**KO'd**\n~~${hpBar(0, p.card.maxHP)}~~`;
    embed.addFields({
      name: `${isTurn ? '▶ ' : ''}${p.card.def.emoji || ''} ${p.username} — ${p.card.def.character}`,
      value: val,
      inline: true
    });
  }

  if (state.lastAction) {
    embed.addFields({ name: 'Battle Log', value: state.lastAction.slice(-1024), inline: false });
  }

  if (!state.finished && state.phase === 'battle') {
    const cp = state.players.find(p => p.userId === currentPlayerId);
    embed.setFooter({ text: cp ? `It's ${cp.username}'s turn!` : 'Waiting...' });
  }

  return embed;
}

function makeLobbyComponents() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('raid_start').setLabel('Start raid').setStyle(ButtonStyle.Danger)
  )];
}

function makeBattleComponents(state) {
  if (state.finished) return [];
  const currentPlayerId = state.turnOrder[state.currentTurnIndex];
  const cp = state.players.find(p => p.userId === currentPlayerId);
  const card = cp?.card;

  const locked = card ? hasStatusLock(card) : true;
  const noEnergy = !card || card.energy < 1;
  const noSpecial = !card || card.energy < 3;

  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('raid_action:attack')
      .setLabel('Attack')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(locked || noEnergy)
  );

  const { isSpecialAttackUnlocked } = require('../utils/starLevel');
  if (card && card.def.special_attack && isSpecialAttackUnlocked(card.userEntry?.starLevel)) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('raid_action:special')
        .setLabel('Special Attack')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(locked || noSpecial)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('raid_action:rest')
      .setLabel('Rest')
      .setStyle(ButtonStyle.Success)
  );

  return [row];
}

async function updateRaidMessage(state) {
  try {
    const channel = state.channel;
    if (!channel) return;
    const msg = await channel.messages.fetch(state.messageId).catch(() => null);
    if (!msg) return;

    const embed = state.phase === 'lobby' ? buildLobbyEmbed(state) : buildBattleEmbed(state);
    const components = state.phase === 'lobby' ? makeLobbyComponents() : makeBattleComponents(state);
    await msg.edit({ embeds: [embed], components });
  } catch (e) {
    if (e.code !== 10008) console.error('[raid] updateRaidMessage error:', e);
  }
}

async function startRaidBattle(state) {
  state.phase = 'battle';
  if (state.startTimeoutId) {
    clearTimeout(state.startTimeoutId);
    state.startTimeoutId = null;
  }

  const sorted = [...state.players].sort((a, b) => (b.card?.def?.speed || 0) - (a.card?.def?.speed || 0));
  state.turnOrder = sorted.map(p => p.userId);
  state.currentTurnIndex = 0;
  state.lastAction = '⚔️ The raid has begun! Players attack in order of speed.';

  await updateRaidMessage(state);
}

async function processBossAttack(state) {
  const alive = state.players.filter(p => p.card && p.card.alive);
  if (!alive.length) return;

  const target = alive[Math.floor(Math.random() * alive.length)];
  const atk = randomInt(state.boss.attack_min, state.boss.attack_max);
  const multiplier = getDamageMultiplier(state.boss.attribute, target.card.def.attribute);
  const dmg = Math.max(1, Math.floor(atk * multiplier));

  target.card.currentHP = Math.max(0, target.card.currentHP - dmg);
  if (target.card.currentHP <= 0) {
    target.card.alive = false;
    target.card.currentHP = 0;
    target.card.energy = 0;
  }

  const effectStr = multiplier > 1 ? ' (Effective!)' : multiplier < 1 ? ' (Weak)' : '';
  const koStr = !target.card.alive ? ` **${target.card.def.character} is KO'd!**` : '';
  state.lastAction = `${state.boss.emoji || '⚔️'} **${state.boss.name}** strikes **${target.username}**'s ${target.card.def.character} for **${dmg} DMG**${effectStr}!${koStr}`;
}

async function handleVictory(state) {
  state.finished = true;
  state.phase = 'finished';

  const beli = BELI_BY_RANK[state.boss.rank] || 100;
  const cardId = state.boss.cardId;
  const rewardLines = [];

  for (const p of state.players) {
    try {
      const user = await User.findOne({ userId: p.userId });
      if (!user) continue;
      user.balance = (user.balance || 0) + beli;

      const owned = user.ownedCards.find(e => e.cardId === cardId);
      if (!owned) {
        user.ownedCards.push({ cardId, level: 1, xp: 0, starLevel: 0 });
        rewardLines.push(`**${p.username}**: received **${state.boss.name}** card + **${beli.toLocaleString()} Beli**`);
      } else {
        const def = getCardById(cardId);
        const maxLevel = def ? (RANK_MAX_LEVEL[def.rank] || 10) : 10;
        const oldLevel = owned.level || 1;
        owned.level = Math.min(maxLevel, oldLevel + 10);
        owned.xp = 0;
        rewardLines.push(`**${p.username}**: ${state.boss.name} Lv. ${oldLevel} → **${owned.level}** + **${beli.toLocaleString()} Beli**`);
      }

      await user.save();
    } catch (e) {
      console.error('[raid] reward error:', e);
    }
  }

  const embed = buildBattleEmbed(state);
  embed.setTitle(`🏆 Victory! ${state.boss.name} defeated!`);
  embed.setColor('#FFD700');
  embed.addFields({ name: '🎁 Rewards', value: rewardLines.join('\n') || 'No surviving players.', inline: false });

  try {
    const msg = await state.channel.messages.fetch(state.messageId).catch(() => null);
    if (msg) await msg.edit({ embeds: [embed], components: [] });
  } catch (e) {
    console.error('[raid] victory edit error:', e);
  }

  raidStates.delete(state.channelId);
}

async function handleDefeat(state) {
  state.finished = true;
  state.phase = 'finished';

  const embed = buildBattleEmbed(state);
  embed.setTitle(`💀 Raid Failed! ${state.boss.name} was victorious!`);
  embed.setColor('#000000');
  embed.addFields({ name: 'Result', value: 'All player cards have been KO\'d. Better luck next time!', inline: false });

  try {
    const msg = await state.channel.messages.fetch(state.messageId).catch(() => null);
    if (msg) await msg.edit({ embeds: [embed], components: [] });
  } catch (e) {
    console.error('[raid] defeat edit error:', e);
  }

  raidStates.delete(state.channelId);
}

async function advanceTurn(state) {
  const n = state.turnOrder.length;
  let nextIndex = state.currentTurnIndex + 1;

  if (nextIndex >= n) {
    // All players have gone — boss attacks
    await processBossAttack(state);

    // Check if all dead
    if (state.players.every(p => !p.card || !p.card.alive)) {
      await handleDefeat(state);
      return;
    }

    // Recharge energy at start of new round
    for (const p of state.players) {
      if (p.card && p.card.alive) {
        if (p.card.turnsUntilRecharge > 0) {
          p.card.turnsUntilRecharge--;
        } else {
          p.card.energy = Math.min(3, (p.card.energy || 0) + 1);
        }
      }
    }

    nextIndex = 0;
  }

  // Skip dead players
  let attempts = 0;
  while (attempts < n) {
    const pid = state.turnOrder[nextIndex];
    const pp = state.players.find(p => p.userId === pid);
    if (pp && pp.card && pp.card.alive) break;
    nextIndex = (nextIndex + 1) % n;
    attempts++;

    if (attempts >= n) {
      // All dead (shouldn't happen, but safety)
      await handleDefeat(state);
      return;
    }
  }

  state.currentTurnIndex = nextIndex;
  await updateRaidMessage(state);
}

module.exports = {
  name: 'raid',

  async execute({ interaction }) {
    const sub = interaction.options.getSubcommand(false);
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const username = interaction.user.username;

    if (!sub || sub === 'boss') {
      return this.executeStart(interaction, channelId, userId, username);
    }
    if (sub === 'add') {
      return this.executeAdd(interaction, channelId, userId, username);
    }
    if (sub === 'remove') {
      return this.executeRemove(interaction, channelId, userId);
    }
    if (sub === 'start') {
      return this.executeForceStart(interaction, channelId, userId);
    }
  },

  async executeStart(interaction, channelId, userId, username) {
    const query = interaction.options.getString('boss');
    if (!query) return interaction.reply({ content: 'Please provide a boss name or card ID.', ephemeral: true });

    if (raidStates.has(channelId)) {
      return interaction.reply({ content: 'There is already an active raid in this channel!', ephemeral: true });
    }

    const user = await User.findOne({ userId });
    if (!user) return interaction.reply({ content: 'You need an account first. Use `/start` to register.', ephemeral: true });

    if (findItemCount(user.items || [], 'god_token') < 1) {
      return interaction.reply({ content: `${GOD_TOKEN_EMOJI} You need **1 God Token** to start a raid! You currently have 0.`, ephemeral: true });
    }

    const def = findCardByQuery(query);
    if (!def || def.ship || def.artifact) {
      return interaction.reply({ content: `Could not find a card matching **${query}**.`, ephemeral: true });
    }

    const crew = await Crew.findOne({ members: userId });
    if (!crew) {
      return interaction.reply({ content: 'You must be in a crew to start a raid! Crew members are the only ones who can join.', ephemeral: true });
    }

    user.items = removeItem(user.items || [], 'god_token', 1);
    await user.save();

    const boss = buildBossFromDef(def);
    const state = {
      channelId,
      messageId: null,
      channel: interaction.channel,
      ownerId: userId,
      crewId: crew.crewId,
      crewMembers: [...(crew.members || [])],
      phase: 'lobby',
      boss,
      players: [],
      turnOrder: [],
      currentTurnIndex: 0,
      finished: false,
      lastAction: '',
      startTimeoutId: null
    };

    raidStates.set(channelId, state);

    const embed = buildLobbyEmbed(state);
    const reply = await interaction.reply({ embeds: [embed], components: makeLobbyComponents(), fetchReply: true });
    state.messageId = reply.id;

    // 3-minute auto-start
    state.startTimeoutId = setTimeout(async () => {
      const s = raidStates.get(channelId);
      if (!s || s.phase !== 'lobby') return;

      if (s.players.length < MIN_PLAYERS) {
        try {
          const msg = await interaction.channel.messages.fetch(s.messageId).catch(() => null);
          if (msg) {
            const cancelEmbed = buildLobbyEmbed(s);
            cancelEmbed.setTitle(`${s.boss.name} | Raid Cancelled`);
            cancelEmbed.setColor('#888888');
            cancelEmbed.setFooter({ text: `Not enough players joined (${s.players.length}/${MIN_PLAYERS} required). Raid cancelled.` });
            await msg.edit({ embeds: [cancelEmbed], components: [] });
          }
        } catch (e) {}
        raidStates.delete(channelId);
        return;
      }

      await startRaidBattle(s);
    }, RAID_TIMEOUT_MS);
  },

  async executeAdd(interaction, channelId, userId, username) {
    const query = interaction.options.getString('card');
    if (!query) return interaction.reply({ content: 'Please specify a card name or ID.', ephemeral: true });

    const state = raidStates.get(channelId);
    if (!state || state.phase !== 'lobby') {
      return interaction.reply({ content: 'There is no active raid lobby in this channel.', ephemeral: true });
    }

    if (!state.crewMembers.includes(userId)) {
      return interaction.reply({ content: 'Only members of the raid crew can join!', ephemeral: true });
    }

    if (state.players.length >= MAX_PLAYERS) {
      return interaction.reply({ content: `The raid is full! (${MAX_PLAYERS} players max)`, ephemeral: true });
    }

    const existing = state.players.find(p => p.userId === userId);
    if (existing) {
      return interaction.reply({ content: 'You are already in this raid. Use `/raid remove` to leave first.', ephemeral: true });
    }

    const def = findCardByQuery(query);
    if (!def || def.ship || def.artifact) {
      return interaction.reply({ content: `Could not find a card matching **${query}**.`, ephemeral: true });
    }

    const user = await User.findOne({ userId });
    if (!user) return interaction.reply({ content: 'You need an account first.', ephemeral: true });

    const entry = (user.ownedCards || []).find(e => e.cardId === def.id);
    if (!entry) {
      return interaction.reply({ content: `You don't own **${def.character}**!`, ephemeral: true });
    }

    const card = buildPlayerCard(def, entry, user.ownedCards);
    state.players.push({ userId, username, entry, card });

    await updateRaidMessage(state);
    return interaction.reply({ content: `${def.emoji || ''} **${def.character}** joined the raid!`, ephemeral: false });
  },

  async executeRemove(interaction, channelId, userId) {
    const state = raidStates.get(channelId);
    if (!state || state.phase !== 'lobby') {
      return interaction.reply({ content: 'There is no active raid lobby in this channel.', ephemeral: true });
    }

    const idx = state.players.findIndex(p => p.userId === userId);
    if (idx === -1) {
      return interaction.reply({ content: 'You are not currently in this raid.', ephemeral: true });
    }

    const removed = state.players.splice(idx, 1)[0];
    await updateRaidMessage(state);
    return interaction.reply({ content: `Removed **${removed.card?.def?.character || 'your card'}** from the raid.`, ephemeral: true });
  },

  async executeForceStart(interaction, channelId, userId) {
    const state = raidStates.get(channelId);
    if (!state || state.phase !== 'lobby') {
      return interaction.reply({ content: 'There is no active raid lobby in this channel.', ephemeral: true });
    }

    if (state.ownerId !== userId) {
      return interaction.reply({ content: 'Only the raid owner can force-start the raid.', ephemeral: true });
    }

    if (state.players.length === 0) {
      return interaction.reply({ content: 'No players have joined yet! Add your card with `/raid add <card>`.', ephemeral: true });
    }

    if (state.startTimeoutId) {
      clearTimeout(state.startTimeoutId);
      state.startTimeoutId = null;
    }

    await interaction.reply({ content: '⚔️ Starting the raid!', ephemeral: true });
    await startRaidBattle(state);
  },

  async handleButton(interaction, customId) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const state = raidStates.get(channelId);

    if (!state) {
      return interaction.reply({ content: 'This raid is no longer active.', ephemeral: true });
    }

    // Start raid button (lobby)
    if (customId === 'raid_start') {
      if (state.ownerId !== userId) {
        return interaction.reply({ content: 'Only the raid owner can start the raid early.', ephemeral: true });
      }
      if (state.phase !== 'lobby') {
        return interaction.reply({ content: 'The raid has already started.', ephemeral: true });
      }
      if (state.players.length === 0) {
        return interaction.reply({ content: 'No players have joined yet!', ephemeral: true });
      }
      if (state.startTimeoutId) {
        clearTimeout(state.startTimeoutId);
        state.startTimeoutId = null;
      }
      await interaction.deferUpdate();
      await startRaidBattle(state);
      return;
    }

    // Battle actions
    if (!customId.startsWith('raid_action:')) return;

    if (state.phase !== 'battle') {
      return interaction.reply({ content: 'The raid has not started yet.', ephemeral: true });
    }

    if (state.finished) {
      return interaction.reply({ content: 'The raid is already over.', ephemeral: true });
    }

    const currentPlayerId = state.turnOrder[state.currentTurnIndex];
    if (currentPlayerId !== userId) {
      return interaction.reply({ content: "It's not your turn!", ephemeral: true });
    }

    const playerData = state.players.find(p => p.userId === userId);
    if (!playerData || !playerData.card || !playerData.card.alive) {
      return interaction.reply({ content: "Your card has been KO'd!", ephemeral: true });
    }

    const card = playerData.card;
    const action = customId.split(':')[1];

    await interaction.deferUpdate();

    if (action === 'rest') {
      if (card.turnsUntilRecharge > 0) {
        card.turnsUntilRecharge = Math.max(0, card.turnsUntilRecharge - 1);
      } else {
        card.energy = Math.min(3, (card.energy || 0) + 1);
      }
      state.lastAction = `${card.def.emoji || ''} **${playerData.username}**'s ${card.def.character} rests. ${energyDisplay(card.energy)}`;
      await advanceTurn(state);
      return;
    }

    if (action === 'attack' || action === 'special') {
      const cost = action === 'special' ? 3 : 1;

      if (card.energy < cost) {
        return interaction.followUp({ content: `Not enough energy! (Need ${cost}, have ${card.energy})`, ephemeral: true });
      }

      if (hasStatusLock(card)) {
        const reason = getStatusLockReason(card);
        card.energy -= cost;
        card.turnsUntilRecharge = 2;
        state.lastAction = `${card.def.emoji || ''} **${playerData.username}**'s ${card.def.character} is ${reason} and cannot act!`;
        await advanceTurn(state);
        return;
      }

      card.energy = Math.max(0, card.energy - cost);
      card.turnsUntilRecharge = 2;

      const baseDmg = calculateUserDamage(card, action);
      const multiplier = getDamageMultiplier(card.def.attribute, state.boss.attribute);
      const dmg = Math.max(1, Math.floor(baseDmg * multiplier));

      state.boss.currentHP = Math.max(0, state.boss.currentHP - dmg);

      const effectStr = multiplier > 1 ? ' (Effective!)' : multiplier < 1 ? ' (Weak)' : '';
      const attackLabel = action === 'special' ? (card.def.special_attack || 'Special Attack') : 'attacks';
      state.lastAction = `${card.def.emoji || ''} **${playerData.username}**'s ${card.def.character} ${attackLabel} **${state.boss.name}** for **${dmg} DMG**${effectStr}!`;

      if (state.boss.currentHP <= 0) {
        state.boss.currentHP = 0;
        await handleVictory(state);
        return;
      }

      await advanceTurn(state);
      return;
    }
  },

  getRaidState(channelId) {
    return raidStates.get(channelId);
  }
};
