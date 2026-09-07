// js/modules/state.js

import { isResetStorageKey } from './storage-policy.js';

// Limitación deliberada: no hay listener de `storage`. Una pantalla ya
// renderizada no reacciona automáticamente a otra pestaña y las escrituras
// concurrentes conservan semántica last-write-wins.

export const App = {
  user: null,
  currentPage: 'home',
  todayLogs: [],
  todayWater: 0,
  diaryLogs: [],
  currentDiaryDate: new Date(),
  currentMealType: 'breakfast',
  selectedFood: null,
  caloriesRingChart: null,
  weightChartInst: null,
  caloriesChartInst: null,
  waterChartInst: null,
  aiImage: null,
  _pendingAIFoods: null,
  aiEditorIndex: 0,
  selectedAIMeal: 'breakfast',
  lastAIInputMode: 'text',
  recognition: null,
};

export const PersistenceCode = Object.freeze({
  READ_FAILED: 'READ_FAILED',
  PARSE_FAILED: 'PARSE_FAILED',
  SERIALIZE_FAILED: 'SERIALIZE_FAILED',
  WRITE_FAILED: 'WRITE_FAILED',
  VERIFY_FAILED: 'VERIFY_FAILED',
  REMOVE_FAILED: 'REMOVE_FAILED',
  COMMIT_FAILED: 'COMMIT_FAILED',
  ROLLBACK_FAILED: 'ROLLBACK_FAILED',
});

export class PersistenceError extends Error {
  constructor(code, message, { key, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'PersistenceError';
    this.code = code;
    if (key !== undefined) this.key = key;
    if (cause !== undefined) this.cause = cause;
  }
}

function storage() {
  return globalThis.localStorage;
}

function physicalKey(key) {
  return `nt_${key}`;
}

function persistenceError(code, message, key, cause) {
  return new PersistenceError(code, message, { key, cause });
}

function readRaw(store, key) {
  try {
    return store.getItem(key);
  } catch (cause) {
    throw persistenceError(PersistenceCode.READ_FAILED, `No se pudo leer la clave "${key}".`, key, cause);
  }
}

function serialize(value, key) {
  let raw;
  try {
    raw = JSON.stringify(value);
  } catch (cause) {
    throw persistenceError(PersistenceCode.SERIALIZE_FAILED, `No se pudo serializar la clave "${key}".`, key, cause);
  }
  if (raw === undefined) {
    throw persistenceError(PersistenceCode.SERIALIZE_FAILED, `La clave "${key}" no admite un valor undefined.`, key);
  }
  return raw;
}

function restoreSnapshot(store, snapshot, originalError) {
  let rollbackCause = null;

  for (const [key, raw] of snapshot) {
    try {
      if (raw === null) store.removeItem(key);
      else store.setItem(key, raw);
    } catch (cause) {
      rollbackCause ||= cause;
    }
  }

  for (const [key, expected] of snapshot) {
    try {
      if (store.getItem(key) !== expected) {
        rollbackCause ||= new Error(`Rollback verification mismatch for ${key}`);
      }
    } catch (cause) {
      rollbackCause ||= cause;
    }
  }

  if (rollbackCause) {
    throw persistenceError(
      PersistenceCode.ROLLBACK_FAILED,
      'No se pudo verificar la recuperación del almacenamiento; su estado es incierto.',
      originalError?.key,
      rollbackCause,
    );
  }
}

function rollbackAndThrow(store, snapshot, error, fallbackCode, fallbackKey) {
  const originalError = error instanceof PersistenceError
    ? error
    : persistenceError(fallbackCode, 'La operación de persistencia falló.', fallbackKey, error);
  restoreSnapshot(store, snapshot, originalError);
  throw originalError;
}

function commitError(error, phaseCode, key) {
  const phaseError = error instanceof PersistenceError
    ? error
    : persistenceError(phaseCode, 'Una fase de la operación multi-clave falló.', key, error);
  return persistenceError(
    PersistenceCode.COMMIT_FAILED,
    'No se pudo completar la operación multi-clave.',
    phaseError.key,
    phaseError,
  );
}

function snapshotKeys(store, keys) {
  const snapshot = new Map();
  for (const key of keys) snapshot.set(key, readRaw(store, key));
  return snapshot;
}

function listStorageKeys(store) {
  const keys = [];
  try {
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (typeof key === 'string') keys.push(key);
    }
  } catch (cause) {
    throw persistenceError(PersistenceCode.READ_FAILED, 'No se pudo enumerar el almacenamiento.', undefined, cause);
  }
  return keys;
}

