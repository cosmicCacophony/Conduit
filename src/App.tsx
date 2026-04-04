import { useEffect, useMemo, useRef, useState } from 'react'

import './App.css'
import { playSoundCue } from './audio'
import { CombatScreen } from './components/CombatScreen'
import { EventScreen } from './components/EventScreen'
import { GameOverScreen } from './components/GameOverScreen'
import { PathScreen } from './components/PathScreen'
import { RecruitScreen } from './components/RecruitScreen'
import { RestScreen } from './components/RestScreen'
import { RewardScreen } from './components/RewardScreen'
import { TeamSelectScreen } from './components/TeamSelectScreen'
import { TitleScreen } from './components/TitleScreen'
import { useRunState } from './hooks/useRunState'
import { getRunHistorySummary, readRunHistory, writeRunHistory } from './storage'
import type { RewardType, RunHistoryEntry } from './types'

function App() {
  const { state, dispatch, availableCreatures, selectedTeam, activeCreature, currentEnemy, currentEvent } =
    useRunState()
  const [history] = useState<RunHistoryEntry[]>(() => readRunHistory())
  const savedRunRef = useRef<string | null>(null)
  const playedEffectRef = useRef<number | null>(null)

  useEffect(() => {
    if (!state.lastEffect || playedEffectRef.current === state.lastEffect.tick) {
      return
    }

    playedEffectRef.current = state.lastEffect.tick
    playSoundCue(state.lastEffect.sound)
  }, [state.lastEffect])

  useEffect(() => {
    if (state.phase !== 'victory' && state.phase !== 'defeat') {
      savedRunRef.current = null
      return
    }

    const runKey = `${state.phase}-${state.stats.fightsWon}-${state.stats.encountersCleared}-${state.stats.boostsGiven}`
    if (savedRunRef.current === runKey) {
      return
    }

    const nextEntry: RunHistoryEntry = {
      timestamp: Date.now(),
      result: state.phase,
      fightsWon: state.stats.fightsWon,
      boostsGiven: state.stats.boostsGiven,
      encountersCleared: state.stats.encountersCleared,
      recruited: state.stats.recruited,
      rosterSnapshot: state.roster.map((creature) => `${creature.name} (${creature.currentHp}/${creature.maxHp})`),
    }
    const nextHistory = [...history, nextEntry]
    writeRunHistory(nextHistory)
    savedRunRef.current = runKey
  }, [history, state.phase, state.roster, state.stats])

  const historySummary = useMemo(() => getRunHistorySummary(history), [history])

  function handleReward(reward: RewardType, creatureId?: string) {
    dispatch({ type: 'APPLY_REWARD', reward, creatureId })
    dispatch({ type: 'NEXT_ENCOUNTER' })
  }

  function handleRecruit(creatureId: string) {
    dispatch({ type: 'RECRUIT', creatureId })
    dispatch({ type: 'NEXT_ENCOUNTER' })
  }

  function handleSkipRecruit() {
    dispatch({ type: 'SKIP_RECRUIT' })
    dispatch({ type: 'NEXT_ENCOUNTER' })
  }

  function renderScreen() {
    switch (state.phase) {
      case 'title':
        return <TitleScreen onStart={() => dispatch({ type: 'START_RUN' })} summary={historySummary} />

      case 'pathChoice':
        return <PathScreen layerIndex={state.encounterIndex} options={state.pathOptions} onChoose={(encounterId) => dispatch({ type: 'CHOOSE_PATH', encounterId })} />

      case 'teamSelect':
        return (
          <TeamSelectScreen
            creatures={availableCreatures}
            fullRoster={state.roster}
            encounterIndex={state.encounterIndex}
            encounterText={state.encounterText}
            onConfirm={(ids) => dispatch({ type: 'SELECT_TEAM', ids })}
          />
        )

      case 'combat':
        return (
          <CombatScreen
            team={selectedTeam}
            activeCreature={activeCreature}
            enemies={state.enemies}
            enemyQueueIndex={state.enemyQueueIndex}
            freeSwitch={state.freeSwitch}
            combatLog={state.combatLog}
            lastEffect={state.lastEffect}
            artifacts={state.artifacts}
            onAction={(action, specialIndex) => dispatch({ type: 'PLAYER_ACTION', action, specialIndex })}
            onSwitch={(creatureId) => dispatch({ type: 'SWITCH', creatureId })}
          />
        )

      case 'reward':
        return (
          <RewardScreen
            rewardTier={state.rewardTier}
            creatures={state.roster}
            learnOffers={state.learnOffers}
            artifactOffers={state.artifactOffers}
            onApply={handleReward}
          />
        )

      case 'recruit':
        return (
          <RecruitScreen
            encounterText={state.encounterText}
            creatures={state.recruitOffer}
            onRecruit={handleRecruit}
            onSkip={handleSkipRecruit}
          />
        )

      case 'rest':
        return (
          <RestScreen
            encounterText={state.encounterText}
            onContinue={() => dispatch({ type: 'REST_AND_CONTINUE' })}
          />
        )

      case 'event':
        return currentEvent ? (
          <EventScreen
            event={currentEvent}
            creatures={state.roster}
            onResolve={(choiceId, creatureId) => dispatch({ type: 'RESOLVE_EVENT', choiceId, creatureId })}
          />
        ) : null

      case 'victory':
        return (
          <GameOverScreen
            result="victory"
            roster={state.roster}
            stats={state.stats}
            onRestart={() => dispatch({ type: 'START_RUN' })}
          />
        )

      case 'defeat':
        return (
          <GameOverScreen
            result="defeat"
            roster={state.roster}
            stats={state.stats}
            onRestart={() => dispatch({ type: 'START_RUN' })}
          />
        )

      default:
        return null
    }
  }

  return (
    <main className="app-shell">
      <div className="app-frame">{renderScreen()}</div>
      {currentEnemy ? <span hidden>{currentEnemy.id}</span> : null}
    </main>
  )
}

export default App
