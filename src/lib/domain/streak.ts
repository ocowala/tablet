import { addDays, daysBetween } from "./day";

export type DayOutcome = "passed" | "sincere_miss" | "unserious";

export type StreakState = {
  current: number;
  best: number;
  /** The last date the streak was kept, whether by a pass or a sincere miss. */
  lastPassedDate: string | null;
  freezesAvailable: number;
};

export const FREEZE_EVERY_DAYS = 14;

export function emptyStreak(): StreakState {
  return { current: 0, best: 0, lastPassedDate: null, freezesAvailable: 0 };
}

/**
 * Streak rules:
 * - pass why today: the streak extends
 * - sincere miss after three tries: the streak holds
 * - unserious flag: the streak breaks
 * - missed days are bridged by freezes when the reader has enough
 * - one freeze is earned every fourteen days of streak
 */
export function applyDayOutcome(
  state: StreakState,
  outcome: DayOutcome,
  date: string,
): StreakState {
  // A day already recorded is never applied twice.
  if (state.lastPassedDate && daysBetween(state.lastPassedDate, date) <= 0) return state;

  if (outcome === "unserious") {
    return { ...state, current: 0, lastPassedDate: date };
  }

  const missedDays = state.lastPassedDate
    ? Math.max(0, daysBetween(state.lastPassedDate, date) - 1)
    : 0;

  let freezesAvailable = state.freezesAvailable;
  let continuous = true;
  if (missedDays > 0) {
    if (freezesAvailable >= missedDays) {
      freezesAvailable -= missedDays;
    } else {
      continuous = false;
    }
  }

  let current: number;
  if (outcome === "passed") {
    current = continuous ? state.current + 1 : 1;
  } else {
    current = continuous ? state.current : 0;
  }

  if (outcome === "passed" && current > 0 && current % FREEZE_EVERY_DAYS === 0) {
    freezesAvailable += 1;
  }

  return {
    current,
    best: Math.max(state.best, current),
    lastPassedDate: date,
    freezesAvailable,
  };
}

/** Days the reader may skip right now without losing the streak. */
export function protectedThrough(state: StreakState): string | null {
  if (!state.lastPassedDate) return null;
  return addDays(state.lastPassedDate, state.freezesAvailable + 1);
}
