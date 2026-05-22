Game Items Reference
====================

This file documents the primary in-game items and identifiers used by the bot. For exhaustive lists (e.g., all levelers or cards) see the relevant data files in `data/`.

- Reset Token (`resetTokens` / shop: "reset token")
  - Consumable used to perform a personal "reset" action (various commands reference reset tokens).

- Cola (`cola`)
  - Consumable used by ships/fuel features. Stored in user's `items` as `cola`.

- God Token (`god_token`)
  - Rare shop item (stored in `items` as `god_token`).

- Chests (`a_chest`, `b_chest`, `c_chest`)
  - Purchaseable chest items that contain random rewards (beli, items, etc.). Defined in `data/chests.js`.

- Rods (`basic_rod`, `gold_rod`, `white_rod`, `meme_rod`)
  - Fishing rods with different durability and luck bonuses. Stored in `items` with `durability` and tracked as `currentRod`. Definitions in `data/rods.js`.

- Levelers (many ids)
  - Small XP items used to feed cards. See `data/levelers.js` for the full list and their XP values.

- Shards (`red_shard`, `blue_shard`, `green_shard`, `yellow_shard`, `purple_shard`)
  - Crafting/trading currency used for card trades and upgrades. Display names/emojis are defined in `commands/trade.js` and used by inventory/trade flows.

- Meme Rod (`meme_rod`)
  - Special low-durability rod; given via owner command or rewards. Stored in `items` with durability.

- Pack / Crew packs
  - Represented in `packInventory` on the user document (keyed by crew name). Packs are created/consumed by stock/pack open logic.

- Other shop items
  - The in-shop mapping is in `commands/buy.js` (e.g., Reset Token, God Token, Cola, chest types).

Where to look in code:
- Card definitions: `data/cards.js`
- Chests: `data/chests.js`
- Rods: `data/rods.js`
- Levelers: `data/levelers.js`
- Shop configuration: `commands/buy.js`
- Inventory helpers: `utils/inventoryHelper.js`

If you'd like this file expanded into a more detailed markdown (with emojis, costs, and usage examples), tell me which items you want prioritized and I'll expand it.
