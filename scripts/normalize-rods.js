#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { normalizeAllUserRods } = require('../utils/inventoryHelper');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Set it in .env or environment.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const normalizedCount = await normalizeAllUserRods();
    console.log(`Rod normalization complete. Updated ${normalizedCount} user${normalizedCount === 1 ? '' : 's'}.`);
    process.exit(0);
  } catch (err) {
    console.error('Rod normalization failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
