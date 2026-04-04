import { ENEMY_GROUPS } from './creatures'
import type { EncounterDefinition, MapLayer } from '../types'

const EASY_POOLS = ['brambleSolo', 'galeSolo', 'hollowSolo', 'mireSolo'] as const
const MEDIUM_POOLS = ['brambleGale', 'mireHollow', 'brambleHollow', 'galeMire'] as const
const HARD_POOLS = ['mireHollow', 'brambleGale', 'galeHollow', 'brambleMire'] as const
const ELITE_POOLS = ['elitePoolA', 'elitePoolB'] as const
const EVENT_IDS = ['strange-pool', 'wandering-merchant', 'forgotten-shrine', 'islands-gift'] as const

function shuffle<T>(items: readonly T[]) {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[swapIndex]!
    next[swapIndex] = current!
  }

  return next
}

function sample<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function createFightEncounter(
  id: string,
  text: string,
  enemyGroupId: string,
  rewardTier: 'normal' | 'elite',
  type: 'fight' | 'elite' | 'boss' = 'fight',
  showPreview = true,
): EncounterDefinition {
  const previewCreature = ENEMY_GROUPS[enemyGroupId]?.[0]

  return {
    id,
    type,
    text,
    resolvedEnemyGroupId: enemyGroupId,
    rewardTier,
    previewEnemyName: showPreview ? previewCreature?.name : undefined,
    previewEnemyElement: showPreview ? previewCreature?.element : undefined,
  }
}

function createFightLayer(layerId: string, prefix: string, text: string, pools: readonly string[]): MapLayer {
  const picks = shuffle(pools).slice(0, 3)

  return {
    id: layerId,
    options: picks.map((groupId, index) =>
      createFightEncounter(`${prefix}-${index + 1}`, text, groupId, 'normal'),
    ),
  }
}

export function generateRunMap(): MapLayer[] {
  const midFight = sample(MEDIUM_POOLS)!
  const eliteFight = sample(ELITE_POOLS)!
  const eventId = sample(EVENT_IDS)!

  return [
    createFightLayer(
      'layer-1',
      'opening',
      'The undergrowth shifts. Three routes open, each carrying a different scent of danger.',
      EASY_POOLS,
    ),
    {
      id: 'layer-2',
      options: [
        createFightEncounter('forked-trail', 'A second hunt waits just ahead if you want to keep pressing.', midFight, 'normal'),
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
    createFightLayer(
      'layer-3',
      'midway',
      'The mist parts. Stronger shapes wait behind each trail marker.',
      MEDIUM_POOLS,
    ),
    {
      id: 'layer-4',
      options: [
        createFightEncounter(
          'elite-watch',
          'The island focuses its weight on you, as if measuring what you can carry.',
          eliteFight,
          'elite',
          'elite',
          false,
        ),
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
          id: 'signs-in-the-haze',
          type: 'event',
          text: 'Something uncanny waits beside the path, as if the island has a bargain in mind.',
          eventId,
        },
        {
          id: 'late-recruit',
          type: 'recruit',
          text: 'A lone creature steps from the reeds, weighing your wounds before it speaks.',
        },
      ],
    },
    createFightLayer(
      'layer-6',
      'deep-inland',
      'Deeper inland, the island sends something harder and less patient.',
      HARD_POOLS,
    ),
    createFightLayer(
      'layer-7',
      'last-watch',
      'Nothing here expects all of you to survive. The island is done being gentle.',
      HARD_POOLS,
    ),
    {
      id: 'layer-8',
      options: [
        createFightEncounter(
          'warden',
          'The Warden waits where the shoreline fades into mist. It does not bar the path. It asks whether you are ready to cross.',
          'wardenSolo',
          'normal',
          'boss',
          false,
        ),
      ],
    },
  ]
}

export const RUN_MAP = generateRunMap()
