import { useEffect, useMemo, useRef, useState } from 'react'

import './App.css'
import { playSoundCue } from './audio'
import { CombatScreen } from './components/CombatScreen'
import { GameOverScreen } from './components/GameOverScreen'
import { RecruitScreen } from './components/RecruitScreen'
import { RestScreen } from './components/RestScreen'
import { RewardScreen } from './components/RewardScreen'
import { TeamSelectScreen } from './components/TeamSelectScreen'
import { TitleScreen } from './components/TitleScreen'
import { useGameState } from './hooks/useGameState'
import { getRunHistorySummary, readRunHistory, writeRunHistory } from './storage'
import type { RewardType, RunHistoryEntry } from './types'

function App() {
  const { state, dispatch, availableCreatures, selectedTeam } = useGameState()
  const [history] = useState<RunHistoryEntry[]>(() => readRunHistory())
  const savedRunRef = useRef<string | null>(null)
  const playedEffectRef = useRef<number | null>(null)

  useEffect(() => {
    if (state.phase !== 'combat' || state.combatTurn !== 'enemy' || state.enemies.length === 0) {
      return
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'ENEMY_TURN' })
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [dispatch, state.combatTurn, state.enemies.length, state.phase])

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

  function handleReward(creatureId: string, reward: RewardType) {
    dispatch({ type: 'APPLY_REWARD', creatureId, reward })
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

      case 'teamSelect':
        return (
          <TeamSelectScreen
            creatures={availableCreatures}
            encounterIndex={state.encounterIndex}
            encounterText={state.encounterText}
            onConfirm={(ids) => dispatch({ type: 'SELECT_TEAM', ids })}
          />
        )

      case 'combat':
        if (state.enemies.length === 0) {
          return null
        }

        return (
          <CombatScreen
            team={selectedTeam}
            enemies={state.enemies}
            combatTurn={state.combatTurn}
            actedCreatureIds={state.actedCreatureIds}
            combatLog={state.combatLog}
            lastEffect={state.lastEffect}
            onAction={(creatureId, action, specialIndex, targetId) =>
              dispatch({ type: 'PLAYER_ACTION', creatureId, action, specialIndex, targetId })
            }
          />
        )

      case 'reward':
        return (
          <RewardScreen
            rewardTier={state.rewardTier}
            creatures={state.roster}
            learnOffers={state.learnOffers}
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
    </main>
  )
}

export default App
