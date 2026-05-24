# Drift Fun-Baseline Diagnostic

**Source report:** [sim-results/2026-05-23_19-37-25-431.md](../sim-results/2026-05-23_19-37-25-431.md)
**Generated:** 2026-05-23

This is the data-only diagnostic. It will be paired tomorrow with playtest notes from `notes/playtest-baseline.md` to inform Phase 3 topic priorities.

## Fun-signature targets

| Target | Threshold | Actual (avg across all matchups) | Hit? | Implication |
| --- | --- | --- | --- | --- |
| Player-authored cascade % | ≥ 40% | **13%** | NO | Topic B (player-driven cascades) is the clear data-side priority. |
| Big-spell casts / game | ≥ 0.5 | **7.41** | YES (massively over) | Hypothesis "3-mana abilities are dead" is wrong at the AI level. Reserve Topic A judgment until playtest. |
| Distinct strategic picks / turn | ≥ 2.0 | **3.76** | YES | Strategies disagree ~75% of the time — turns aren't on rails. |
| Cascade damage share | 20–55% | **32%** | YES | Cascades contribute meaningfully without dominating. Healthy band. |

## Per-strategy fun signature

| Strategy | Win % (avg) | Author % | Big Spells/Game | Variance | Cascade Dmg % |
| --- | --- | --- | --- | --- | --- |
| Random | 2 | 14% | 4.37 | 3.76 | 35% |
| GreedyDamage | 38 | **0%** | 1.83 | 3.73 | 45% |
| CascadeBuilder | 23 | **42%** | 14.03 | 3.92 | 39% |
| WallSpammer | 31 | **0%** | 8.91 | 3.62 | 11% |
| WindRider | 47 | 7% | 7.91 | 3.76 | 32% |

The author % is the eye-opener: GreedyDamage and WallSpammer **never** author cascades. The two strategies that win the most matchups (GreedyDamage Fire Trio 94%, WallSpammer Earth Trio 79%) are using zero of the cascade fantasy. Only CascadeBuilder genuinely plays the chain-building game, and only on Earth Trio (84% authorship there, 18–25% on the others where it loses).

## Authorship breakdown (all games)

- Player-authored cascades: 3,894
- Enemy-authored cascades: 2,999
- Mixed (or terrain decayed): 7,862

Mixed dominates — most cascades involve at least one enemy-placed tile. Player-only chains exist but are concentrated in CascadeBuilder vs Earth Trio (steam from player water + player fire).

## Cascade type distribution

- electrified: 946 (rarest — gated by 1 storm-sprite per default comp; **players never place lightning**)
- steam: 4,682
- plasma: 2,958
- shatter: 6,169 (most, but only 1 damage; scales with chain via earth)

**Steam is 32% of all cascades and does no damage.** Lots of "cascade fired" visual events that are functionally empty.

## Player terrain placement distribution

- water: 20,765
- fire: 37,729
- lightning: **0** (no player has a lightning ability)
- earth: 25,765

## Dead abilities

No ability is fully dead — Random (control) casts every ability at least 0.22/game. But every "smart" strategy ignores 2–5 abilities entirely:

| Strategy | Abilities never cast |
| --- | --- |
| GreedyDamage | boulder, splash, torrent, tremor, wall (5/7 — only ember + inferno) |
| WindRider | torrent, tremor, wall (3/7) |
| WallSpammer | boulder, splash, torrent (3/7) |
| CascadeBuilder | (uses all 7) |

This is a *strategic* dead-zone, not a *mechanical* one. Different strategies pick different tools, which is fine — but the matrix shows winning strategies use a small toolkit.

## Topic priorities (data-only ranking)

1. **Topic B — Player-driven cascades.** This is the only fun-signature miss, and it's a big one (13% vs 40% target). The cascade authorship by strategy data is even more damning: only one of five strategies actually authors cascades, and 32% of all cascades are zero-damage steam. The Drift fantasy ("I built that chain") is mostly inaccessible at the data level.
2. **Topic A — Big spells land.** Lower data-priority than expected — strategies cast 3-mana abilities frequently. **But** sim AI is not playtest signal; humans may avoid expensive plays the AI happily makes. Confirm or reject after Phase 0 playtest.
3. **Topic C — Wind matters.** Cannot evaluate from this data alone. WindRider's 47% avg (highest of any strategy) and 97% vs Storm Trio suggest wind has meaningful impact, but without a "did the wind change a decision" metric this is mostly inferred. Only run Topic C if your playtest notes say "I never thought about wind."

