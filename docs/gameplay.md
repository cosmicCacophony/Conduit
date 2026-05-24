# Drift — gameplay primer

A short reference for how Drift actually plays today. Read once, glance at later. If anything here disagrees with the running build, the build wins — open an issue and we'll update this doc.

## Win condition

Kill every enemy character. Lose if every player character is reduced to 0 HP. Games are short — the current build averages ~6 turns end-to-end.

## Turn structure

Every turn runs in this order:

1. **Assign.** You draw 3 cards (1 per character). Click a card, then click a character to assign. Card value (1–5) becomes that character's **Power** for the turn.
2. **Player actions.** Your characters act in order from highest Power to lowest. Each character can move (free, up to their movement budget) and cast one ability whose cost ≤ Power. Ending turn early is allowed.
3. **Enemy actions.** Same pattern, ordered by their Power.
4. **Terrain flow.** Water flows downhill, fire spreads with the wind, lightning sits put.
5. **Cascade resolution.** Adjacent reactive elements detonate (see below).
6. **Cleanup.** Old terrain decays, wind rotates one step clockwise.

The key thing this order does: **cascades fire after everyone has moved**, so you and your opponent can both watch your setups land or get evaded.

## Power, not mana

- **Card value = Power** for the turn. Highest Power acts first.
- **Element match: +2 Power.** Mismatch: −1 (min 1).
- **Power gates abilities.** You can cast any ability with cost ≤ your Power. Excess Power isn't saved — turns are independent.

So a Lightning 1 card on Stormcaller becomes Power 3 — enough for Thundercrack. A Water 1 card on Stormcaller becomes Power 1 — only Sparkbolt is reachable that turn.

## Characters

### Player team

| Char | Element | HP | Move | Power 1 ability | Power 3 ability |
| --- | --- | --- | --- | --- | --- |
| Tidecaller 🌊 | water | 8 | 2 | **Splash** — water tile (range 3) | **Torrent** — 3-tile water line |
| Pyromancer 🔥 | fire | 7 | 2 | **Ember** — fire tile + 1 dmg | **Inferno** — 2x2 fire + 1 dmg |
| Stormcaller ⚡ | lightning | 7 | 3 | **Sparkbolt** — lightning tile + 1 dmg | **Thundercrack** — 2x2 lightning + 2 dmg |

### Enemy team (mirror)

| Char | Element | HP | Move | Notes |
| --- | --- | --- | --- | --- |
| Storm Sprite ⚡ | lightning | 6 | 3 | Mirrors Stormcaller. The threat. |
| Ember Wisp 👻 | fire | 6 | 2 | Mirrors Pyromancer. Chip + cascade primer. |
| Tide Spirit 🐚 | water | 8 | 1 | Mirrors Tidecaller. No direct damage, slow. |

## Card assignment heuristic

You only draw 3 cards across 3 characters, so you'll always face at least one element mismatch. Priority:

1. **Match Stormcaller first.** A 3+ lightning card on Stormcaller = Power 5+, big margin for Thundercrack and turn-order priority. Stormcaller is your damage engine; he's the highest-leverage match every turn.
2. **Match Pyromancer second** if you have a fire card. Inferno chip damage is fine but not critical — you mostly want it for cascade primer.
3. **Sacrifice Tidecaller to mismatch** most turns. She caps at Power 1–2 on a mismatch but Splash still works. She's the lowest-cost mismatch in your roster.

If you draw two cards of one element: pick which character gets matched and which gets ramped to high Power despite mismatch (e.g., Lightning 5 on Pyromancer = Power 4, still affords Inferno).

The character with the highest Power acts first. Use this to land setups before enemies move, or to fire a finishing Thundercrack before an injured enemy can dodge.

## Two damage paths

**Path 1: Direct damage.** Stormcaller's Thundercrack at 2 dmg × up to 4 tiles = up to 8 damage if you catch a clump. Even on a single enemy it's 2 dmg, which equals one-third of a Storm Sprite's HP. Sparkbolt is your 1-Power filler when you can't afford Thundercrack. Pyromancer's Inferno is 1 AOE chip; Ember is single-target chip. This is the "stack hits, win fast" path.

**Path 2: Cascades.** Place two reactive elements adjacent and they detonate during the cascade phase:

- **Plasma** (fire + lightning): 3 dmg, scales with chain. Your most reachable big play.
- **Electrified** (water + lightning): 2 dmg, scales with chain.
- **Steam** (water + fire): no damage, just visual.
- **Shatter** (earth + lightning): not reachable in current build (no earth on either team).

Cascades scale: a 4-tile plasma chain is ~6–9 damage. The setup is usually two turns — Stormcaller drops Sparkbolt, Pyromancer drops Ember adjacent, cascade detonates at end of turn.

## Defensive priorities

Cascades hit everyone on them, but the damage is asymmetric:

- **Primary tiles** (where the reactive elements landed): enemies take full damage, players take **half** (rounded down, min 1).
- **Splash tiles** (orthogonally adjacent to primary): only players take damage — **¼ base** (min 1). Enemies take zero.

So your own chain reactions echo back toward your team. The bigger the chain you build, the wider the splash zone you must dodge. Two practical rules:

1. **Don't stand adjacent to your own cascade tiles.** Move out of the splash zone before end of turn.
2. **Spread your characters.** A clump means one cascade hits all three.

Hover any cascade entry in the turn log to see exactly which tiles fired and which were splash — primary glows bright, splash glows orange.

## Turn 1 playbook

A reliable opener:

1. Look at the draw. If you have a Lightning 3+ card, give it to Stormcaller. He moves first and either drops Thundercrack on a clumped enemy pair (immediate damage) or drops Sparkbolt at row 2 col 2 to seed a future plasma.
2. Give Pyromancer a fire card if you have one. He moves to drop Ember adjacent to Stormcaller's lightning tile — plasma fires in the cascade phase.
3. Tidecaller takes whatever's left. Splash to deny enemy fire tiles, or to set up a future electrified.

Even without a big lightning card, you can set up plasma round 1 with Sparkbolt + Ember (1 + 1 Power, easy assignments) and detonate it at end of turn.

## Why games end fast (~6 turns)

- Stormcaller's 8-max-damage Thundercrack one-shots Storm Sprites (6 HP) and seriously dents Tide Spirits (8 HP).
- Plasma cascades land 3+ damage with minimal setup.
- Both sides have lightning, so the cascade race is symmetric and aggressive.

The current dominant sim strategy is **GreedyDamage** (88% of wins) — relentless Thundercrack/Inferno every turn, ignore terrain. Cascades are 18% player-authored at the AI level — humans can do much better deliberately.

## What sim AI does badly that you can exploit

- **AI doesn't dodge splash.** It greedily casts and eats its own cascade backsplash. You can route out of splash zones every turn for free.
- **AI doesn't match elements deliberately** during assignment. It picks the highest card regardless. You consciously matching = more big-Power turns than the sim shows.
- **AI doesn't herd enemies into kill zones.** A 2x2 plasma in a corner with both Storm Sprites adjacent is humans-only level of play.
