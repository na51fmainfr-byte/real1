const { createCanvas, loadImage } = require('@napi-rs/canvas');

const COLS = 3;
const ROWS = 3;
const CELL_W = 260;
const CELL_H = 186;
const CANVAS_W = COLS * CELL_W;
const CANVAS_H = ROWS * CELL_H;

const RANK_COLORS = {
  D: '#B87333',
  C: '#f9a53f',
  B: '#c6c6c7',
  A: '#bfddff',
  S: '#9966CC',
  SS: '#26619C',
  UR: '#ff00f0'
};

async function loadImageWithTimeout(url, ms = 6000) {
  return Promise.race([
    loadImage(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

async function generateBinderCanvas(slots) {
  const imageResults = await Promise.allSettled(
    slots.map(s =>
      s && s.cardDef && s.cardDef.image_url
        ? loadImageWithTimeout(s.cardDef.image_url)
        : Promise.resolve(null)
    )
  );

  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  for (let i = 0; i < ROWS * COLS; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL_W;
    const y = row * CELL_H;
    const slot = slots[i];

    ctx.fillStyle = '#161b22';
    ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);

    if (!slot) {
      ctx.fillStyle = '#1c2128';
      ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
      continue;
    }

    const { cardDef, owned } = slot;
    const imgResult = imageResults[i];
    const img = imgResult && imgResult.status === 'fulfilled' ? imgResult.value : null;

    if (img) {
      const PAD = 6;
      ctx.globalAlpha = owned ? 1.0 : 0.2;
      ctx.drawImage(img, x + PAD, y + PAD, CELL_W - PAD * 2, CELL_H - PAD * 2);
      ctx.globalAlpha = 1.0;
    } else {
      ctx.fillStyle = RANK_COLORS[cardDef.rank] || '#444444';
      ctx.globalAlpha = owned ? 0.25 : 0.08;
      ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
      ctx.globalAlpha = 1.0;
    }

    if (!owned) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
      ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Not Owned', x + CELL_W / 2, y + CELL_H / 2);
    }

    const rank = cardDef.rank || '?';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 5;
    ctx.fillStyle = RANK_COLORS[rank] || '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(rank, x + CELL_W - 7, y + 7);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = '#2d333b';
  ctx.lineWidth = 2;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_W, 0);
    ctx.lineTo(c * CELL_W, CANVAS_H);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_H);
    ctx.lineTo(CANVAS_W, r * CELL_H);
    ctx.stroke();
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateBinderCanvas };
