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
