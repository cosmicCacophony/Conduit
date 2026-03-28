import type { EncounterDefinition } from '../types'

export const ENCOUNTERS: EncounterDefinition[] = [
  {
    id: 'shoreline-skirmish',
    type: 'fight',
    text: 'Something stirs in the undergrowth.',
    enemyGroupPool: ['brambleSolo', 'galeSolo'],
    rewardTier: 'normal',
  },
  {
    id: 'first-duo',
    type: 'fight',
    text: 'Two shapes move together through the haze.',
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
    text: 'The island focuses its weight on you.',
    enemyGroupPool: ['elitePoolA', 'elitePoolB'],
    rewardTier: 'elite',
  },
  {
    id: 'still-water',
    type: 'rest',
    text: 'The island offers a moment of stillness.',
  },
  {
    id: 'second-recruit',
    type: 'recruit',
    text: 'Another call answers yours from deeper inland.',
  },
  {
    id: 'gauntlet',
    type: 'fight',
    text: 'The mist parts. A pair already waits for you.',
    enemyGroupPool: ['mireHollow', 'brambleGale'],
    rewardTier: 'normal',
  },
  {
    id: 'warden',
    type: 'boss',
    text: 'The Warden waits where the shoreline fades into mist.',
    enemyGroupPool: ['wardenSolo'],
  },
]
