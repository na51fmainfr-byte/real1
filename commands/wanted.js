const { createCanvas, loadImage, registerFont } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const fetch = globalThis.fetch;
const fs = require('fs');
const path = require('path');
const User = require('../models/User');

// Editable coordinates / scaling for fine-tuning the poster placement.
// Tweak these numbers to move/resize the avatar and bounty text.
const POSTER_CONFIG = {
  posterUrl: 'https://s13.gifyu.com/images/bquUt.png',
  
  // Adjusted to center the image better in the frame
  avatar: { 
    x: 100, 
    y: 138, 
    size: 232
  },
  
  // Moves the numbers (150) down onto the specific bounty line
  bounty: { 
    x: 215, // Centered horizontally
    y: 505, // Lowered to align with the symbols/line
    fontSize: 22, 
    fontFamily: 'Times New Roman, serif', 
    color: '#3e342a', 
    letterSpacing: 10 
  },
  
  // Lowers the name into the large empty space below "DEAD OR ALIVE"
  name: { 
    x: 215, // Centered horizontally
    y: 460, // Moved down to avoid overlapping "DEAD OR ALIVE"
    fontSize: 40, 
    fontFamily: 'Times New Roman, serif', 
    color: '#3e342a', 
    letterSpacing: 4 
  }
};

// Try to register a local wanted poster font if provided at assets/fonts/Wanted.ttf
try {
  const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
  if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
  const pirataPath = path.join(fontsDir, 'PirataOne-Regular.ttf');
  const wantedPath = path.join(fontsDir, 'Wanted.ttf');

  // prefer a shipped Wanted.ttf if present (legacy), otherwise try PirataOne from Google Fonts repo
  if (fs.existsSync(wantedPath)) {
    registerFont(wantedPath, { family: 'Pirata One' });
  } else if (fs.existsSync(pirataPath)) {
    registerFont(pirataPath, { family: 'Pirata One' });
  } else {
    // attempt to download PirataOne from Google Fonts github repo (OFL)
    (async () => {
      try {
        const url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/pirataone/PirataOne-Regular.ttf';
        const resp = await fetch(url);
        if (resp && resp.ok) {
          const arr = Buffer.from(await resp.arrayBuffer());
          fs.writeFileSync(pirataPath, arr);
          registerFont(pirataPath, { family: 'Pirata One' });
          console.log('Downloaded and registered Pirata One font for wanted posters');
        }
      } catch (e) {
        // ignore download errors and fall back to system fonts
        console.warn('Could not download Pirata One font automatically:', e && e.message);
      }
    })();
  }
} catch (e) {
  // ignore font registration errors; will fall back to default fonts
}

// Helper: draw image as CSS 'cover' inside destination rectangle
function drawImageCover(ctx, img, dx, dy, dw, dh) {
  const sw = img.width || img.naturalWidth || 0;
  const sh = img.height || img.naturalHeight || 0;
  if (!sw || !sh) {
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }
  const scale = Math.max(dw / sw, dh / sh);
  const swCrop = dw / scale;
  const shCrop = dh / scale;
  const sx = Math.max(0, Math.floor((sw - swCrop) / 2));
  const sy = Math.max(0, Math.floor((sh - shCrop) / 2));
  ctx.drawImage(img, sx, sy, swCrop, shCrop, dx, dy, dw, dh);
}

// Helper: draw text with optional letter spacing and centered at (x,y)
function drawTextWithLetterSpacing(ctx, text, x, y, letterSpacing = 0) {
  if (!letterSpacing) return ctx.fillText(text, x, y);
  const chars = Array.from(String(text));
  // measure each char using current ctx.font
  const widths = chars.map(ch => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((s, w) => s + w, 0) + (chars.length - 1) * letterSpacing;
  let cursor = x - totalWidth / 2;
  // draw each character left-aligned at the computed cursor position
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cursor, y);
    cursor += widths[i] + letterSpacing;
  }
  ctx.textAlign = prevAlign;
}

