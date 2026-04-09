import type { CreatureTemplate } from '../types'

export const ALL_CREATURES: CreatureTemplate[] = [
  { id: 'ember', name: 'Ember', emoji: '🔥', element: 'fire', cardValues: [1, 2, 3, 4, 5], signature: { damage: 3 } },
  { id: 'moss', name: 'Moss', emoji: '🪨', element: 'nature', cardValues: [1, 2, 3, 4, 5], signature: { block: 3 } },
  { id: 'drift', name: 'Drift', emoji: '🌫️', element: 'water', cardValues: [1, 2, 3, 4, 5], signature: { cleanse: 99 } },
  { id: 'shade', name: 'Shade', emoji: '🕯️', element: 'fire', cardValues: [2, 2, 3, 5, 5], signature: { burn: 2 } },
  { id: 'thorn', name: 'Thorn', emoji: '🌿', element: 'nature', cardValues: [1, 1, 2, 3, 5], signature: { thorns: 2 } },
  { id: 'ripple', name: 'Ripple', emoji: '💧', element: 'water', cardValues: [1, 1, 2, 2, 3], signature: { regen: 2 } },
]
