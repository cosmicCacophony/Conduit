import { useMemo } from 'react'

import { findSpell, getAllSpells } from '../data/spells'
import type { CombatEffect, Element, EnemyState, GameState, Spell } from '../types'

type CombatScreenProps = {
  state: GameState
  onToggleCard: (index: number) => void
  onCast: () => void
  onEndTurn: () => void
}

const ELEMENT_SYMBOL: Record<Element, string> = {
  fire: '🔥',
  nature: '🌿',
  water: '💧',
}

const ELEMENT_LABEL: Record<Element, string> = {
  fire: 'Fire',
  nature: 'Nature',
  water: 'Water',
}

function EnemyDisplay({ enemy, lastEffect }: { enemy: EnemyState; lastEffect: CombatEffect | null }) {
  const hpPercent = enemy.maxHp === 0 ? 0 : (enemy.currentHp / enemy.maxHp) * 100
  const effectHitsEnemy = lastEffect?.targetIds.includes(enemy.id) ?? false

  return (
    <div className="enemy-panel">
      {effectHitsEnemy ? (
        <span key={`enemy-${lastEffect?.tick}`} className={`combat-float combat-float--${lastEffect?.kind}`}>
          {lastEffect?.label}
        </span>
      ) : null}
      <div className="enemy-header">
        <span className="enemy-emoji">{enemy.emoji}</span>
        <div>
          <h3>{enemy.name}</h3>
          <span className="enemy-hp-text">HP {enemy.currentHp}/{enemy.maxHp}</span>
        </div>
      </div>
      <div className="hp-bar">
        <span style={{ width: `${Math.max(0, hpPercent)}%` }} />
      </div>
      <div className="enemy-statuses">
        {enemy.block > 0 ? <span className="status-pill status-pill--block">Block {enemy.block}</span> : null}
        {enemy.burn > 0 ? <span className="status-pill status-pill--burn">Burn {enemy.burn}</span> : null}
        {enemy.charging != null ? <span className="status-pill status-pill--charge">Charged ({enemy.charging})</span> : null}
      </div>
      <div className="enemy-intent">
        <span className="eyebrow">Intent</span>
        <span className={`intent-label intent-label--${enemy.currentIntent.type}`}>
          {enemy.currentIntent.label}
        </span>
      </div>
    </div>
  )
}

function SpellBookPanel() {
  const spells = getAllSpells()
  const tiers = [1, 2, 3] as const
  return (
    <details className="spellbook-panel">
      <summary>Spell Book</summary>
      {tiers.map((tier) => (
        <div key={tier} className="spellbook-tier">
          <p className="eyebrow">Tier {tier}</p>
          <div className="spellbook-entries">
            {spells
              .filter((s) => s.tier === tier)
              .map((spell) => (
                <div key={spell.id} className="spellbook-entry">
                  <span className="spellbook-elements">
                    {spell.elements.map((e, i) => (
                      <span key={`${spell.id}-${e}-${i}`} className={`element-pip element-pip--${e}`}>
                        {ELEMENT_SYMBOL[e]}
                      </span>
                    ))}
                  </span>
                  <strong>{spell.name}</strong>
                  <span className="muted">{spell.description}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </details>
  )
}

export function CombatScreen({ state, onToggleCard, onCast, onEndTurn }: CombatScreenProps) {
  const { hand, selectedIndices, enemy, playerHp, playerMaxHp, playerBlock, playerBurn, combatLog, lastEffect, encounterIndex, encounters } = state

  const selectedElements = useMemo(
    () => selectedIndices.map((i) => hand[i]!),
    [selectedIndices, hand],
  )

  const matchedSpell: Spell | null = useMemo(
    () => findSpell(selectedElements),
    [selectedElements],
  )

  const playerHpPercent = playerMaxHp === 0 ? 0 : (playerHp / playerMaxHp) * 100
  const effectHitsPlayer = lastEffect?.targetIds.includes('player') ?? false

  if (!enemy) return null

  return (
    <section className="screen">
      <div className="combat-top-bar">
        <div className="player-status">
          {effectHitsPlayer ? (
            <span key={`player-${lastEffect?.tick}`} className={`combat-float combat-float--${lastEffect?.kind}`}>
              {lastEffect?.label}
            </span>
          ) : null}
          <div className="player-hp-row">
            <span className="player-hp-label">HP {playerHp}/{playerMaxHp}</span>
            {playerBlock > 0 ? <span className="status-pill status-pill--block">Block {playerBlock}</span> : null}
            {playerBurn > 0 ? <span className="status-pill status-pill--burn">Burn {playerBurn}</span> : null}
          </div>
          <div className="hp-bar">
            <span style={{ width: `${Math.max(0, playerHpPercent)}%` }} />
          </div>
        </div>
        <span className="encounter-counter">Fight {encounterIndex + 1}/{encounters.length}</span>
      </div>

      <div className={`combat-arena ${lastEffect?.shake ? 'is-shaking' : ''}`}>
        <EnemyDisplay enemy={enemy} lastEffect={lastEffect} />
      </div>

      <div className="hand-section">
        <p className="eyebrow">Your Hand</p>
        <div className="hand-cards">
          {hand.map((element, index) => {
            const isSelected = selectedIndices.includes(index)
            return (
              <button
                key={`card-${index}`}
                type="button"
                className={`element-card element-card--${element} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onToggleCard(index)}
              >
                <span className="element-card__symbol">{ELEMENT_SYMBOL[element]}</span>
                <span className="element-card__label">{ELEMENT_LABEL[element]}</span>
              </button>
            )
          })}
          {hand.length === 0 ? <span className="muted">No cards remaining</span> : null}
        </div>
      </div>

      <div className="spell-preview">
        {selectedIndices.length > 0 ? (
          matchedSpell ? (
            <div className="spell-match">
              <span className="spell-match__elements">
                {selectedElements.map((e, i) => (
                  <span key={`sel-${i}`} className={`element-pip element-pip--${e}`}>
                    {ELEMENT_SYMBOL[e]}
                  </span>
                ))}
              </span>
              <span className="spell-match__arrow">&rarr;</span>
              <strong>{matchedSpell.name}</strong>
              <span className="muted">{matchedSpell.description}</span>
            </div>
          ) : (
            <div className="spell-match spell-match--invalid">
              <span className="spell-match__elements">
                {selectedElements.map((e, i) => (
                  <span key={`sel-${i}`} className={`element-pip element-pip--${e}`}>
                    {ELEMENT_SYMBOL[e]}
                  </span>
                ))}
              </span>
              <span className="muted">No matching spell</span>
            </div>
          )
        ) : (
          <span className="muted">Select element cards to form a spell</span>
        )}
      </div>

      <div className="combat-actions">
        <button
          className="primary-button"
          type="button"
          disabled={!matchedSpell}
          onClick={onCast}
        >
          Cast {matchedSpell?.name ?? ''}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onEndTurn}
        >
          End Turn
        </button>
      </div>

      <SpellBookPanel />

      <div className="log-panel">
        <h3>Combat Log</h3>
        <ul>
          {combatLog.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