module.exports = {
  name: 'wanted',
  description: 'Create a wanted poster for a user with their avatar and bounty',
  options: [
    { name: 'target', type: 6, description: 'User to create poster for', required: false },
    { name: 'bounty', type: 3, description: 'Bounty amount to display (overrides stored bounty)', required: false }
  ],

  async execute({ message, interaction, args }) {
    const isMessage = !!message;
    const targetUser = isMessage ? (message.mentions.users.first() || message.author) : (interaction.options.getUser('target') || interaction.user);
    let bountyText = isMessage ? args.slice(1).join(' ') : (interaction.options.getString('bounty') || null);

    // If bounty not provided, try to fetch from user profile
    try {
      if (!bountyText) {
        const targetProfile = await User.findOne({ userId: targetUser.id });
        if (targetProfile && typeof targetProfile.bounty === 'number') bountyText = `Beli ${targetProfile.bounty.toLocaleString()}`;
      }
    } catch (e) {
      // ignore DB lookup errors
    }

    if (!bountyText) bountyText = 'Beli 0';

    try {
      // Fetch poster base image and avatar
      const posterResp = await fetch(POSTER_CONFIG.posterUrl);
      const posterBuf = Buffer.from(await posterResp.arrayBuffer());
      const posterImg = await loadImage(posterBuf);

      const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 512 });
      const avatarResp = await fetch(avatarUrl);
      const avatarBuf = Buffer.from(await avatarResp.arrayBuffer());
      const avatarImg = await loadImage(avatarBuf);

      const canvas = createCanvas(posterImg.width, posterImg.height);
      const ctx = canvas.getContext('2d');

      // draw base poster
      ctx.drawImage(posterImg, 0, 0, canvas.width, canvas.height);

      // Draw avatar to fully cover the poster's image box (no circular crop)
      const ax = POSTER_CONFIG.avatar.x;
      const ay = POSTER_CONFIG.avatar.y;
      const asz = POSTER_CONFIG.avatar.size;
      // draw using cover semantics to fill the square without leaving white edges
      drawImageCover(ctx, avatarImg, ax, ay, asz, asz);

      // Draw name (centered) and bounty (numeric) with letter-spacing
      const nameCfg = POSTER_CONFIG.name || {};
      const nx = nameCfg.x || POSTER_CONFIG.bounty.x;
      const ny = nameCfg.y || (POSTER_CONFIG.bounty.y - 60);
      const nfs = nameCfg.fontSize || 48;
      const nfamily = nameCfg.fontFamily || 'Times New Roman, serif';
      ctx.fillStyle = nameCfg.color || '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${nfs}px ${nfamily}`;
      // subtle shadow for readability (no white contour)
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 6;
      // draw uppercase name
      const displayName = (targetUser.username || targetUser.tag || 'Unknown').toUpperCase();
      drawTextWithLetterSpacing(ctx, displayName, nx, ny, nameCfg.letterSpacing || 2);

      // Draw bounty number centered below name
      const bx = POSTER_CONFIG.bounty.x;
      const by = POSTER_CONFIG.bounty.y;
      const bfs = POSTER_CONFIG.bounty.fontSize || 48;
      const bfamily = POSTER_CONFIG.bounty.fontFamily || 'Times New Roman, serif';
      ctx.fillStyle = POSTER_CONFIG.bounty.color || '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${bfs}px ${bfamily}`;
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 6;
      // format numeric bounty (commas) and remove any non-digit prefix
      let parsed = String(bountyText).replace(/[^0-9]/g, '');
      if (!parsed) parsed = '0';
      const formatted = Number(parsed).toLocaleString('en-US');
      drawTextWithLetterSpacing(ctx, formatted, bx, by, POSTER_CONFIG.bounty.letterSpacing || 8);

      // reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      const buffer = canvas.toBuffer('image/png');
      const attachment = new AttachmentBuilder(buffer, { name: 'wanted.png' });

      if (isMessage) {
        return message.channel.send({ files: [attachment] });
      }

      return interaction.reply({ files: [attachment] });
    } catch (err) {
      console.error('wanted command error', err);
      const reply = 'Failed to create wanted poster.';
      if (isMessage) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }
  }
};
