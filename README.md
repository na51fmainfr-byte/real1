# theactualbot

This project implements a One Piece Discord card bot supporting prefix and slash commands.  It includes pull rates, pity, card info, fuzzy search and upgrade mechanics.

## Commands

Use either the `op` prefix or corresponding slash commands; behaviour and output are identical.

- `op start` / `/start` – register an account and receive a starter card
- `op pull` / `/pull` – perform a card pull (costs one pull, limited per reset).  Pity progress is shown and S+ can be guaranteed after 250 pulls.
- `op card <query>` / `/card <query>` – display the card embed.  Shows ownership status, stats (scaled by level), and mastery navigation buttons.
- `op info <query>` / `/info <query>` – like `card` but also reports if you have ever owned the card (history).
- `op upgrade <query>` / `/upgrade <query>` – upgrade an owned card to its next mastery level, resetting level to 1 and removing the previous version.

Aliases and partial names are supported; always resolve to base (mastery 1) when multiple masteries share a name.  Only mastery 1 cards are pullable; further masteries must be obtained via upgrades.

Cards, users, and configuration are loaded from the `data/` directory and MongoDB respectively.  Sensitive tokens are read from `.env` and ignored by git.

> **Emoji permission:** if you use application or external emojis (like Strawats), make sure the bot role has the **Use External Emojis** permission on the guild and that the token was invited with the scope that allows external emoji usage. Without it the emoji will render as raw text in embeds.