import type { EncounterDefinition } from '../types'

export const ENCOUNTERS: EncounterDefinition[] = [
  {
    id: 'shoreline-skirmish',
    type: 'fight',
    text: 'Something stirs in the undergrowth, as though the island is listening.',
    enemyGroupPool: ['brambleSolo', 'galeSolo'],
    rewardTier: 'normal',
  },
  {
    id: 'first-duo',
    type: 'fight',
    text: 'Two shapes move together through the haze, answering the same pull.',
    enemyGroupPool: ['brambleGale'],
    rewardTier: 'normal',
  },
  {
    id: 'first-recruit',
    type: 'recruit',
    text: 'Two creatures approach. Curious. Uncertain.',
  },
  {
    id: 'elite-watch',
    type: 'elite',
    text: 'The island focuses its weight on you, as if measuring what you can carry.',
    enemyGroupPool: ['elitePoolA', 'elitePoolB'],
    rewardTier: 'elite',
  },
  {
    id: 'still-water',
    type: 'rest',
    text: 'The island offers a moment of stillness.',
  },
  {
    id: 'gauntlet',
    type: 'fight',
    text: 'The mist parts. A pair already waits, as though they knew your steps.',
    enemyGroupPool: ['brambleGale'],
    rewardTier: 'normal',
  },
  {
    id: 'last-watch',
    type: 'fight',
    text: 'Deeper inland, the island tests what remains. Nothing here expects all of you to survive.',
    enemyGroupPool: ['mireHollow'],
    rewardTier: 'normal',
  },
  {
    id: 'warden',
    type: 'boss',
    text: 'The Warden waits where the shoreline fades into mist. It does not bar the path. It asks whether you are ready to cross.',
    enemyGroupPool: ['wardenSolo'],
  },
]
