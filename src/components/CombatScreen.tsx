import { useMemo } from 'react'

import { describeComboResult, getComboName, getManaCost, resolveCards } from '../data/combos'
import { getRelicById } from '../data/relics'
import { getEnemyRemainingByElement, getIntentValueRange } from '../hooks/useRunState'
import type { CombatEffect, Element, ElementCard, EnemyState, GameState, RelicId } from '../types'

type CombatScreenProps = {
  state: GameState
  onToggleCard: (index: number) => void
  onPlayCards: () => void
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

const INTENT_ICON: Record<string, string> = {
  attack: '⚔️',
  block: '🛡️',
  heal: '💚',
}

function ManaDisplay({ current, max }: { current: number; max: number }) {
  const dots = []
  const displayMax = Math.max(max, 12)
  for (let i = 0; i < displayMax; i++) {
    dots.push(
      <span
        key={i}
        className={`mana-dot ${i < current ? 'mana-dot--filled' : 'mana-dot--empty'}`}
      />,
    )
  }
  return (
    <div className="mana-display">
      <span className="mana-label">Mana</span>
      <div className="mana-dots">{dots}</div>
      <span className="mana-count">{current}</span>
    </div>
  )
}

function EnemyCardPip({ card }: { card: ElementCard }) {
  return (
    <span className={`enemy-card-pip enemy-card-pip--${card.element}`}>
      {ELEMENT_SYMBOL[card.element]}{card.value}
    </span>
  )
}

function EnemyDisplay({
  enemy,
  lastEffect,
  relicId,
}: {
  enemy: EnemyState
  lastEffect: CombatEffect | null
  relicId: RelicId | null
}) {
  const hpPercent = enemy.maxHp === 0 ? 0 : (enemy.currentHp / enemy.maxHp) * 100
  const effectHitsEnemy = lastEffect?.targetIds.includes(enemy.id) ?? false

  const intentInfo = getIntentValueRange(enemy, relicId)
  const remaining = getEnemyRemainingByElement(enemy)
  const totalRemaining = enemy.drawPile.length + (enemy.currentCard ? 1 : 0)

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
        {enemy.regen > 0 ? <span className="status-pill status-pill--regen">Regen {enemy.regen}</span> : null}
      </div>

      {intentInfo ? (
        <div className="enemy-intent">
          <span className="eyebrow">Intent</span>
          <span className={`intent-label intent-label--${intentInfo.type}`}>
            {INTENT_ICON[intentInfo.type]}{' '}
            {intentInfo.type === 'attack' ? 'Attack' : intentInfo.type === 'block' ? 'Block' : 'Heal'}
            {relicId === 'mirror-shard'
              ? ` ${intentInfo.exactValue}`
              : intentInfo.min === intentInfo.max
                ? ` ${intentInfo.min}`
                : ` ${intentInfo.min}-${intentInfo.max}`
            }
          </span>
        </div>
      ) : null}

      <div className="enemy-cards-info">
        <div className="enemy-played">
          <span className="eyebrow">Played</span>
          <div className="enemy-card-pips">
            {enemy.discardPile.length === 0
              ? <span className="muted">none</span>
              : enemy.discardPile.map((card, i) => <EnemyCardPip key={i} card={card} />)
            }
          </div>
        </div>
        <div className="enemy-remaining">
          <span className="eyebrow">Remaining ({totalRemaining})</span>
          <div className="enemy-remaining-summary">
            {remaining.fire.length > 0 && <span className="element-count element-count--fire">{ELEMENT_SYMBOL.fire}{remaining.fire.length}</span>}
            {remaining.nature.length > 0 && <span className="element-count element-count--nature">{ELEMENT_SYMBOL.nature}{remaining.nature.length}</span>}
            {remaining.water.length > 0 && <span className="element-count element-count--water">{ELEMENT_SYMBOL.water}{remaining.water.length}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CombatScreen({ state, onToggleCard, onPlayCards, onEndTurn }: CombatScreenProps) {
  const {
    hand, selectedIndices, enemy, playerHp, playerMaxHp, playerBlock, playerBurn,
    playerThorns, playerRegen, mana, bankedMana, hasSurge, cardsPlayedThisTurn,
    combatLog, lastEffect, encounterIndex, encounters, drawPile, discardPile,
    selectedRelic,
  } = state

  const selectedCards: ElementCard[] = useMemo(
    () => selectedIndices.map((i) => hand[i]!),
    [selectedIndices, hand],
  )

  const comboResult = useMemo(
    () => resolveCards(selectedCards),
    [selectedCards],
  )

  const manaCost = useMemo(
    () => getManaCost(selectedCards),
    [selectedCards],
  )

  const comboName = useMemo(
    () => selectedCards.length > 0 ? getComboName(selectedCards) : null,
    [selectedCards],
  )

  const canAfford = manaCost <= mana
  const canPlay = comboResult != null && canAfford && selectedCards.length > 0

  const playerHpPercent = playerMaxHp === 0 ? 0 : (playerHp / playerMaxHp) * 100
  const effectHitsPlayer = lastEffect?.targetIds.includes('player') ?? false

  const relic = selectedRelic ? getRelicById(selectedRelic) : null

  const isPass = cardsPlayedThisTurn === 0

  if (!enemy) return null

  return (
    <section className="screen">
      <div className="combat-top-bar">
        <span className="encounter-counter">Fight {encounterIndex + 1}/{encounters.length}</span>
        <ManaDisplay current={mana} max={12} />
        <div className="combat-top-right">
          {bankedMana > 0 && <span className="bank-badge">Bank: {bankedMana}</span>}
          {hasSurge && <span className="surge-badge">Surge +2</span>}
          <span className="pile-counts">Draw: {drawPile.length} | Discard: {discardPile.length}</span>
        </div>
      </div>

      <div className={`combat-arena ${lastEffect?.shake ? 'is-shaking' : ''}`}>
        <EnemyDisplay enemy={enemy} lastEffect={lastEffect} relicId={selectedRelic} />
      </div>

      <div className="spell-preview">
        {selectedCards.length > 0 ? (
          comboResult ? (
            <div className={`spell-match ${!canAfford ? 'spell-match--no-mana' : ''}`}>
              <span className="spell-match__elements">
                {selectedCards.map((c, i) => (
                  <span key={`sel-${i}`} className={`element-pip element-pip--${c.element}`}>
                    {ELEMENT_SYMBOL[c.element]}<sup>{c.value}</sup>
                  </span>
                ))}
              </span>
              <span className="spell-match__arrow">&rarr;</span>
              <strong>{comboName}</strong>
              <span className="spell-computed">{describeComboResult(comboResult)}</span>
              <span className={`spell-cost ${!canAfford ? 'spell-cost--over' : ''}`}>
                {manaCost} mana
              </span>
            </div>
          ) : (
            <div className="spell-match spell-match--invalid">
              <span className="muted">Invalid selection</span>
            </div>
          )
        ) : (
          <span className="muted">Select 1-2 cards to play</span>
        )}
      </div>

      <div className="hand-section">
        <p className="eyebrow">Your Hand</p>
        <div className="hand-cards">
          {hand.map((card, index) => {
            const selIdx = selectedIndices.indexOf(index)
            const isSelected = selIdx !== -1
            return (
              <button
                key={`card-${index}`}
                type="button"
                className={`element-card element-card--${card.element} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onToggleCard(index)}
              >
                {isSelected && <span className="card-order">{selIdx + 1}</span>}
                <span className="element-card__value">{card.value}</span>
                <span className="element-card__symbol">{ELEMENT_SYMBOL[card.element]}</span>
                <span className="element-card__label">{ELEMENT_LABEL[card.element]}</span>
              </button>
            )
          })}
          {hand.length === 0 ? <span className="muted">No cards remaining</span> : null}
        </div>
      </div>

      <div className="combat-actions">
        <button
          className="primary-button"
          type="button"
          disabled={!canPlay}
          onClick={onPlayCards}
        >
          {selectedCards.length === 2 ? 'Play Combo' : 'Play Card'}
          {canPlay ? ` (${manaCost})` : ''}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onEndTurn}
        >
          {isPass ? 'Pass (+2 Surge)' : 'End Turn'}
        </button>
      </div>

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
          {playerThorns > 0 ? <span className="status-pill status-pill--thorns">Thorns {playerThorns}</span> : null}
          {playerRegen > 0 ? <span className="status-pill status-pill--regen">Regen {playerRegen}</span> : null}
        </div>
        <div className="hp-bar">
          <span style={{ width: `${Math.max(0, playerHpPercent)}%` }} />
        </div>
        {relic && (
          <div className="relic-indicator">
            <span className="relic-indicator__emoji">{relic.emoji}</span>
            <span className="relic-indicator__name">{relic.name}</span>
          </div>
        )}
      </div>

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