## Notable design observations beyond fun targets

- **Steam glut.** 4,682 steam cascades fire across 3,000 games but do nothing. Visually they dominate the cascade experience while being mechanically empty. Worth flagging as a fun risk: if half your cascade triggers feel like fizzles, the cascade system feels weaker than it is. Possible future variant: give steam a small effect (movement cost, vision block, or 1 damage on adjacent characters).
- **Storm Trio's 97% WindRider win rate.** Already noted in the prior baseline; the new data adds context — WindRider has only 12% authorship vs Storm Trio. It wins by riding wind-driven fire spread onto enemies, not by chaining cascades. Consistent with the strategy's design.
- **Earth Trio is a CascadeBuilder/WallSpammer playground** because moss-golems (12 HP, 1 movement) give strategies time to set up. CascadeBuilder achieves 84% authorship there — proof the cascade fantasy *can* be reachable when the matchup allows it.
- **GreedyDamage's 94% on Fire Trio with 0% authorship and 1.83 big spells/game** is the cleanest win in the matrix — and uses none of Drift's signature systems. If the prototype's identity is "tactical cascade chains," GreedyDamage's success is a counterargument. Worth reflecting on whether the design is what it claims to be.

## Caveats / things only playtest can confirm

- **Wind relevance from the player's POV.** Sim infers wind matters via WindRider's lead, but cannot tell whether a human notices wind on any given turn.
- **Big-spell felt-fun.** AI casts 7.41 big spells/game; a human player on cards 1–5 might still feel "I have to spam ember because torrent is too expensive to think about." Reserve Topic A judgment.
- **Decision interestingness.** Action variance 3.76/5 is high, but variance counts disagreement across *strategies*. A turn where 5 strategies disagree might still feel obvious to a human if all 5 are dumb in different ways. Playtest is the truth on this.
- **Cascade fantasy felt-fun.** Even 13% authored cascades, *if they're memorable*, might be enough. Playtest "did I set that up?" answers this.

## Recommended Phase 3 plan after playtest

Pending tomorrow's playtest notes, the most likely shape:

- **Definitely run Topic B** (player-driven cascades, 3 variants — splash sparks / electrified buff / spark on Pyromancer). The data is unambiguous.
- **Run Topic A only if** playtest notes say you avoided 3-mana abilities. The AI says they're fine; you may disagree.
- **Run Topic C only if** playtest notes say wind didn't influence a decision.
- **Consider a bonus topic D — "Steam earns its slot"** — give steam a small functional effect. Not in the original plan but a clean target the data surfaced. Could fold into Topic B's variant set.

---

## 2026-05-24 update: cascade splash + asymmetric friendly fire

**Trigger:** Playtest signal — "I just want to keep my team in a diagonal line and build the biggest possible chains, enemies always walk into them." Dominant strategy was clear from one playthrough.

**Diagnosis re-frame:** The original plan's Topic B (more cascades) was wrong. The user already cascades enough; the issue was that cascades had *no risk* to them, only upside. Build kill zone at range 3, sit at range 4+, cascades hit only enemies.

**Change shipped (`src/grid/cascade.ts`):**

1. **Cascade reactions now have a `splashTiles` field** = tiles 1 step orthogonally from any primary tile.
2. **Friendly-fire rule on primary tiles:** enemies take full damage, players take half (rounded down, min 1).
3. **Splash damage is asymmetric — players only.** Allies in the splash radius take ¼ base damage (min 1). Enemies in the splash radius take 0. Fictional framing: "your own chain reactions echo back toward your team."
4. **Cascade hover replay** (built earlier today) now shows splash tiles in soft orange so the player can see the echo zone.

**Why asymmetric.** The first attempt was symmetric splash (enemies took half splash too). Variance went from "GreedyDamage dominant ~50%" to "GreedyDamage dominant 98%" — chain spam got *stronger* because cascades became AOE bombs. Asymmetric splash directly attacks the user's complaint without buffing the chain strategy on the enemy side.

**Variance shift after change:**

