const User = require('../models/User');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
const isail = require('./isail');
const { getShipById, getCardById, consumeShipCola } = require('../utils/cards');
const { getMapImageBuffer } = require('../utils/mapImage');
const { moreCards } = require('../data/morecards');
const { cards: baseCards } = require('../data/cards');
const sailStages = require('../data/sailStages');

// map images are chosen from static assets (see utils/mapImage)
const ISLANDS = [
  { id: 'fusha_village', name: 'Fusha Village', image: 'https://files.catbox.moe/3e2yh0.webp', defaultUnlocked: true },
  { id: 'alvidas_hideout', name: 'Alvidas Hideout', image: 'https://files.catbox.moe/oqujkr.webp' },
  { id: 'shells_town', name: "Shell's Town", image: 'https://files.catbox.moe/oqujkr.webp' },
  { id: 'orange_town', name: 'Orange Town', image: 'https://files.catbox.moe/cnu1po.webp' },
  { id: 'syrup_village', name: 'Syrup Village', image: 'https://files.catbox.moe/ppzl5v.webp' },
  { id: 'baratie', name: 'Baratie', image: 'https://files.catbox.moe/mx2i0t.webp' },
  { id: 'arlong_park', name: 'Arlong Park', image: 'https://files.catbox.moe/1zvxl6.webp' },
  { id: 'loguetown', name: 'Loguetown', image: 'https://files.catbox.moe/2uqofa.webp' }
];

const LOCK_ICON = 'https://files.catbox.moe/9zwl6i.webp';

function isIslandUnlocked(user, idx) {
  if (idx === 0) return true; // Fusha Village unlocked by default
  const prev = ISLANDS[idx - 1];
  if (!prev) return false;
  if (!user.storyProgress) return false;
  const prevProg = user.storyProgress[prev.id];
  if (!Array.isArray(prevProg)) return false;
  // unlock next island when the previous island's final stage is completed
  // determine previous island's max stage from data/sailStages.js
  const prevDef = (sailStages || []).find(s => s.id === prev.id) || {};
  const prevMaxStage = Array.isArray(prevDef.stages) && prevDef.stages.length > 0 ? prevDef.stages.length : 3;
  return prevProg.some(s => Number(s) === prevMaxStage);
}

async function renderMapImage(user) {
  // Return a map image buffer chosen by user progress
  return getMapImageBuffer(user);
}

function findEnemyDef(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  let def = (moreCards || []).find(c => (c.character && c.character.toLowerCase() === n) || (Array.isArray(c.alias) && c.alias.some(a => a.toLowerCase() === n)));
  if (def) return def;
  def = (baseCards || []).find(c => (c.character && c.character.toLowerCase() === n) || (Array.isArray(c.alias) && c.alias.some(a => a.toLowerCase() === n)));
  return def || null;
}

function makeMarineFromDef(def, hpMultiplier = 3, atkMultiplier = 1) {
  if (!def) return null;
  const baseAtk = (def.attack_min && def.attack_max) ? Math.floor((def.attack_min + def.attack_max) / 2) : (def.power || 1);
  const atk = Math.max(0, Math.floor(baseAtk * (typeof atkMultiplier === 'number' ? atkMultiplier : 1)));
  return {
    rank: def.character || def.title || 'Enemy',
    speed: def.speed || 1,
    atk,
    maxHP: (def.health || def.hp || 1) * hpMultiplier,
    attribute: def.attribute || 'STR',
    emoji: def.emoji || '',
    image: def.image_url || def.image || null
  };
}

