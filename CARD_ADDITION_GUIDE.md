
# Card Addition Guide

This guide explains how to properly add new cards to the game. Follow these instructions for consistent card creation.

## Card ID Format

all cards should have an ID field given from the requester

## File Structure

cards are defined in two main files:
- **cards.js** - Primary cards (main story characters) Ships, and artifacts
- **morecards.js** - Secondary cards (early arc and side characters)
- **crews.js** - Faculty/crew definitions and their ranks
- **marines.js** - Marine organization characters

## Card Data Format

Example:

```javascript
{
    character: 'Monkey D. Luffy',  //can share same name with other cards
    alias: ['luffy', 'monkey d luffy', 'strawhat'], 
    id: '2', // all characters have unique id
    pullable: true,
    attribute: 'STR',  // STR, QCK, INT, DEX, or PSY
    emoji: '<:Luffygumgumpistol:1492353926257971341>', // All characters have different emoji
    title: 'Gum-Gum Pistol',
    faculty: 'Strawhat Pirates', 
    rank: 'B', // D, C, B, A, S, SS or UR
    power: 12,  // see #file:CARD_STAT_RANGES.md for stat ranges
    health: 18,
    speed: 4,
    attack_min: 3,
    attack_max: 4,
    special_attack: {  //does not need to be stated (optional)
      name: 'Gum-Gum Pistol',
      min_atk: 5,  //usually double attack -1
      max_atk: 8,  //usually double attack +1
      gif: 'https://media1.tenor.com/m/eTo-ytFNLX8AAAAC/luffy-pistol.gif' //optional
    },  
    effect: 'stun',  // See #file: STATUS_EFFECTS.md for status effects, also optional
    effectDuration: 1,
    image_url: 'https://2shankz.github.io/optc-db.github.io/api/images/full/transparent/0/000/0002.png'
  },

| Rank | Examples | Power Range | When to Use |
|------|----------|-------------|------------|
| D | Background characters, weak enemies | 5-15 power | Truly insignificant roles |
| C | Early arc characters, weak fighters | 8-20 power | Weak but notable |
| B | Solid crew members, early arcs | 12-30 power | Normal fighter level |
| A | Strong crew members, commanders | 16-35 power | Notable fighters |
| S | Very strong characters, senior leaders | 24-50 power | Powerful fighters |
| SS | Elite level, major characters | 45-60+ power | Very powerful |
| UR | Peak tier, protagonists | 50+ power | Extremely powerful |

## Special Attacks

- **Required for:** SS rank and above only
- **Damage scaling:** Usually 1.5-2x normal attack damage (special_attack.max_atk ≈ 2-3x attack_max)
- **All special attacks must include a status effect** (from the valid list above)
- **Status effect strength scales with card importance:**
  - Weaker cards: Choose gentler effects (confuse, attackdown, defensedown)
  - Stronger cards: Choose more impactful effects (stun, freeze, bleed, undead)
  - Elite/Yonko level: Use undead, stun, or bleed with high duration/amount

**Example:**
- Normal attack: attack_max = 10
- Special attack: max_atk = 18-25 (roughly 2-2.5x)

### Multi-target (`count` / `scount`) guidance

- If a card uses `count` (normal attack multi-target) or `scount` (special multi-target), the intended behavior is to split the card's attack across the chosen targets.
- IMPORTANT: Only set a `count` or `scount` property when the card input explicitly includes a leading target token before the parentheses. The canonical authoring tokens are:
  - `2`  → `count: 2`
  - `3`  → `count: 3`
  - `-2` → `scount: 2`
  - `-3` → `scount: 3`
  (Do NOT add `count`/`scount` otherwise.)
- For data authors and card-adder tools: when specifying `count: 2` the authored `attack_min`/`attack_max` represent the *total* attack pool and will be split across 2 targets at runtime (per-target = total/2). For `count: 3` per-target = total/3. The same applies to `scount` for special attacks.
- Example: a special that authors a total `max_atk = 18` with `scount: 2` will deal ~`9` to each target; with `scount: 3` it will deal ~`6` to each.
- Icon tokens: include the matching icon on consolidated cards when using target counts. Use the following tokens for quick embed display:
  - `count: 2` or `scount: 2` → `countIcon` / `scountIcon`: `<:2_:1503002986560094228>`
  - `count: 3` or `scount: 3` → `countIcon` / `scountIcon`: `<:3_:1503002985578365118>`
- Validation: card-adder tools MUST only add `count`/`scount` for cards that had the leading token; use the project's `scripts/validate-card-counts.js` to verify enforcement before committing.

## Attributes

Map character abilities to attributes based on the colored icon in the image. The letter shown is the first letter of the attribute:

| Color | Icon Letter | Attribute | Type | Examples |
|-------|-------------|-----------|------|----------|
| Red | S | STR | Strength/Power | Luffy, Zoro, Whitebeard |
| Green | D | DEX | Dexterity/Speed | Sanji, Nami, Usopp |
| Blue | Q | QCK | Quick/Speed | Luffy, Yassopp |
| Yellow | P | PSY | Wisdom/Mind | Chopper, Robin |
| Purple | I | INT | Intellect/Tactics | Nami, Robin |

## Boost Type Cards

Some characters cannot or primarily don't fight (doctors, cooks, navigators):

**Boost type cards have:**
- **NO** `special_attack`
- `boost` field: String listing which characters they boost and by percentage

**Example:**
```javascript
{
  character: 'Makino',
  title: 'Barmaid of the Partys Bar',
  boost: 'Monkey D. Luffy (5%), Figarland Shanks (5%)',
  // ... other fields
}
```

## Stat Scaling Example

**For B rank character:**
```
power: 12-15
health: 20-25
speed: 3-5
attack_min: 2-3
attack_max: 4-5
```
`

