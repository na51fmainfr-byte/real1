# Battle Plans

This document outlines the various card types used in battles along with their defining characteristics and special rules.

## Card Types

- **Combat**: Standard attacking cards. They participate in battles using their attack range (attack_min to attack_max).

- **Tank**: High-HP defenders. Tanks have **1.5x the baseline health** of a typical card of the same rank and must be defeated before opponents can target other cards in the same battle.

- **Boost**: Support cards that do not attack. Instead they provide passive stat buffs to specific characters or teams. Boost cards do not display an attack value; their effect is described in a `boost` field within the card definition.

- **Special**: Event‑ or rare‑type cards with unique passive effects that fall outside the normal combat/boost paradigm. Examples include revives, burn effects, team‑wide buffs, etc. Their particular effect is described in an `effect` field on the card definition.

## Notes & Rules

- **Luffy U4 Rule**: Sun God Revival – On first knockout in a battle, this card revives to **100% HP**. Effect can only occur **once per battle**.