| Strategy | Pre-change avg | Post-change avg | Δ |
| --- | --- | --- | --- |
| Random | 2% | 1% | flat |
| GreedyDamage | 38% | **9%** | -29 (chain spam now self-damaging) |
| CascadeBuilder | 23% | 21% | flat |
| WallSpammer | 31% | 32% | flat |
| WindRider | 47% | 45% | flat |

GreedyDamage dropped from dominant to weak. The other strategies barely moved — they don't over-cluster around terrain so they don't eat much splash. Verdict went from `DOMINANT (GreedyDamage)` to `LOPSIDED (GreedyDamage weak)`.

**This is a feature, not a bug for this iteration.** The user's symptom was "chain spam is the only play." A weak GreedyDamage means chain spam is no longer the only play — three strategies (WindRider 45%, WallSpammer 32%, CascadeBuilder 21%) are now in a viable band. Variance verdict needs a more sophisticated rule that distinguishes "balance is healthy and the old optimum is gone" from "design is broken."

**Fun signals largely preserved:**

| Signal | Before | After | Note |
| --- | --- | --- | --- |
| Player-authored cascade % | 13% | 12% | flat |
| Big spells/game | 7.41 | 7.25 | flat |
| Distinct picks/turn | 3.76 | 3.76 | flat |
| Cascade dmg % | 32% | 33% | flat |

No collateral damage to the rest of the design.

**Open questions for playtest:**

- Does the splash hover replay actually communicate "this is why I took damage"? If players still feel "what happened?", we need a damage-source highlight on the character itself.
- Is ¼ base splash damage (min 1) the right severity? Could be 1 flat instead of scaling — would feel less punishing on big chains.
- Does the asymmetry feel weird in the fiction? Players might notice "enemies don't take splash but I do." If so, give enemies token splash damage (1 flat, min) just for consistency.
- Does the dominant-strategy shift hold up at the human level? Sim AI doesn't avoid splash zones; humans will. Variance might over-state the nerf if humans easily route their characters out of the echo zone.

---

## 2026-05-24 update #2: card element ±2 spread

**Trigger:** Playtest signal — "I don't get what assigning a card to a character does, the water guy still casts water tiles." Correct read: card element only granted +1 mana on match, otherwise pure decoration. Assignment phase was a sorting exercise.

**Change shipped (`src/grid/engine.ts`):**

```typescript
let mana = card.value
if (card.element === character.element) mana += 2
else mana = Math.max(1, mana - 1)
```

Element match now adds +2 (was +1). Mismatch costs −1 (was 0). Min mana 1.

**Effect on the assignment puzzle:**

- **Matched:** 1→3, 2→4, 3→5, 4→6, 5→7. A 3-card on the matching element opens 3-mana abilities cleanly.
- **Mismatched:** 1→1, 2→1, 3→2, 4→3, 5→4. Hard cap below 3-mana abilities for low cards.

So the assignment phase becomes: "Each char wants its highest-value matching card, but you only draw 3 cards across 3 chars, so you'll always face at least one mismatch — *which* character you sacrifice now matters."

**Variance shift after change (post-splash baseline):**

| Strategy | Pre-card | Post-card | Δ |
| --- | --- | --- | --- |
| Random | 1% | 1% | flat |
| GreedyDamage | 9% | 10% | flat |
| CascadeBuilder | 21% | 15% | -6 |
| WallSpammer | 32% | 25% | -7 |
| WindRider | 45% | 35% | -10 |
| Big spells/game | 7.25 | **6.35** | -0.9 |
| Player-authored cascade % | 12% | 11% | flat |

**Why all strategies got slightly weaker:** sim AI doesn't deliberately match — it greedily picks high cards regardless of element. So in sim the change reads as a pure mana nerf (mismatches cost mana). For humans who consciously match, the change is a *buff* to deliberate plays and a *nerf* to careless ones. Big-spell rate should swing the opposite way for human play.

**Asymmetry vs sim AI is acceptable here.** The change is testing a human-decision design — sim AI lacking the matching heuristic just means we can't lean on the variance number for this one. Playtest signal is the truth.

**TODO if this matters in 2-3 games:** add an element-aware assignment heuristic to a new strategy (`MatchAware`) so future variance runs reflect the puzzle correctly. Don't bother yet — first see if the human-level change makes the assignment phase feel like a real decision.

---