export const LS = {
  get(key, fallback = null) {
    const fullKey = physicalKey(key);
    const raw = readRaw(storage(), fullKey);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (cause) {
      throw persistenceError(PersistenceCode.PARSE_FAILED, `Los datos de "${fullKey}" están dañados.`, fullKey, cause);
    }
  },

  set(key, value) {
    const store = storage();
    const fullKey = physicalKey(key);
    const snapshot = snapshotKeys(store, [fullKey]);
    const expected = serialize(value, fullKey);

    try {
      store.setItem(fullKey, expected);
    } catch (error) {
      rollbackAndThrow(store, snapshot, error, PersistenceCode.WRITE_FAILED, fullKey);
    }

    try {
      if (store.getItem(fullKey) !== expected) {
        throw persistenceError(PersistenceCode.VERIFY_FAILED, `No se pudo verificar la escritura de "${fullKey}".`, fullKey);
      }
    } catch (error) {
      const verificationError = error instanceof PersistenceError
        ? error
        : persistenceError(PersistenceCode.VERIFY_FAILED, `No se pudo verificar la escritura de "${fullKey}".`, fullKey, error);
      rollbackAndThrow(store, snapshot, verificationError, PersistenceCode.VERIFY_FAILED, fullKey);
    }
    return true;
  },

  remove(key) {
    const store = storage();
    const fullKey = physicalKey(key);
    const snapshot = snapshotKeys(store, [fullKey]);

    try {
      store.removeItem(fullKey);
    } catch (error) {
      rollbackAndThrow(store, snapshot, error, PersistenceCode.REMOVE_FAILED, fullKey);
    }

    try {
      if (store.getItem(fullKey) !== null) {
        throw persistenceError(PersistenceCode.VERIFY_FAILED, `No se pudo verificar la eliminación de "${fullKey}".`, fullKey);
      }
    } catch (error) {
      const verificationError = error instanceof PersistenceError
        ? error
        : persistenceError(PersistenceCode.VERIFY_FAILED, `No se pudo verificar la eliminación de "${fullKey}".`, fullKey, error);
      rollbackAndThrow(store, snapshot, verificationError, PersistenceCode.VERIFY_FAILED, fullKey);
    }
    return true;
  },

  setMany(values, { remove = [] } = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw persistenceError(PersistenceCode.SERIALIZE_FAILED, 'setMany requiere un objeto de claves y valores.');
    }

    if (!Array.isArray(remove)) {
      throw persistenceError(PersistenceCode.SERIALIZE_FAILED, 'La lista de eliminaciones de setMany no es válida.');
    }
    const store = storage();
    const entries = Object.entries(values).map(([key, value]) => [physicalKey(key), value]);
    const removeKeys = remove.map(physicalKey);
    const affectedKeys = [...new Set([...entries.map(([key]) => key), ...removeKeys])];
    const snapshot = snapshotKeys(store, affectedKeys);
    const serialized = entries.map(([key, value]) => [key, serialize(value, key)]);
    if (serialized.length === 0 && removeKeys.length === 0) return true;

    try {
      for (const [key, raw] of serialized) store.setItem(key, raw);
    } catch (error) {
      rollbackAndThrow(store, snapshot, commitError(error, PersistenceCode.WRITE_FAILED), PersistenceCode.COMMIT_FAILED);
    }

    try {
      for (const key of removeKeys) store.removeItem(key);
    } catch (error) {
      rollbackAndThrow(store, snapshot, commitError(error, PersistenceCode.REMOVE_FAILED), PersistenceCode.COMMIT_FAILED);
    }

    try {
      for (const [key, expected] of serialized) {
        if (store.getItem(key) !== expected) {
          throw persistenceError(PersistenceCode.VERIFY_FAILED, `No se pudo verificar la escritura de "${key}".`, key);
        }
      }
      for (const key of removeKeys) {
        if (store.getItem(key) !== null) {
          throw persistenceError(PersistenceCode.VERIFY_FAILED, `No se pudo verificar la eliminación de "${key}".`, key);
        }
      }
    } catch (error) {
      const verificationError = error instanceof PersistenceError
        ? error
        : persistenceError(PersistenceCode.VERIFY_FAILED, 'No se pudo verificar la operación multi-clave.', undefined, error);
      rollbackAndThrow(store, snapshot, commitError(verificationError, PersistenceCode.VERIFY_FAILED), PersistenceCode.COMMIT_FAILED);
    }
    return true;
  },

  clearManaged({ includeSensitive = true } = {}) {
    const store = storage();
    const keys = listStorageKeys(store).filter((key) => isResetStorageKey(key, { includeSensitive }));
    const snapshot = snapshotKeys(store, keys);
    if (keys.length === 0) return true;

    try {
      for (const key of keys) store.removeItem(key);
    } catch (error) {
      rollbackAndThrow(store, snapshot, error, PersistenceCode.REMOVE_FAILED);
    }

    try {
      for (const key of keys) {
        if (store.getItem(key) !== null) {
          throw persistenceError(PersistenceCode.VERIFY_FAILED, `No se pudo verificar la eliminación de "${key}".`, key);
        }
      }
    } catch (error) {
      const verificationError = error instanceof PersistenceError
        ? error
        : persistenceError(PersistenceCode.VERIFY_FAILED, 'No se pudo verificar el reset del almacenamiento.', undefined, error);
      rollbackAndThrow(store, snapshot, verificationError, PersistenceCode.COMMIT_FAILED);
    }
    return true;
  },

  setUser(user) {
    return this.set('user', user);
  },

  getUser() {
    return this.get('user', null);
  },

  normalizeUser(user) {
    return {
      ...user,
      daily_calories: user.daily_calories || 2000,
      protein_goal: user.protein_goal || 120,
      carbs_goal: user.carbs_goal || 250,
      fat_goal: user.fat_goal || 70,
      water_goal: user.water_goal || 8,
    };
  },
};
