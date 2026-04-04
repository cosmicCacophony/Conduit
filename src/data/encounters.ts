import type { MapLayer } from '../types'

export const RUN_MAP: MapLayer[] = [
  {
    id: 'layer-1',
    options: [
      {
        id: 'shoreline-skirmish',
        type: 'fight',
        text: 'Something stirs in the undergrowth, as though the island is listening.',
        enemyGroupPool: ['brambleSolo', 'galeSolo'],
        rewardTier: 'normal',
      },
    ],
  },
  {
    id: 'layer-2',
    options: [
      {
        id: 'forked-trail',
        type: 'fight',
        text: 'The path forks and the mist gathers around two possible hunts.',
        enemyGroupPool: ['brambleGale'],
        rewardTier: 'normal',
      },
      {
        id: 'curious-strangers',
        type: 'recruit',
        text: 'A pair of wandering creatures linger by the tidepool, watching to see whether you make room for them.',
      },
      {
        id: 'still-water',
        type: 'rest',
        text: 'The island offers a moment of stillness.',
      },
    ],
  },
  {
    id: 'layer-3',
    options: [
      {
        id: 'gauntlet',
        type: 'fight',
        text: 'The mist parts. Another challenger already waits, as though it knew your steps.',
        enemyGroupPool: ['brambleGale'],
        rewardTier: 'normal',
      },
    ],
  },
  {
    id: 'layer-4',
    options: [
      {
        id: 'elite-watch',
        type: 'elite',
        text: 'The island focuses its weight on you, as if measuring what you can carry.',
        enemyGroupPool: ['elitePoolA', 'elitePoolB'],
        rewardTier: 'elite',
      },
    ],
  },
  {
    id: 'layer-5',
    options: [
      {
        id: 'second-breath',
        type: 'rest',
        text: 'A pocket of quiet waits off the trail. The island allows a slower breath.',
      },
      {
        id: 'merchant-in-the-haze',
        type: 'event',
        text: 'Something shaped like a merchant waits beside a crooked lantern.',
        eventId: 'wandering-merchant',
      },
      {
        id: 'late-recruit',
        type: 'recruit',
        text: 'A lone creature steps from the reeds, weighing your wounds before it speaks.',
      },
    ],
  },
  {
    id: 'layer-6',
    options: [
      {
        id: 'deeper-inland',
        type: 'fight',
        text: 'Deeper inland, the island sends something harder and less patient.',
        enemyGroupPool: ['mireHollow'],
        rewardTier: 'normal',
      },
    ],
  },
  {
    id: 'layer-7',
    options: [
      {
        id: 'last-watch',
        type: 'fight',
        text: 'Nothing here expects all of you to survive. The island is done being gentle.',
        enemyGroupPool: ['mireHollow', 'brambleGale'],
        rewardTier: 'normal',
      },
    ],
  },
  {
    id: 'layer-8',
    options: [
      {
        id: 'warden',
        type: 'boss',
        text: 'The Warden waits where the shoreline fades into mist. It does not bar the path. It asks whether you are ready to cross.',
        enemyGroupPool: ['wardenSolo'],
      },
    ],
  },
]
