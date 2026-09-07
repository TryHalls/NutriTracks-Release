// Política canónica de claves de NutriTracks.
// Las claves sensibles son propiedad de la app, pero no forman parte del backup.

const NORMAL_KEYS = new Set([
  'nt_user',
  'nt_weight_logs',
  'nt_favorites',
  'nt_dark_mode',
  'nt_ai_cache',
  'nt_last_active_date',
]);

const LEGACY_KEYS = new Set([
  'nt_nt_favorites',
  'nutritrack_dark_mode',
]);

const SENSITIVE_KEYS = new Set(['nt_ai_config']);

const DYNAMIC_PATTERNS = [
  /^nt_food_logs_\d{4}-\d{2}-\d{2}$/,
  /^nt_water_\d{4}-\d{2}-\d{2}$/,
];

function matchesDynamicKey(key) {
  return DYNAMIC_PATTERNS.some((pattern) => pattern.test(key));
}

export function isOwnedStorageKey(key) {
  return typeof key === 'string' && (
    NORMAL_KEYS.has(key) ||
    LEGACY_KEYS.has(key) ||
    SENSITIVE_KEYS.has(key) ||
    matchesDynamicKey(key)
  );
}

export function isBackupStorageKey(key) {
  return typeof key === 'string' && (
    NORMAL_KEYS.has(key) ||
    LEGACY_KEYS.has(key) ||
    matchesDynamicKey(key)
  );
}

export function isResetStorageKey(key, { includeSensitive = true } = {}) {
  return isBackupStorageKey(key) || (includeSensitive && SENSITIVE_KEYS.has(key));
}

export const STORAGE_POLICY = Object.freeze({
  normal: Object.freeze([...NORMAL_KEYS]),
  legacy: Object.freeze([...LEGACY_KEYS]),
  sensitive: Object.freeze([...SENSITIVE_KEYS]),
  dynamic: Object.freeze(DYNAMIC_PATTERNS.map((pattern) => pattern.source)),
});
