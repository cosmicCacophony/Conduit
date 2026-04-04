import type { EventDefinition } from '../types'

export const EVENTS: Record<string, EventDefinition> = {
  'strange-pool': {
    id: 'strange-pool',
    title: 'Strange Pool',
    text: 'A black pool mirrors nothing. The island waits to see whether you drink.',
    choices: [
      {
        id: 'drink',
        label: 'Drink deeply',
        description: 'Heal one creature for 50% of its max HP, but reduce its speed by 1 for the run.',
        requiresCreature: true,
      },
      {
        id: 'leave',
        label: 'Step away',
        description: 'Take nothing and move on.',
      },
    ],
  },
  'wandering-merchant': {
    id: 'wandering-merchant',
    title: 'Wandering Merchant',
    text: 'The figure offers a trade without naming its price.',
    choices: [
      {
        id: 'buy-power',
        label: 'Take the sharper edge',
        description: 'One creature gains +2 attack and loses 2 max HP.',
        requiresCreature: true,
      },
      {
        id: 'decline',
        label: 'Keep your balance',
        description: 'Leave unchanged.',
      },
    ],
  },
  'forgotten-shrine': {
    id: 'forgotten-shrine',
    title: 'Forgotten Shrine',
    text: 'The stones remember violence better than mercy.',
    choices: [
      {
        id: 'sacrifice-slot',
        label: 'Offer versatility',
        description: 'One creature loses its second special slot potential, but its first special gains +4 value and -1 cooldown.',
        requiresCreature: true,
      },
      {
        id: 'walk-away',
        label: 'Refuse the bargain',
        description: 'Leave the shrine untouched.',
      },
    ],
  },
  'islands-gift': {
    id: 'islands-gift',
    title: "Island's Gift",
    text: 'Two relics rise from the shallows, and the tide will only release one.',
    choices: [
      {
        id: 'take-gift',
        label: 'Accept a relic',
        description: 'Choose 1 of 2 random artifacts.',
      },
      {
        id: 'leave-gift',
        label: 'Leave them to the tide',
        description: 'Move on empty-handed.',
      },
    ],
  },
}