module.exports = {
  name: 'sail',
  description: 'Begin the Story Mode sailing adventure',
  options: [],
  async execute({ message, interaction, args }) {
    const userId = message ? message.author.id : interaction.user.id;
    const discordUser = message ? message.author : interaction.user;
    const user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    if (!Array.isArray(user.team) || user.team.length === 0) {
      const reply = 'Please set your team first.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    if (!user.activeShip) {
      const reply = 'Please set a ship first.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    user.ships = user.ships || {};
    const shipDef = getShipById(user.activeShip) || getCardById(user.activeShip) || null;
    const defaultCola = shipDef ? (shipDef.cola !== undefined ? shipDef.cola : (shipDef.maxCola !== undefined ? shipDef.maxCola : 0)) : 0;
    if (!user.ships[user.activeShip]) {
      user.ships[user.activeShip] = { cola: defaultCola, maxCola: (shipDef && shipDef.maxCola !== undefined) ? shipDef.maxCola : defaultCola };
      await user.save();
    }
    const shipState = user.ships[user.activeShip] || { cola: 0 };
    if ((shipState.cola || 0) <= 0) {
      const reply = 'Your ship is out of cola! Fuel it up using /fuel ship.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

      // Directly send the checkpoint map image with island select (no intro)
      let buffer = null;
      try {
        buffer = await renderMapImage(user);
      } catch (err) {
        console.warn('Failed to render sail map image:', err?.message || err);
      }
      const files = [];
      if (buffer) {
        files.push(new AttachmentBuilder(buffer, { name: 'eastblue.png' }));
      }

      // build select options for unlocked islands
      const options = [];
      ISLANDS.forEach((isl, idx) => {
        if (isIslandUnlocked(user, idx)) {
          options.push({ label: isl.name, value: isl.id });
        }
      });
      // add infinite sail / isail as last option (Navy base)
      options.push({ label: 'Navy base', value: 'navy_base', emoji: '<:Marines:1480016473794805760>' });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`sail_select:${userId}`)
        .setPlaceholder('Choose an unlocked island')
        .addOptions(options);
      const row = new ActionRowBuilder().addComponents(menu);

      const payload = { components: [row] };
      if (files.length) payload.files = files;
      if (message) {
        return message.channel.send(payload);
      }
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply(payload);
      }
      return interaction.followUp(payload);
  },

  // handle button interactions (sail_ready and sail_stage)
  async handleButton(interaction, action, cardId) {
    try {
      if (action === 'sail_ready') {
        const ownerId = cardId;
        if (interaction.user.id !== ownerId) return interaction.reply({ content: 'This is not your sail session.', ephemeral: true });
        const user = await User.findOne({ userId: interaction.user.id });
        if (!user) return interaction.reply({ content: 'No profile found.', ephemeral: true });

        await interaction.deferUpdate();
        let buffer = null;
        try {
          buffer = await renderMapImage(user);
        } catch (err) {
          console.warn('Failed to render sail map image:', err?.message || err);
        }
        const files = [];
        if (buffer) {
          files.push(new AttachmentBuilder(buffer, { name: 'eastblue.png' }));
        }

        // build select options for unlocked islands
        const options = [];
        ISLANDS.forEach((isl, idx) => {
          if (isIslandUnlocked(user, idx)) {
            options.push({ label: isl.name, value: isl.id });
          }
        });

        // add Navy base as last option
        options.push({ label: 'Navy base', value: 'navy_base', emoji: '<:Marines:1480016473794805760>' });

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`sail_select:${interaction.user.id}`)
          .setPlaceholder('Choose an unlocked island')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(menu);
        const payload = { components: [row] };
        if (files.length) payload.files = files;
        // Edit reply to include the map image file and keep the dropdown (no embed)
        return interaction.editReply(payload);
      }

      if (action === 'sail_stage') {
        // cardId will be of form 'island|stage|ownerId'
        const parts = (cardId || '').split('|');
        const islandId = parts[0];
        const stageNum = parseInt(parts[1], 10) || 0;
        const ownerId = parts[2];
        if (!islandId || !stageNum) return interaction.reply({ content: 'Invalid stage selection.', ephemeral: true });
        if (interaction.user.id !== ownerId) return interaction.reply({ content: 'This stage selection is not for you.', ephemeral: true });

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user) return interaction.reply({ content: 'User not found.', ephemeral: true });

        if (!Array.isArray(user.team) || user.team.length === 0) return interaction.reply({ content: 'Please set your team first.', ephemeral: true });
        if (!user.activeShip) return interaction.reply({ content: 'Please set a ship first.', ephemeral: true });
        user.ships = user.ships || {};
        const shipDef2 = getShipById(user.activeShip) || getCardById(user.activeShip) || null;
        const defaultCola2 = shipDef2 ? (shipDef2.cola !== undefined ? shipDef2.cola : (shipDef2.maxCola !== undefined ? shipDef2.maxCola : 0)) : 0;
        if (!user.ships[user.activeShip]) {
          user.ships[user.activeShip] = { cola: defaultCola2, maxCola: (shipDef2 && shipDef2.maxCola !== undefined) ? shipDef2.maxCola : defaultCola2 };
        }
        if (!consumeShipCola(user)) return interaction.reply({ content: 'Your ship is out of cola! Fuel it up using /fuel ship.', ephemeral: true });
        await user.save();

        // Build wave slices for this story stage, falling back to single
        // enemy definitions if no structured stage waves exist.
        try {
          const waveSlices = isail.buildStageWaveSlices(islandId, stageNum);
          if (Array.isArray(waveSlices) && waveSlices.length > 0) {
            await isail.startBattleWithMarines({ interaction, user, discordUser: interaction.user, marines: waveSlices[0], waveSlices, storyMode: true, storyKey: islandId, storyStage: stageNum });
            return;
          }
        } catch (e) {
          console.error('Failed to build stage wave slices:', e);
        }

        // Fallback to legacy single-enemy behavior
        let marines = [];
        if (islandId === 'fusha_village') {
          const name = stageNum === 1 ? 'Pistol Bandit' : stageNum === 2 ? 'Higuma' : 'Master of the Near Sea';
          const def = findEnemyDef(name);
          const m = makeMarineFromDef(def, 1, 1);
          if (m) marines.push(m);
        } else if (islandId === 'alvidas_hideout') {
          // Alvida's Hideout story progression
          const name = stageNum === 1 ? 'Mohji & Richie' : stageNum === 2 ? 'Cabaji' : 'Alvida';
          const def = findEnemyDef(name);
          const m = makeMarineFromDef(def, 1, 1);
          if (m) marines.push(m);
        }

        try {
          await isail.startBattleWithMarines({ interaction, user, discordUser: interaction.user, marines, storyMode: true, storyKey: islandId, storyStage: stageNum });
          return;
        } catch (e) {
          console.error('Failed to start stage battle', e);
          return interaction.reply({ content: 'Failed to start battle.', ephemeral: true });
        }
      }

      return interaction.reply({ content: 'Unknown sail action.', ephemeral: true });
    } catch (err) {
      console.error('sail.handleButton error', err);
      try {
        if (!interaction.replied) interaction.reply({ content: 'Error handling sail action.', ephemeral: true });
      } catch (e) {}
    }
  },

  // handle select menu for island selection
  async handleSelect(interaction) {
    const [action, ownerId] = interaction.customId.split(':');
    if (action !== 'sail_select') return interaction.reply({ content: 'Unknown select.', ephemeral: true });
    if (interaction.user.id !== ownerId) return interaction.reply({ content: 'This selection is not for you.', ephemeral: true });

    const islandId = interaction.values && interaction.values[0];
    if (!islandId) return interaction.reply({ content: 'No island selected.', ephemeral: true });

    // If user selected the Navy base, forward to infinite sail (isail)
    if (islandId === 'navy_base') {
      // Acknowledge and consume cola similarly to story stages, then start isail
      await interaction.deferUpdate();
      const user = await User.findOne({ userId: interaction.user.id });
      if (!user) return interaction.followUp({ content: 'User not found.', ephemeral: true });
      if (!Array.isArray(user.team) || user.team.length === 0) return interaction.followUp({ content: 'Please set your team first.', ephemeral: true });
      if (!user.activeShip) return interaction.followUp({ content: 'Please set a ship first.', ephemeral: true });
      user.ships = user.ships || {};
      const shipDef2 = getShipById(user.activeShip) || getCardById(user.activeShip) || null;
      const defaultCola2 = shipDef2 ? (shipDef2.cola !== undefined ? shipDef2.cola : (shipDef2.maxCola !== undefined ? shipDef2.maxCola : 0)) : 0;
      if (!user.ships[user.activeShip]) {
        user.ships[user.activeShip] = { cola: defaultCola2, maxCola: (shipDef2 && shipDef2.maxCola !== undefined) ? shipDef2.maxCola : defaultCola2 };
      }
      const shipState2 = user.ships[user.activeShip];
      if (!shipState2 || (shipState2.cola || 0) <= 0) return interaction.followUp({ content: 'Your ship is out of cola! Fuel it up using /fuel ship.', ephemeral: true });

      if (!consumeShipCola(user)) return interaction.followUp({ content: 'Your ship is out of cola! Fuel it up using /fuel ship.', ephemeral: true });
      await user.save();

      // Use a message-style call so isail.execute uses channel send rather than interaction.reply
      const fakeMessage = {
        channel: interaction.channel,
        author: interaction.user,
        reply: async (content) => interaction.followUp(content)
      };
      try {
        await isail.execute({ message: fakeMessage, skipMapFirst: true });
      } catch (e) {
        console.error('Failed to open Navy base from sail select', e);
        return interaction.followUp({ content: 'Failed to open Navy base.', ephemeral: true });
      }
      return;
    }

    const island = ISLANDS.find(i => i.id === islandId);
    if (!island) return interaction.reply({ content: 'Island not found.', ephemeral: true });

    // auto-start the stage the user is currently on (no manual stage choice)
    await interaction.deferUpdate();
    const user = await User.findOne({ userId: interaction.user.id });
    if (!user) return interaction.followUp({ content: 'User not found.', ephemeral: true });

    // consume 1 cola for starting the stage (centralized)
    if (!consumeShipCola(user)) return interaction.followUp({ content: 'Your ship is out of cola! Fuel it up using /fuel ship.', ephemeral: true });
    await user.save();
    const islandProg = (user.storyProgress && Array.isArray(user.storyProgress[island.id])) ? user.storyProgress[island.id] : [];
    // Determine how many stages this island actually has from data/sailStages.js
    const stageDef = (sailStages || []).find(s => s.id === island.id) || {};
    const maxStage = Array.isArray(stageDef.stages) && stageDef.stages.length > 0 ? stageDef.stages.length : 3;
    let stageToStart = 1;
    for (let s = 1; s <= maxStage; s++) {
      if (!islandProg.some(x => Number(x) === s)) { stageToStart = s; break; }
    }
    if (!stageToStart) stageToStart = maxStage;

    // Attempt to build structured wave slices for this stage
    try {
      const waveSlices = isail.buildStageWaveSlices(island.id, stageToStart);
      if (Array.isArray(waveSlices) && waveSlices.length > 0) {
        await isail.startBattleWithMarines({ interaction, user, discordUser: interaction.user, marines: waveSlices[0], waveSlices, storyMode: true, storyKey: island.id, storyStage: stageToStart });
        return;
      }
    } catch (e) {
      console.error('Failed to build stage wave slices:', e);
    }

    // Fallback to legacy single-enemy behavior
    let marines = [];
    if (island.id === 'fusha_village') {
      const name = stageToStart === 1 ? 'Pistol Bandit' : stageToStart === 2 ? 'Higuma' : 'Master of the Near Sea';
      const def = findEnemyDef(name);
      const m = makeMarineFromDef(def, 1, 1);
      if (m) marines.push(m);
    } else if (island.id === 'alvidas_hideout') {
      const name = stageToStart === 1 ? 'Mohji & Richie' : stageToStart === 2 ? 'Cabaji' : 'Alvida';
      const def = findEnemyDef(name);
      const m = makeMarineFromDef(def, 1, 1);
      if (m) marines.push(m);
    }

    try {
      await isail.startBattleWithMarines({ interaction, user, discordUser: interaction.user, marines, storyMode: true, storyKey: island.id, storyStage: stageToStart });
      return;
    } catch (e) {
      console.error('Failed to start stage battle', e);
      return interaction.followUp({ content: 'Failed to start battle.', ephemeral: true });
    }
  }
};
