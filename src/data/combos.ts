import type { ComboResult, ElementCard } from '../types'

export function resolveSingle(card: ElementCard): ComboResult {
  switch (card.element) {
    case 'fire':
      return { damage: card.value }
    case 'nature':
      return { block: card.value }
    case 'water':
      return { heal: card.value }
  }
}

export function resolveCombo(first: ElementCard, second: ElementCard): ComboResult {
  let dominant: ElementCard
  let secondary: ElementCard

  if (first.value >= second.value) {
    dominant = first
    secondary = second
  } else {
    dominant = second
    secondary = first
  }

  const domEl = dominant.element
  const secEl = secondary.element

  if (domEl === secEl) {
    const total = dominant.value + secondary.value + 2
    switch (domEl) {
      case 'fire':
        return { damage: total }
      case 'nature':
        return { block: total }
      case 'water':
        return { heal: total }
    }
  }

  if (domEl === 'fire' && secEl === 'nature') {
    return { damage: dominant.value, burn: secondary.value }
  }
  if (domEl === 'fire' && secEl === 'water') {
    return { damage: dominant.value, heal: secondary.value }
  }
  if (domEl === 'nature' && secEl === 'fire') {
    return { block: dominant.value, thorns: secondary.value }
  }
  if (domEl === 'nature' && secEl === 'water') {
    return { block: dominant.value, regen: secondary.value }
  }
  if (domEl === 'water' && secEl === 'fire') {
    return { heal: dominant.value, cleanse: secondary.value }
  }
  if (domEl === 'water' && secEl === 'nature') {
    return { heal: dominant.value, block: secondary.value }
  }

  return {}
}

export function resolveCards(cards: ElementCard[]): ComboResult | null {
  if (cards.length === 1) return resolveSingle(cards[0]!)
  if (cards.length === 2) return resolveCombo(cards[0]!, cards[1]!)
  return null
}

export function getManaCost(cards: ElementCard[]): number {
  return cards.reduce((sum, c) => sum + c.value, 0)
}

export function describeComboResult(result: ComboResult): string {
  const parts: string[] = []
  if (result.damage) parts.push(`${result.damage} damage`)
  if (result.block) parts.push(`${result.block} block`)
  if (result.heal) parts.push(`${result.heal} heal`)
  if (result.burn) parts.push(`${result.burn} burn`)
  if (result.thorns) parts.push(`${result.thorns} thorns`)
  if (result.regen) parts.push(`${result.regen} regen`)
  if (result.cleanse) parts.push(`cleanse ${result.cleanse} burn`)
  return parts.join(' + ')
}

export function getComboName(cards: ElementCard[]): string {
  if (cards.length === 1) {
    const c = cards[0]!
    switch (c.element) {
      case 'fire': return 'Spark'
      case 'nature': return 'Bark'
      case 'water': return 'Mend'
    }
  }

  if (cards.length === 2) {
    let dominant: ElementCard
    let secondary: ElementCard
    if (cards[0]!.value >= cards[1]!.value) {
      dominant = cards[0]!
      secondary = cards[1]!
    } else {
      dominant = cards[1]!
      secondary = cards[0]!
    }

    if (dominant.element === secondary.element) {
      switch (dominant.element) {
        case 'fire': return 'Fire Blast'
        case 'nature': return 'Ironbark'
        case 'water': return 'Torrent'
      }
    }

    const key = `${dominant.element}+${secondary.element}`
    switch (key) {
      case 'fire+nature': return 'Scorch'
      case 'fire+water': return 'Siphon'
      case 'nature+fire': return 'Bramble'
      case 'nature+water': return 'Overgrowth'
      case 'water+fire': return 'Purify'
      case 'water+nature': return 'Bloom'
    }
  }

  return 'Unknown'
}
