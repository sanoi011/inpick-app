import type { ExpoBoothScene } from "@/lib/expo/scene";

/**
 * BoothScene undo/redo 히스토리 (Phase 2). 순수 함수 — React reducer에서
 * 그대로 사용한다. 새 변경이 들어오면 redo 분기(future)는 절단된다.
 */

export const EXPO_HISTORY_LIMIT = 50;

export interface ExpoSceneHistory {
  past: ExpoBoothScene[];
  present: ExpoBoothScene | null;
  future: ExpoBoothScene[];
}

export function createSceneHistory(
  scene: ExpoBoothScene | null = null,
): ExpoSceneHistory {
  return { past: [], present: scene, future: [] };
}

/** draft 복구/새 footprint 등 — 히스토리를 버리고 현재만 교체한다. */
export function resetSceneHistory(
  _history: ExpoSceneHistory,
  scene: ExpoBoothScene | null,
): ExpoSceneHistory {
  return createSceneHistory(scene);
}

export function applySceneChange(
  history: ExpoSceneHistory,
  next: ExpoBoothScene,
): ExpoSceneHistory {
  if (history.present === next) return history;
  if (history.present === null) {
    return { past: [], present: next, future: [] };
  }
  return {
    past: [...history.past, history.present].slice(-EXPO_HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function undoScene(history: ExpoSceneHistory): ExpoSceneHistory {
  if (history.past.length === 0 || history.present === null) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoScene(history: ExpoSceneHistory): ExpoSceneHistory {
  if (history.future.length === 0 || history.present === null) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present].slice(-EXPO_HISTORY_LIMIT),
    present: next,
    future: rest,
  };
}

export function canUndoScene(history: ExpoSceneHistory): boolean {
  return history.past.length > 0 && history.present !== null;
}

export function canRedoScene(history: ExpoSceneHistory): boolean {
  return history.future.length > 0 && history.present !== null;
}
