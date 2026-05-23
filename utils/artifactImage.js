const { createCanvas, loadImage } = require('@napi-rs/canvas');

// Optimized for minimal image generation
const { cards } = require('../data/cards');

async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const controller = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? null : new AbortController();
    const response = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller ? controller.signal : AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    return null;
  }
}

function extractEmojiUrl(emoji) {
  if (!emoji || typeof emoji !== 'string') return null;
  const m = emoji.match(/<a?:[^:]+:(\d+)>/);
  if (!m) return null;
  return `https://cdn.discordapp.com/emojis/${m[1]}.png`;
}

async function generateArtifactImage(artifactDef) {
  if (!artifactDef) throw new Error('artifactDef required');

  const canvasWidth = 512;
  const canvasHeight = 512;
  // Initialize a fully transparent canvas
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Coordinates for perfect centering
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // --- Step 1: Draw the Emoji as the sole element ---
  const emojiUrl = extractEmojiUrl(artifactDef.emoji);
  
  if (emojiUrl) {
    const ebuf = await fetchImageBuffer(emojiUrl);
    if (ebuf) {
      try {
        const eimg = await loadImage(ebuf);
        // Draw the central emoji very large to fill the context
        const size = 320; 
        ctx.drawImage(eimg, centerX - size / 2, centerY - size / 2, size, size);
      } catch (e) {}
    }
  } else if (artifactDef.emoji) {
    // Fallback: If it's a standard unicode emoji string (not custom)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 220px sans-serif'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(artifactDef.emoji, centerX, centerY);
  }

  // --- Step 2: Return the buffer without any background or framing ---
  return canvas.toBuffer('image/png');
}

module.exports = { generateArtifactImage };