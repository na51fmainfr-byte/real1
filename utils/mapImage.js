const MAP_URLS = {
  fusha_village: 'https://files.catbox.moe/c9kjgd.webp',
  alvidas_hideout: 'https://files.catbox.moe/54sd93.webp',
  shells_town: 'https://files.catbox.moe/hz5htx.webp',
  orange_town: 'https://files.catbox.moe/pid7tj.webp',
  syrup_village: 'https://files.catbox.moe/j5w72l.webp',
  baratie: 'https://files.catbox.moe/iq5060.webp',
  arlong_park: 'https://files.catbox.moe/h81mo6.webp',
  all_unlocked: 'https://files.catbox.moe/a0cyz2.webp'
};

const ISLAND_ORDER = [
  'fusha_village', 'alvidas_hideout', 'shells_town', 'orange_town', 'syrup_village', 'baratie', 'arlong_park', 'loguetown'
];

async function fetchBuffer(url, timeout = 10000) {
  if (!url) throw new Error('No URL provided');
  let globalFetch = (typeof fetch === 'function') ? fetch : null;
  if (!globalFetch) {
    try {
      globalFetch = require('undici').fetch;
    } catch (_) {
      throw new Error('fetch is not available in this environment');
    }
  }

  const signal = (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function')
    ? AbortSignal.timeout(timeout)
    : undefined;
  const controller = signal ? null : new AbortController();
  const options = {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  };
  if (signal) {
    options.signal = signal;
  } else if (controller) {
    options.signal = controller.signal;
    setTimeout(() => controller.abort(), timeout);
  }

  const res = await globalFetch(url, options);
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function getMapImageUrl(user) {
  const storyProgress = (user && user.storyProgress) || {};
  const sailStages = require('../data/sailStages');

  for (const id of ISLAND_ORDER) {
    const prog = storyProgress[id];
    if (!Array.isArray(prog) || prog.length === 0) {
      // user hasn't started this island yet -> show that island
      return MAP_URLS[id] || MAP_URLS.all_unlocked;
    }
    // determine island's max stage (fallback to 3)
    const islandDef = (sailStages || []).find(s => s.id === id) || {};
    const maxStage = Array.isArray(islandDef.stages) && islandDef.stages.length > 0 ? islandDef.stages.length : 3;
    // be tolerant of numeric strings stored in DB
    const hasCompletedFinal = prog.some(s => Number(s) === maxStage);
    if (!hasCompletedFinal) return MAP_URLS[id] || MAP_URLS.all_unlocked;
  }
  // everything complete
  return MAP_URLS.all_unlocked;
}

async function getMapImageBuffer(user) {
  const url = getMapImageUrl(user);
  try {
    return await fetchBuffer(url);
  } catch (e) {
    console.warn(`Map image unavailable: ${url} - ${e?.message || e}`);
    return null;
  }
}

module.exports = { getMapImageUrl, getMapImageBuffer, fetchBuffer }; 
