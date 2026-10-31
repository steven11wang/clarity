// One saved game per browser, kept apart from the live app's storage so the
// redesign preview can never touch a real learner's data.

import { useSyncExternalStore } from 'react'

import { dayKey, freshState, rollover, today, type GameState } from './engine.ts'

const KEY = 'clarity-redesign:v1'

function read(): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as GameState
      if (parsed && parsed.version === 1) return rollover(parsed, today(parsed))
    }
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return freshState(dayKey(new Date()))
}

let state: GameState = read()
const listeners = new Set<() => void>()

function write(next: GameState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private window: the game still runs, it just won't remember */
  }
  listeners.forEach((listener) => listener())
}

export function getGame(): GameState {
  return state
}

export function updateGame(change: (current: GameState) => GameState) {
  write(change(state))
}

export function resetGame() {
  write(freshState(dayKey(new Date())))
}

/** Demo clock: jump a day forward so comebacks come due without waiting. */
export function advanceDay(days = 1) {
  const moved = { ...state, dayOffset: state.dayOffset + days }
  write(rollover(moved, today(moved)))
}

export function useGame(): GameState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export function useToday(): string {
  const game = useGame()
  return today(game)
}
