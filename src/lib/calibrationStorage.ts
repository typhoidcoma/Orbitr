import {
  createDefaultViewerState,
  type PersistedViewerState,
  type ModelTransform,
  type ParallaxCalibration,
} from "./parallaxConfig";

const STORAGE_KEY = "orbitr.viewerState.v1";
const memoryStorage = new Map<string, string>();

interface StorageEnvelope {
  version: 1;
  state: PersistedViewerState;
}

export function loadViewerState(): PersistedViewerState {
  const defaults = createDefaultViewerState();
  const storage = getStorage();

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<StorageEnvelope>;
    if (parsed.version !== 1 || !parsed.state) {
      return defaults;
    }

    return {
      calibration: {
        ...defaults.calibration,
        ...parsed.state.calibration,
      },
      modelTransform: {
        ...defaults.modelTransform,
        ...parsed.state.modelTransform,
      },
    };
  } catch {
    return defaults;
  }
}

export function saveViewerState(
  calibration: ParallaxCalibration,
  modelTransform: ModelTransform
): void {
  const storage = getStorage();
  const envelope: StorageEnvelope = {
    version: 1,
    state: {
      calibration,
      modelTransform,
    },
  };

  storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

export function resetViewerState(): PersistedViewerState {
  getStorage().removeItem(STORAGE_KEY);
  return createDefaultViewerState();
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getStorage(): StorageLike {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  return {
    getItem(key) {
      return memoryStorage.get(key) ?? null;
    },
    setItem(key, value) {
      memoryStorage.set(key, value);
    },
    removeItem(key) {
      memoryStorage.delete(key);
    },
  };
}
