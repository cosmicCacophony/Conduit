import type { RunHistoryEntry } from './types'

const STORAGE_KEY = 'conduit-run-history'

export function readRunHistory(): RunHistoryEntry[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as RunHistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeRunHistory(entries: RunHistoryEntry[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-20)))
}

export function getRunHistorySummary(entries: RunHistoryEntry[]) {
  let bestStreak = 0
  let currentStreak = 0

  for (const entry of entries) {
    if (entry.result === 'victory') {
      currentStreak += 1
      bestStreak = Math.max(bestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  return {
    runs: entries.length,
    wins: entries.filter((entry) => entry.result === 'victory').length,
    bestStreak,
  }
}