## 2026-05-24 update #3: drop earth, add Stormcaller + Tide Spirit (symmetric water/fire/lightning)

**Trigger:** Playtest signal — "I don't have lightning on my team and lightning is required for every damaging cascade. Let's fix this. Same 3 elements both sides, simpler."

Diagnostic: All damaging cascades pair with lightning (electrified, plasma, shatter). Player team had no lightning placer. So damaging cascades only ever happened when an enemy Storm Sprite placed lightning adjacent to player terrain. Players had no agency over plasma — they were routing damage through enemy AI behavior.

**Changes shipped (`src/grid/constants.ts`, `src/sim/tournament.ts`):**

- **Removed Geomancer** (player) and **Moss Golem** (enemy). Earth element is still defined (type, colors, flow rules) but no character uses it. Earth abilities (boulder, wall, tremor) remain in the registry but are unreachable.
- **Added Stormcaller** (player, lightning, HP 7, mvmt 3, abilities sparkbolt + thundercrack). Mirror of Storm Sprite enemy.
- **Added Tide Spirit** (enemy, water, HP 8, mvmt 1, abilities splash + torrent). Mirror of Tidecaller player.
- **Deck:** dropped earth cards. Deck is now 15 cards (water/fire/lightning × values 1–5).
- **Tournament:** replaced "Earth Trio" with "Water Trio" (2× tide-spirit + 1× storm-sprite). Renamed old "Storm Trio" (which was actually mixed) → "Mixed". Added a real "Storm Trio" (2× storm-sprite + 1× ember-wisp). Comp count 3 → 4.

**Variance shift:**

| Strategy | Pre-swap | Post-swap | Δ |
| --- | --- | --- | --- |
| Random | 1% | 3% | flat |
| GreedyDamage | 10% | **88%** | +78 |
| CascadeBuilder | 15% | 14% | flat |
| WallSpammer | 25% | 11% | -14 (no earth abilities → broken) |
| WindRider | 35% | 59% | +24 |

| Signal | Pre | Post | Note |
| --- | --- | --- | --- |
| Avg game length | 12.34 turns | **6.26** | Games end fast — Stormcaller's 2-dmg AOE Thundercrack + 8-HP Tide Spirit |
| Player-authored cascade % | 11% | **18%** | Lightning on player → plasma directly setup-able |
| Big spells/game | 6.35 | 5.79 | Games end before chars cast 3-mana spells often |
| Plasma cascade count | 2966 | **7610** | Player-team lightning is the lever |

**Why GreedyDamage flipped from weak to dominant:**

- Stormcaller's Thundercrack: 2-dmg AOE in a 2x2 = up to 8 damage per cast. Storm Sprite (6 HP) and Tide Spirit (8 HP) die in 1–2 casts.
- Lost the 12-HP Moss Golem tank that previously stretched games.
- No earth → enemies can't be walled off, players can't deny terrain placement.

**Almost certainly imbalanced now:**

- **Stormcaller > Pyromancer.** Inferno (3 mana, 2x2, 1 dmg) does max 4. Thundercrack (3 mana, 2x2, 2 dmg) does max 8. Same mana cost, double damage. Pyromancer is now the worse damage dealer.
- **Tide Spirit is weaker than Moss Golem was.** 8 HP vs 12 HP, no damage abilities. Enemy team feels less threatening.

These are next-pass tuning targets:

1. Either nerf Thundercrack to 1 dmg (matching Inferno) or buff Inferno to 2 dmg.
2. Give Tide Spirit a damage ability — e.g., a 2-mana "Drown" (water + 1 dmg, single tile) — so the water enemy isn't pure utility.
3. Consider giving enemies a 12-HP option back (Tide Whale? Mistwarden? Same role as old Moss Golem but watery).

Don't tune yet — let the user playtest the symmetric MVP first. Asymmetry between Pyromancer and Stormcaller is fine if the user's experience is "Stormcaller is the damage dealer, Pyromancer is the cascade enabler" (Pyromancer's fire next to Stormcaller's lightning = plasma).

**WallSpammer's drop is expected and fine** — the strategy specifically targets earth abilities that no longer exist. Could prune the strategy, or leave it as a "dead control" until earth comes back.

**Open playtest questions:**

