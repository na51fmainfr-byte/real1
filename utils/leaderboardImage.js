const { createCanvas, loadImage } = require('@napi-rs/canvas');

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function shortName(name, maxLength = 20) {
  if (!name) return 'Unknown';
  return name.length <= maxLength ? name : `${name.slice(0, maxLength - 1)}…`;
}

function formatThousands(value) {
  return value.toLocaleString('en-US');
}

async function generateLeaderboardImage({ leaderboardName, categoryName, topUsers, currentUser, currentRank, currentValue, surpassAmount, totalPlayers, closeness }) {
  const width = 980;
  const height = 1400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0c1221';
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 38px sans-serif';
  ctx.fillText(leaderboardName, 64, 68);

  // Current user card
  const cardX = 64;
  const cardY = 100;
  const cardWidth = width - 128;
  const cardHeight = 238;
  ctx.fillStyle = '#111b33';
  roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 28);
  ctx.fill();

  const avatarSize = 146;
  const avatarX = cardX + 34;
  const avatarY = cardY + 20;

  try {
    const avatarImage = await loadImage(currentUser.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (err) {
    // ignore avatar loading failures
  }

  const titleX = avatarX + avatarSize + 32;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 32px sans-serif';
  ctx.fillText(`#${currentRank} · ${shortName(currentUser.username, 20)} · ${currentValue}`, titleX, avatarY + 62);

  const progressX = titleX;
  const progressY = avatarY + 116;
  const progressW = cardX + cardWidth - progressX - 40;
  const progressH = 22;
  ctx.fillStyle = '#1b2741';
  roundRect(ctx, progressX, progressY, progressW, progressH, 10);
  ctx.fill();
  ctx.fillStyle = '#f8fafb';
  roundRect(ctx, progressX, progressY, clamp(progressW * closeness, 12, progressW), progressH, 10);
  ctx.fill();

  ctx.font = '400 16px sans-serif';
  ctx.fillStyle = '#c8d2ea';
  ctx.fillText(`${totalPlayers} players tracked`, titleX, avatarY + 96);

  // Rows header
  const rowsX = 64;
  const rowsY = cardY + cardHeight + 32;
  ctx.font = '700 24px sans-serif';
  ctx.fillStyle = '#ffffff';

  const rowHeight = 96;
  topUsers.forEach((rowUser, index) => {
    const y = rowsY + index * (rowHeight + 14);
    const backgroundColor = rowUser.userId === currentUser.userId ? '#17294b' : '#111c2f';
    ctx.fillStyle = backgroundColor;
    roundRect(ctx, rowsX, y, cardWidth, rowHeight, 22);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 32px sans-serif';
    ctx.fillText(`#${index + 1}`, rowsX + 24, y + 58);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 28px sans-serif';
    ctx.fillText(shortName(rowUser.username, 22), rowsX + 100, y + 58);

    const rowValue = rowUser.value;
    ctx.font = '600 26px sans-serif';
    const valueText = rowValue;
    const valueWidth = ctx.measureText(valueText).width;
    ctx.fillText(valueText, rowsX + cardWidth - 40 - valueWidth, y + 58);
  });

  return canvas.toBuffer('image/png');
}

module.exports = { generateLeaderboardImage };