## Faculty Management

If a character belongs to a crew not in crews.js, add it following this format:

```javascript
{
  name: "Crew/Faculty Name",
  icon: '<:FacultyEmoji:1234567890>',  // Discord emoji
  rank: 'A'                             // Crew's overall rank
}
```

Crew ranks roughly correspond to:
- D: Small/minor crews
- C: Notable but small crews
- B: Mid-tier crews
- A: Major pirate crews, strong factions
- S: Yonko crews, top-tier organizations
- SS: Only for Yonko + Marines combo


## Placeholder Values

When you don't have final assets, use `null` instead of string placeholders:

- **image_url:** `null`
- **character emoji:** `null`
- **gif in special_attack:** `null`

**Important:** Do NOT use string values like `'IMAGE_PLACEHOLDER'` as placeholders, as this will cause validation errors in Discord.js. Always use `null` for missing assets.

## Valid Status Effects

These are the ONLY available status effects in the game. Use ONLY these names:

- **stun** - Prevents action for duration
- **freeze** - Prevents action, unfrozen by taking damage
- **cut** - 1 HP damage per turn 
- **bleed** - 2 HP damage per turn
- **regen** - Restores percentage of max HP per turn 
- **confusion** - Chance to miss attacks (use `effectChance` for miss %) 
- **attackup** - (NOT "Attack Up") Increases attack by percentage
- **attackdown** - (NOT "Attack Down") Decreases attack by percentage
- **defenseup** - Increases defense by percentage
- **defensedown** - Decreases defense by percentage
- **truesight** - Dodges all incoming attacks
- **undead** - Card remains alive at 0 HP
- **reflect** - Refulects opponents attack to the opponent

⚠️ **Common Mistakes:**
- `burn` and `poison` do NOT exist - use `bleed` for damage-over-time effects
- `speeddown` does NOT exist
- `paralysis` does NOT exist - use `stun` or `freeze` instead

Before submitting cards:

- [ ] All required fields are filled (except placeholders)
- [ ] Attributes match character abilities
- [ ] Ranks are appropriate for anime importance
- [ ] S+ rank cards have special attacks with status effects
- [ ] All faculties exist in crews.js
- [ ] Aliases are lowercase
- [ ] Special attack damage is approximately 2x normal attack
- [ ] Effect durations are reasonable (1-5 turns)
- [ ] **Status effects used are ONLY from the valid list** (no burn/poison/paralysis/speeddown)
- [ ] **Stronger cards have stronger/more impactful status effects**
- [ ] **Non-combat support characters use boost type** (power: 1, attack_min/max: 0, with boost field)
- [ ] **All effect names use lowercase** (attackdown, defensedown, not "Attack Down")