- Does Stormcaller obsolete Pyromancer in your hands, or do they feel like complementary roles (damage dealer + cascade primer)?
- Do 6-turn games feel rushed or punchy?
- Is the assignment puzzle still meaningful with only 3 elements / 5 values per (15-card deck)?
- Does the cascade fantasy land now that you can directly set up plasma?

---

## 2026-05-24 update #4: rename mana → Power (UX-only)

**Trigger:** Design audit. The "mana" framing borrows baggage from card games where mana carries across turns and characters cast multiple spells per turn. Drift does neither — the number is really "this turn's power level," set by your card and consumed by one cast. Players can't act on mana the way `mana` implies.

**Change shipped (UI strings + 1 CSS class only, engine field stays `mana`):**

- AbilityPanel: "Mana: 5" → "Power: 5"; "3 mana" → "3 power" on ability cost labels.
- CharacterRoster: "Mana 5" → "Power 5".
- GridBattle assign-phase help: rewritten to "Card value = Power for the turn. Power gates abilities — cast any ability with cost ≤ Power. Highest Power acts first. Element match: +2 Power. Mismatch: −1 (min 1)."
- CSS: `.ability-panel__mana` → `.ability-panel__power`.
- `docs/gameplay.md` (new) uses "Power" throughout.

**Why UX-only.** Renaming the engine field would touch ~30 sites across types/engine/strategies/runner/metrics for zero gameplay benefit. The user-facing label is the only thing that matters; internal field name is invisible.

**Other paths considered but deferred:**

- Path B — replace cost-spending with tier-gating ("ability tier 1/2/3, card value = your tier this turn"). Mathematically identical; cleaner mental model. ~30 min, not done because Path A solves the felt-confusion at lower cost.
- Path C — remove the resource entirely, card → turn order only. Would dismantle the assignment puzzle (no +2/−1 spread to apply) and the small/big turn pacing. Rejected.

**No sim impact** — pure UI change.

---

## 2026-05-24 update #5: Mend bonus tiles

**Trigger:** Symmetric build added cascade access for the player team but made games shorter and more lopsided (GreedyDamage 88% wins, avg 6.26 turns). Need a mid-board reason to deviate from "stack damage, click enemy" — a small risk/reward decision that isn't just another spell.

**Change shipped:**

- 3 Mend tiles spawn at game start in the middle 3x3 of the grid. Random positions, RNG-seeded, exclude character starting tiles. Same RNG that controls terrain/wind so seed `42` always spawns the same layout.
- Step-on activation: when any character (player or enemy) ends a movement step on a Mend tile, the tile heals them +3 HP (capped at maxHp) and is consumed. Pulsing red `+` icon.
- Bonuses persist under terrain — stepping on a tile that's both Mend and a future cascade primary takes the heal but eats cascade damage on the next cascade phase. Actual risk/reward.
- Sim instrumentation: `bonusClaimed` events emitted in runner; `bonusClaimsByPlayer` / `bonusClaimsByEnemy` tallied in metrics; "Bonus pickup rate" line in console + markdown reports.

**Code surface:**

- `src/grid/types.ts` — `BonusKind = 'mend'`, `BonusTile { kind; position }`, `BattleState.bonusTiles`.
- `src/grid/constants.ts` — `MEND_AMOUNT = 3`, `BONUS_TILES_PER_GAME = 3`.
- `src/grid/engine.ts` — `spawnBonusTiles` helper, `tryClaimBonus` helper called at end of `moveCharacter` and after each enemy step in `simulateEnemyAction`.
- `src/components/grid/GridTile.tsx`, `BattleGrid.tsx`, `drift.css` — render + pulse animation.
- `src/sim/runner.ts`, `metrics.ts`, `report.ts` — events, tallies, console line.

**Sim shift (variance run, 4000 games, post-bonus):**

| Strategy | Pre-bonus | Post-bonus | Δ |
| --- | --- | --- | --- |
| Random | 3% | 3% | flat |
| GreedyDamage | 88% | **80%** | -8 |
| CascadeBuilder | 14% | 20% | +6 |
| WallSpammer | 11% | 6% | -5 |
| WindRider | 59% | 59% | flat |

| Signal | Pre-bonus | Post-bonus | Note |
| --- | --- | --- | --- |
| Avg game length | 6.26 turns | 6.51 | +0.25 — heals stretching games |
| Player-authored cascade % | 18% | 17% | flat |
| Big spells/game | 5.79 | 6.07 | flat |
| Bonus pickup rate | — | **70%** | passive AI claims ~2.1 of 3 bonuses/game |

