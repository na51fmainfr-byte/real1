const mongoose = require('mongoose');
const { Schema } = mongoose;

const MarketListingSchema = new Schema({
  sellerId: { type: String, required: true },
  sellerName: { type: String, required: true },
  cardId: { type: String, required: true },
  cardName: { type: String, required: true },
  cardEmoji: { type: String, default: '' },
  cardRank: { type: String, required: true },
  cardAttribute: { type: String, default: '' },
  price: { type: Number, required: true },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  equippedTo: { type: String, default: null },
  starLevel: { type: Number, default: 0 },
  messageId: { type: String, default: null },
  channelId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

MarketListingSchema.index({ expiresAt: 1 });
MarketListingSchema.index({ sellerId: 1 });
MarketListingSchema.index({ cardRank: 1 });
MarketListingSchema.index({ cardAttribute: 1 });
MarketListingSchema.index({ starLevel: 1 });

module.exports = mongoose.model('MarketListing', MarketListingSchema);
