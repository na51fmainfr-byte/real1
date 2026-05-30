#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/remove-invalid-item.js <itemId> [userId]');
    process.exit(1);
  }
  const itemId = args[0];
  const userId = args[1];
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Please set MONGODB_URI in your .env');
    process.exit(1);
  }

  await mongoose.connect(uri).catch(err => {
    console.error('MongoDB connect error', err);
    process.exit(1);
  });

  try {
    if (userId) {
      const user = await User.findOne({ userId });
      if (!user) {
        console.error('User not found:', userId);
        process.exit(1);
      }
      const before = (user.items || []).length;
      user.items = (user.items || []).filter(i => i.itemId !== itemId);
      await user.save();
      const after = (user.items || []).length;
      console.log(`Removed ${before - after} item(s) (${itemId}) from user ${userId}`);
    } else {
      const res = await User.updateMany({}, { $pull: { items: { itemId } } });
      console.log(`Removed item ${itemId} from ${res.modifiedCount} user(s).`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
