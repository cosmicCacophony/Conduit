import type { CreatureTemplate, ElementCard, EnemyState, EnemyTemplate } from '../types'

export const PLAYER_MAX_HP = 30
export const HAND_SIZE = 5
export const HEAL_BETWEEN_FIGHTS = 5
export const BASE_MANA = 6
export const BANK_CAP = 4
export const SURGE_BONUS = 2
export const ENEMY_ACTION_MULTIPLIER = 2
export const VULNERABLE_MULTIPLIER = 1.75

export function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = next[i]
    next[i] = next[j]!
    next[j] = tmp!
  }
  return next
}

export function buildDeck(team: CreatureTemplate[]): ElementCard[] {
  const cards: ElementCard[] = []
  for (const creature of team) {
    for (const value of creature.cardValues) {
      cards.push({ element: creature.element, value, creatureId: creature.id })
    }
  }
  return cards
}

export function drawCards(
  drawPile: ElementCard[],
  discardPile: ElementCard[],
  count: number,
): { hand: ElementCard[]; drawPile: ElementCard[]; discardPile: ElementCard[] } {
  let pile = [...drawPile]
  let discard = [...discardPile]
  const drawn: ElementCard[] = []

  while (drawn.length < count) {
    if (pile.length === 0) {
      if (discard.length === 0) break
      pile = shuffle(discard)
      discard = []
    }
    drawn.push(pile.pop()!)
  }

  return { hand: drawn, drawPile: pile, discardPile: discard }
}

export function drawEnemyCard(enemy: EnemyState): { card: ElementCard; enemy: EnemyState } {
  let drawPile = [...enemy.drawPile]
  let discardPile = [...enemy.discardPile]

  if (drawPile.length === 0) {
    if (discardPile.length === 0) {
      return { card: { element: 'fire', value: 1, creatureId: '' }, enemy }
    }
    drawPile = shuffle(discardPile)
    discardPile = []
  }

  const card = drawPile.pop()!
  return {
    card,
    enemy: { ...enemy, drawPile, discardPile },
  }
}

export function createEnemy(template: EnemyTemplate): EnemyState {
  const shuffledDeck = shuffle([...template.deck])
  const drawPile = [...shuffledDeck]
  const firstCard = drawPile.pop()!

  return {
    id: template.id,
    name: template.name,
    emoji: template.emoji,
    maxHp: template.maxHp,
    currentHp: template.maxHp,
    block: 0,
    burn: 0,
    regen: 0,
    vulnerable: 0,
    drawPile,
    discardPile: [],
    currentCard: firstCard,
  }
}

export function dealDamageToEnemy(
  enemy: EnemyState,
  rawDamage: number,
): { enemy: EnemyState; dealt: number; blocked: number } {
  const blocked = Math.min(enemy.block, rawDamage)
  const dealt = rawDamage - blocked
  return {
    enemy: {
      ...enemy,
      block: enemy.block - blocked,
      currentHp: Math.max(0, enemy.currentHp - dealt),
    },
    dealt,
    blocked,
  }
}

export function dealDamageToPlayer(
  playerHp: number,
  playerBlock: number,
  rawDamage: number,
): { playerHp: number; playerBlock: number; dealt: number; blocked: number } {
  const blocked = Math.min(playerBlock, rawDamage)
  const dealt = rawDamage - blocked
  return {
    playerHp: Math.max(0, playerHp - dealt),
    playerBlock: playerBlock - blocked,
    dealt,
    blocked,
  }
}
