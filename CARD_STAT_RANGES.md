# Card Creation Reference Guide

## Stat Ranges by Rank

Use these ranges as guidelines when creating new cards. Values should fall within the min-max range for each stat.
if type is not stated, default to Combat.
if type is boost, attack should be 0.

### D Rank
- **Power:** 0-5
- **Health:** 1-8
- **Speed:** 1-1
- **Attack Min:** 1-1


### C Rank
- **Power:** 5-10
- **Health:** 8-15
- **Speed:** 1-3
- **Attack Min:** 1-3
- **Attack Max:** 1-3

### B Rank
- **Power:** 10-15
- **Health:** 15-26
- **Speed:** 1-5
- **Attack Min:** 1-5
- **Attack Max:** 1-5


### A Rank
- **Power:** 15-20
- **Health:** 26-35
- **Speed:** 3-8
- **Attack Min:** 3-8
- **Attack Max:** 3-8


### S Rank
- **Power:** 20-30
- **Health:** 35-50
- **Speed:** 6-12
- **Attack Min:** 6-12
- **Attack Max:** 6-12

### SS Rank
- **Power:** 30-50
- **Health:** 50-80
- **Speed:** 10-20
- **Attack Min:** 10-20
- **Attack Max:** 10-20

### UR Rank
- **Power:** 50+
- **Health:** 75+
- **Speed:** 18+
- **Attack Min:** 10+
- **Attack Max:** 20+

## Card Object Structure

Every card must have the following properties:

```javascript
{
  id: 'character-u1',                    // Unique ID: lowercase-u1, u2, etc.
  character: 'Character Name',           // Full character name
  alias: ['alias1', 'alias2'],          // Array of searchable aliases (lowercase)
  title: 'Card Title',                   // Title or faction name
  faculty: 'Faction Name',                // Must match exactly with crews.js
  rank: 'D',                             // D, C, B, A, S, SS, UR
  mastery: 1,                            // Current upgrade number (1, 2, 3, etc.)
  mastery_total: 3,                      // Total number of upgrades available
  pullable: true,                        // true only for u1, false for u2+
  power: 10,
  health: 20,
  speed: 3,
  attack_min: 2,
  attack_max: 5,
  type: 'Combat',                        // Combat, Tank, boost, Boost, Special
  image_url: 'https://...'              // Card image URL
}
```

## Important Notes

1. **Faculty Names:** Always match faction names exactly as they appear in `data/crews.js`:
   - Strawhat Pirates
   - Alvida Pirates
   - Buggy Pirates
   - Cross Guild
   - Marines
   - Boroque Works

2. **IDs:** Use format `character-u1`, `character-u2`, keeping character names lowercase and using dashes

3. **Pullable:** Only the first upgrade (u1) should have `pullable: true`; all higher upgrades must be `pullable: false`

4. **Multi-Upgrade Characters:** When a character has multiple upgrades:
   - They can have different faculties (e.g., Daz Bones: u1=Boroque Works, u3=Cross Guild)
   - This means the u1 becomes pullable from both faction packs
   - Set `mastery_total` to the highest mastery number for that character

5. **Aliases:** Include common names and shortened versions in lowercase for better searchability

6. **Stats Within Range:** Approximate spread values to make cards feel balanced:
   - Don't use extremes for every stat unless it's a special mechanic
   - Vary stats to give cards different feels (some high power, some high health, etc.)



## Example: Adding a Multi-Upgrade Character

If adding "Example Character" with Buggy Pirates u1 and Cross Guild u2:

```javascript
{
  id: 'example-u1',
  character: 'Example Character',
  alias: ['example', 'example char'],
  title: 'Member of Buggy Pirates',
  faculty: 'Buggy Pirates',
  rank: 'C',
  mastery: 1,
  mastery_total: 2,              // Total upgrades
  pullable: true,                 // Only u1 is pullable
  power: 7,
  health: 10,
  speed: 1,
  attack_min: 1,
  attack_max: 2,
  type: 'Combat',
  image_url: 'https://...'
},
{
  id: 'example-u2',
  character: 'Example Character',  // Same character name!
  alias: ['example', 'example char'],
  title: 'Member of Cross Guild',
  faculty: 'Cross Guild',          // Different faculty
  rank: 'C',
  mastery: 2,
  mastery_total: 2,
  pullable: false,                 // Higher upgrades not pullable
  power: 8,
  health: 12,
  speed: 2,
  attack_min: 1,
  attack_max: 3,
  type: 'Combat',
  image_url: 'https://...'
}
```

With this setup, "Example Character" will be pullable from **both** Buggy Pirates and Cross Guild packs, even though the u1 has Buggy Pirates faction. This is because the system checks if any upgrade matches the pack's faction.
