const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  title: { type: String },
  rank: { type: String },
  speed: { type: Number, default: 0 },
  power: { type: Number, default: 0 },
  health: { type: Number, default: 0 },
  type: { type: String },
  ability: { type: String, default: null },
  image: { type: String },
  isupgrade: { type: Boolean, default: false },
  upgrade: { type: mongoose.Schema.Types.Mixed, default: null },
  upgradereq: { type: mongoose.Schema.Types.Mixed, default: null },
  moves: { type: Array, default: [] },
  attackrange: { type: Array, default: [] }
});

module.exports = mongoose.model('Card', CardSchema);
