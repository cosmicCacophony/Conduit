import type { EncounterDefinition } from '../types'

export const ENCOUNTERS: EncounterDefinition[] = [
  { type: 'fight', text: 'Something stirs in the undergrowth.' },
  { type: 'fight', text: 'A shape watches you from the ridge.' },
  { type: 'recruit', text: 'Two creatures approach. Curious. Uncertain.' },
  { type: 'fight', text: 'The air grows heavy. The island is testing you.' },
  { type: 'boss', text: 'The Warden waits where the shoreline fades into mist.' },
]