**Pickup breakdown (per game avg):** player AI claims 1.00, enemy AI claims 1.11. Roughly even — the spawn positions in the middle 3x3 are about equidistant from both starting lines.

**Verdict moved from `LOPSIDED (GreedyDamage dominant)` to `LOPSIDED (WallSpammer weak)`.** GreedyDamage is no longer 90%+ across all comps — Storm Trio specifically drops it to 45%, because lightning enemies route to bonuses on the way in and arrive with healed HP, surviving the first Thundercrack.

**Why CascadeBuilder gained.** It's the only strategy that walks slowly and deliberately, so its characters end up on bonus tiles by accident. WindRider doesn't gain because it's already moving heavily and was already at 59% — heals from passive pickup are cancelled out by extra exposure to enemy fire.

**Why this is a buff to humans more than the sim shows.** The AI pickup rate is 70% by accident — sim characters route toward enemies, and bonuses happen to be on the way. A human player will deliberately route a damaged character to a bonus when the route doesn't compromise positioning, so human pickup should be higher and more strategic. The 8-point GreedyDamage drop in sim probably understates the change for human play.

**Open playtest questions:**

- Does the +3 heal feel meaningful or trivial when characters have 7-8 HP? Could be 2 (less swingy) or 4 (bigger pull).
- Are the spawn positions visible enough? Hearts should pulse; if missed visually, players won't seek them.
- Is the "step on means consumed" rule clear, or do players walk over them by accident?
- Does the asymmetric splash damage rule + Mend create the intended decision? ("Heal here means I'm in the splash zone of my own setup next turn.")
- Should enemy pickup be removed for v2? Currently 50/50 player/enemy claim split — feels fair but might frustrate players who clearly "set up" a bonus and watch an enemy take it.

---

## 2026-05-24 update #6: water gets damage (Splash 1 / Torrent 1-per-tile)

**Trigger:** Playtest reached a Tidecaller-as-last-survivor vs Tide Spirit endgame. Both have 0-damage abilities. No fire/lightning on the board → no damaging cascade possible. Game was a literal soft-lock — no turn cap in the browser build, infinite stalemate. The user asked "shouldn't all classes be able to deal some damage?"

**Diagnosis:** Yes. Water was the only element with 0 damage on both abilities. Original design intent was "water = pure cascade primer," which is defensible when she has fire/lightning teammates but breaks the moment she's alone. Tidecaller-mirror was the only matchup that was mathematically unwinnable.

**Change shipped (`src/grid/constants.ts`):**

- `splash`: damage 0 → **1** (single tile, range 3, water)
- `torrent`: damage 0 → **1** (3-tile line, range 3, water — up to 3 total damage)
- Descriptions updated to "Place water on a tile, deal 1 damage." / "Place water in a 3-tile line, deal 1 damage."

Pattern matches fire (Ember 1 / Inferno 1-per-tile in 2x2). Water remains the lowest-damage element by max ceiling (Torrent 3 < Inferno 4 < Thundercrack 8) but no longer toothless.

**Variance shift (post-water-buff vs post-bonus baseline):**

| Strategy | Pre | Post | Δ |
| --- | --- | --- | --- |
| Random | 3% | 1% | flat |
| GreedyDamage | 80% | **98%** | +18 |
| CascadeBuilder | 20% | 33% | +13 |
| WallSpammer | 6% | 4% | flat |
| WindRider | 59% | 74% | +15 |

| Signal | Pre | Post | Note |
| --- | --- | --- | --- |
| Avg game length | 6.51 turns | **5.00** | -1.5 — third damage dealer ends games faster |
| Player-authored cascade % | 17% | 22% | up — water tiles placed more often |
| Big spells/game | 6.07 | 5.02 | down — games end before late-game |
| Cascade dmg % | 27% | 22% | down — direct damage takes more share |

**Verdict moved from `LOPSIDED (WallSpammer weak)` back to `DOMINANT (GreedyDamage)`** — GreedyDamage now wins ≥94% across all 4 comps including Storm Trio (was 45%, now 99%). The previous saving-grace matchup — Storm Trio resists chain-spam because lightning enemies are fast — got nuked because Tidecaller now chips Storm Sprites every turn for 1, denying their out-trade.

