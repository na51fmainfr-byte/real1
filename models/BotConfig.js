const mongoose = require('mongoose');

const botConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

const BotConfig = mongoose.model('BotConfig', botConfigSchema);

async function getBotConfig(key) {
  try {
    const doc = await BotConfig.findOne({ key });
    return doc ? doc.value : null;
  } catch (err) {
    console.error(`[BotConfig] Error getting ${key}:`, err);
    return null;
  }
}

async function setBotConfig(key, value) {
  try {
    await BotConfig.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
  } catch (err) {
    console.error(`[BotConfig] Error setting ${key}:`, err);
  }
}

async function deleteBotConfig(key) {
  try {
    await BotConfig.deleteOne({ key });
  } catch (err) {
    console.error(`[BotConfig] Error deleting ${key}:`, err);
  }
}

module.exports = { BotConfig, getBotConfig, setBotConfig, deleteBotConfig };
