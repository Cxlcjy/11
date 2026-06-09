import type { TrackerState } from "../types";
import { clampNumber } from "./date";
import { isValidRecord, normalizeDayNotes, normalizeRecord, sortRecords } from "./period";

export const STORAGE_KEY = "periodTrackerSingleFileApp";

export const defaultState: TrackerState = {
  records: [],
  dayNotes: {},
  settings: {
    cycleLength: 28,
    darkMode: false
  }
};

export function loadState(storage: Storage = localStorage): TrackerState {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!saved) return defaultState;

    return {
      records: Array.isArray(saved.records)
        ? sortRecords(saved.records.filter(isValidRecord).map(normalizeRecord))
        : [],
      dayNotes: normalizeDayNotes(saved.dayNotes),
      settings: {
        cycleLength: clampNumber(saved.settings?.cycleLength, 15, 60, 28),
        darkMode: Boolean(saved.settings?.darkMode)
      }
    };
  } catch {
    return defaultState;
  }
}

export function saveState(state: TrackerState, storage: Storage = localStorage): void {
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      records: sortRecords(state.records),
      dayNotes: state.dayNotes,
      settings: state.settings
    })
  );
}