**Why this overshoots.** Adding any damage to water turns Tidecaller from utility into a third chipper. The player team goes from 2 damage dealers + 1 setup to 3 damage dealers. GreedyDamage benefits the most because it's already the "stack hits, win fast" strategy — more chippers = strictly faster wins.

The change *fixes the intended hole* (Tidecaller mirror is now winnable, ~8 turns of grinding), but it *also* tipped the strategy balance.

**Tuning options if we want to walk it back:**

1. **Drop Torrent to 0 dmg, keep Splash at 1.** Mirror-endgame still resolves (8-turn grind). Tidecaller's big spell stays utility. Less player-team buff overall. Probably brings GreedyDamage back to ~85-88%.
2. **Cap Torrent at 1 total damage (single hit on first enemy in line).** Torrent feels like a damage spell but doesn't AOE-chip clumps.
3. **Reduce Tidecaller's HP from 8 → 6.** Compensate her damage upgrade with frailty. Easier to kill = team's most-resilient chipper becomes vulnerable.
4. **Buff Tide Spirit's movement from 1 → 2.** Currently Tide Spirit is too slow to actually threaten with new chip damage. Bumping her speed restores enemy threat parity.

**Recommendation if dominance bothers us in playtest:** Option 1 (Torrent → 0 dmg). Smallest change, most surgical, keeps Splash chip + cascade-utility role for Torrent. Don't ship yet — let the user feel the change first.

**Open playtest questions:**

- Does the Tidecaller mirror actually resolve cleanly now, or does it drag for 10+ turns and feel boring?
- Is "Splash chips for 1" a meaningful new lever, or does it just mean "spam Splash every turn"?
- Does Torrent's 3-tile line damage feel impactful or noise (1 per tile is the smallest AOE hit in the game)?
- Is GreedyDamage's 98% dominance sim-only, or does it match what humans feel? AI doesn't dodge splash; humans should be punished less for sloppy positioning when they don't dodge, which would moderate the dominance.

---

## Telegraphs (Into-the-Breach style enemy intent preview)

**Date:** 2026-05-24

**Why this exists.** User raised two design concerns at once: (1) "shouldn't both players move at the same time so the game is more fair, you have to anticipate where your opp might move and play their spells", and (2) "I generally feel like we are going into a direction where we could have a simple fun game to build on but I feel like a few pieces are missing". The first is a real complaint about first-mover advantage and the static-feeling reactive AI; the second is a zoom-out about whether the design has real strategic depth.

We chose telegraphs (visible enemy intent commitment) over true simultaneous resolution because:

- **Blind-commit feels random.** Frozen-Synapse-style "guess what they'll do" is high-skill PvP-meta but feel-bad in single-player roguelike when you guess wrong.
- **Telegraphs convert the game into a puzzle.** You see what's coming, you decide how to dodge or pre-empt. That's the Into the Breach pattern, and it's the right shape for this game.
- **Implementation is bounded.** No new mechanics like push/displace; cancellation is "kill them or step off the tile."

### Mechanics

- Each enemy commits an `EnemyIntent` (planned move + planned ability target tile) at the end of every turn.
- Intent is rendered on the grid at the start of the next turn: ghost emoji on planned-move tile, pulsing orange highlight + element glyph on AOE tiles, element badge on the enemy sprite.
- Targets are **tiles, not units**. Once committed, an enemy's ability fires at the committed tile regardless of who's standing there. Dodge by moving off; cancel by killing the enemy.
- Bootstrap: intents are also planned during `createInitialState` so turn 1 already has telegraphs.
- A "X's Y hits empty ground — dodged" log entry fires whenever a damaging ability AOE catches no players at resolution time.

### Code surface

- `src/grid/types.ts`: added `EnemyIntent` type and `BattleState.enemyIntents`.
- `src/grid/engine.ts`: split the old `simulateEnemyAction` into `planEnemyIntent` (returns intent without mutating state) and `executeEnemyIntent` (applies committed intent to state). New helpers: `planAllEnemyIntents`, `dropDeadIntents`. Wired into `createInitialState`, `applyCleanupPhase`, `resolveAbilityOnGrid`, and `applyCascadePhase` (the last two drop dead enemies' intents so killed telegraphs vanish from the board immediately).
- `src/components/grid/BattleGrid.tsx` + `GridTile.tsx` + `drift.css`: rendering of intent overlays. Three layers: ghost emoji on planned-move, pulsing orange AOE shape, element badge on enemy.
- `src/sim/strategies.ts`: added `buildTelegraphedTiles` + `isTileTelegraphed`, replaced `chooseMoveToward` with `chooseMoveTowardSafe` for `GreedyDamage` and `CascadeBuilder` (penalize stepping into telegraphed tiles, reward stepping out of them). New `Dodger` strategy that explicitly prioritizes safety over aggression.

### Sim shift (200 games × 4 comps × 6 strategies = 4800 games)

| Strategy | Pre-telegraphs | Post-telegraphs | Δ |
| --- | --- | --- | --- |
| GreedyDamage | 98% | 100% | +2 |
| CascadeBuilder | 33% | 99% | **+66** |
| WallSpammer | 11% | 11% | 0 |
| WindRider | 74% | 99% | +25 |
| Dodger (new) | — | 100% | new |

| Signal | Pre | Post | Note |
| --- | --- | --- | --- |
| Avg game length | 5.00 turns | **7.08** | +2 — more decisions, deeper games |
| Player-authored cascade % | 22% | 37% | up — players have more time to set up |
| Big spells/game | 5.02 | 6.40 | up — more turns means more big spells |
| Cascade dmg % | 22% | 33% | up — cascades are more effective when player can spread to avoid backsplash |

**Verdict still `DOMINANT (GreedyDamage)`** but the underlying picture is much healthier: three strategies now hit 99-100% (GreedyDamage, CascadeBuilder, WindRider, Dodger). The dominance flag fires because GreedyDamage hits ≥70%, but in practice the top strategies are tied. Pairwise spread is 0.353 (within-condition std dev), condition diversity 0.022 — meaning the matchups don't differentiate strategies much. With four strategies clustered at the top, the bottleneck isn't strategy choice — it's enemy threat.

### Why telegraphs help the player so much in sim

The AI player can now route around damage that previously was unavoidable. Cascades are more effective because the player can spread without losing tempo (no need to clump for cascade-builder positioning when you can predict and counter the AOE). The enemy AI is still using its old greedy heuristic but now it commits a turn ahead, giving the player a free read on every threat.

### Tuning options if dominance bothers playtest

The expected outcome was "telegraphs help the player more than they help the enemy because the enemy AI is reactive." That's exactly what happened. To re-tighten:

1. **Buff enemy abilities.** Storm Sprite's Sparkbolt/Thundercrack damage could go up by 1 to make missed dodges hurt more. Currently a missed dodge costs ~2 HP; bumping that to 3-4 makes telegraphs an actual life-or-death decision.
2. **Multi-threat telegraphs.** Have enemies sometimes commit to AOE-around-self instead of single-target lines, making spread-positioning less universally optimal.
3. **Smarter enemy intent.** The enemy AI currently picks "highest damage ability that's in range." Smarter: anticipate where the player WILL be (closest player + their next likely move), commit AOE to that predicted spot. Makes telegraphs less trivially dodge-able.
4. **Faster-rotating wind.** Wind already rotates every turn but enemy intent is committed *before* wind rotates — fire-spread telegraphs assume current wind, can be made to factor in rotation.

**Recommendation:** Option 1 (enemy damage +1 across the board) is the cleanest first tuning lever. It doesn't change the dodge mechanic; it just makes failed dodges hurt more, which should pull GreedyDamage win-rate back down by raising the cost of clumping and aggressive positioning. Don't ship yet — let the user feel the playtest first; the qualitative win (anticipation gameplay) might already be the real point.

### Open playtest questions

- Does the telegraph UI clarity match the spec? (Three layers — ghost, AOE highlight, badge — might be too noisy on a 5×5 grid.)
- Does the dodge mechanic feel rewarding, or do enemies just always reposition next turn to retarget the moved character?
- Are turn 1 telegraphs surprising? Players see threats before they've even drawn cards on the very first decision — does that feel cool or jarring?
- Is the "kill cancels intent" mechanic visible enough? When a player kills a telegraphed enemy, does the player notice that the orange tiles vanished, or does it happen too quietly?
- Are 7-turn games more fun than 5-turn games, or do they drag?

