/*
 * NutriTracks backup boundary.
 *
 * localStorage values are JSON strings. This module deliberately validates
 * both layers before exposing a prepared map that can be committed.
 */

import { isBackupStorageKey } from './storage-policy.js';
import {
  ACTIVITY_LEVELS,
  AI_INPUT_MODES,
  FOOD_SOURCES,
  GENDERS,
  GOALS,
  MEAL_TYPES,
  isValidDateString,
  parseUserNumber,
} from './validation.js';

export const BACKUP_LIMITS = Object.freeze({
  maxTextLength: 10 * 1024 * 1024,
  maxKeys: 5000,
  maxLogsPerDay: 500,
  maxWeightLogs: 5000,
  maxFavorites: 500,
  maxCacheEntries: 200,
  maxCachedFoods: 100,
  maxStringLength: 500,
  // La identidad v2 antepone versión y estrategia al input completo (máx. 500).
  maxCacheKeyLength: 600,
});

const FIXED_KEYS = new Set([
  'nt_user',
  'nt_weight_logs',
  'nt_favorites',
  'nt_dark_mode',
  'nt_ai_cache',
  'nt_last_active_date',
]);
const LEGACY_KEYS = new Set(['nt_nt_favorites', 'nutritrack_dark_mode']);
const IGNORED_LEGACY_KEYS = new Set(['nt_ai_config']);
const DYNAMIC_KEYS = [
  { pattern: /^nt_food_logs_(\d{4}-\d{2}-\d{2})$/, kind: 'foodLogs' },
  { pattern: /^nt_water_(\d{4}-\d{2}-\d{2})$/, kind: 'water' },
];
const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype', 'hasOwnProperty']);
const USER_FIELDS = [
  'id', 'name', 'gender', 'age', 'weight', 'initial_weight', 'height',
  'activity_level', 'goal', 'bmr', 'daily_calories', 'protein_goal',
  'carbs_goal', 'fat_goal', 'water_goal',
];
const FOOD_FIELDS = [
  'id', 'user_id', 'date', 'meal_type', 'food_name', 'quantity', 'calories',
  'protein', 'carbs', 'fat', 'fiber', 'sugar', 'source', 'ai_input_mode',
];
const FAVORITE_FIELDS = [
  'id', 'food_name', 'quantity', 'calories', 'protein', 'carbs', 'fat',
  'fiber', 'sugar', 'source', 'ai_input_mode', 'savedAt',
];
const AI_FOOD_FIELDS = [
  'alimento', 'cantidad_estimada', 'gramos_estimados', 'kcal',
  'proteinas', 'carbohidratos', 'grasas',
];

export class BackupError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'BackupError';
    this.code = code;
  }
}

function fail(message, code = 'BACKUP_INVALID', cause) {
  throw new BackupError(code, message, cause);
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownKeys(value, path) {
  if (!isRecord(value)) fail(`${path} debe ser un objeto.`);
  const keys = Object.keys(value);
  for (const key of keys) {
    if (FORBIDDEN_PROPERTIES.has(key)) fail(`${path} contiene la propiedad no permitida "${key}".`);
  }
  return keys;
}

function exactFields(value, allowed, path, required = allowed) {
  const keys = ownKeys(value, path);
  const allowedSet = new Set(allowed);
  for (const key of keys) {
    if (!allowedSet.has(key)) fail(`${path} contiene el campo desconocido "${key}".`);
  }
  const present = new Set(keys);
  for (const key of required) {
    if (!present.has(key)) fail(`${path} no contiene el campo obligatorio "${key}".`);
  }
}

function stringValue(value, path, { min = 0, max = BACKUP_LIMITS.maxStringLength } = {}) {
  if (typeof value !== 'string') fail(`${path} debe ser un string.`);
  if (value.length < min || value.length > max) fail(`${path} excede los límites permitidos.`);
  return value;
}

function numberValue(value, path, { min = 0, max = 1_000_000, integer = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path} debe ser un número finito.`);
  if (integer && !Number.isInteger(value)) fail(`${path} debe ser un entero.`);
  if (value < min || value > max) fail(`${path} está fuera del rango permitido.`);
  return value;
}

function enumValue(value, values, path) {
  stringValue(value, path, { min: 1, max: 50 });
  if (!values.includes(value)) fail(`${path} contiene un valor no permitido.`);
  return value;
}

function validDate(value, path) {
  stringValue(value, path, { min: 10, max: 10 });
  if (!isValidDateString(value)) fail(`${path} debe ser una fecha real YYYY-MM-DD.`);
  return value;
}

function validateUser(user) {
  const keys = ownKeys(user, 'nt_user');
  const allowed = new Set(USER_FIELDS);
  for (const key of keys) {
    if (!allowed.has(key)) fail(`nt_user contiene el campo desconocido "${key}".`);
  }
  const required = USER_FIELDS.filter((field) => field !== 'initial_weight');
  const present = new Set(keys);
  for (const key of required) {
    if (!present.has(key)) fail(`nt_user no contiene el campo obligatorio "${key}".`);
  }

  stringValue(user.id, 'nt_user.id', { min: 1, max: 200 });
  stringValue(user.name, 'nt_user.name', { min: 1, max: 200 });
  enumValue(user.gender, GENDERS, 'nt_user.gender');
  numberValue(user.age, 'nt_user.age', { min: 12, max: 100 });
  numberValue(user.weight, 'nt_user.weight', { min: 20, max: 300 });
  if (present.has('initial_weight')) numberValue(user.initial_weight, 'nt_user.initial_weight', { min: 20, max: 300 });
  numberValue(user.height, 'nt_user.height', { min: 100, max: 250 });
  enumValue(user.activity_level, ACTIVITY_LEVELS, 'nt_user.activity_level');
  enumValue(user.goal, GOALS, 'nt_user.goal');
  numberValue(user.bmr, 'nt_user.bmr', { min: 0, max: 10_000 });
  numberValue(user.daily_calories, 'nt_user.daily_calories', { min: 0, max: 20_000 });
  numberValue(user.protein_goal, 'nt_user.protein_goal', { min: 0, max: 2_000 });
  numberValue(user.carbs_goal, 'nt_user.carbs_goal', { min: 0, max: 5_000 });
  numberValue(user.fat_goal, 'nt_user.fat_goal', { min: 0, max: 2_000 });
  numberValue(user.water_goal, 'nt_user.water_goal', { min: 1, max: 100, integer: true });

  const normalized = Object.assign(Object.create(null), user);
  if (!present.has('initial_weight')) normalized.initial_weight = user.weight;
  return normalized;
}

function validateHistoricalFoodNumber(value, path, { nullable = false } = {}) {
  if (nullable && value === null) return value;
  const parsed = parseUserNumber(value);
  if (parsed === null || parsed < 0 || parsed > 1_000_000) fail(`${path} debe ser un número histórico completo dentro del rango permitido.`);
  return value;
}

function validateFoodLog(log, index, keyDate) {
  const path = `registro ${index} de ${keyDate}`;
  exactFields(log, FOOD_FIELDS, path, FOOD_FIELDS.filter((field) => field !== 'ai_input_mode'));
  stringValue(log.id, `${path}.id`, { min: 1, max: 200 });
  stringValue(log.user_id, `${path}.user_id`, { min: 1, max: 200 });
  validDate(log.date, `${path}.date`);
  if (log.date !== keyDate) fail(`${path}.date no coincide con la fecha de su clave.`);
  enumValue(log.meal_type, MEAL_TYPES, `${path}.meal_type`);
  stringValue(log.food_name, `${path}.food_name`, { min: 1, max: 300 });
  if (log.quantity === null) {
    if (log.source !== 'manual' || parseUserNumber(log.calories) <= 0 || !['protein', 'carbs', 'fat', 'fiber', 'sugar'].every(field => parseUserNumber(log[field]) === 0)) {
      fail(`${path}.quantity null sólo es válida para Quick Add manual.`);
    }
  } else {
    validateHistoricalFoodNumber(log.quantity, `${path}.quantity`);
  }
  for (const field of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar']) {
    validateHistoricalFoodNumber(log[field], `${path}.${field}`, { nullable: log.quantity !== null });
  }
  enumValue(log.source, FOOD_SOURCES, `${path}.source`);
  if (Object.keys(log).includes('ai_input_mode')) {
    enumValue(log.ai_input_mode, AI_INPUT_MODES, `${path}.ai_input_mode`);
    if (log.source === 'ai_label' && log.ai_input_mode !== 'image') fail(`${path}.ai_input_mode debe ser image para ai_label.`);
  } else if (log.source === 'ai_label') {
    fail(`${path}.ai_input_mode es obligatorio para ai_label.`);
  }
}

function validateFoodLogs(value, keyDate) {
  if (!Array.isArray(value)) fail(`nt_food_logs_${keyDate} debe ser un array.`);
  if (value.length > BACKUP_LIMITS.maxLogsPerDay) fail(`nt_food_logs_${keyDate} excede el máximo de registros.`);
  value.forEach((log, index) => validateFoodLog(log, index, keyDate));
  return value;
}

function validateWeightLogs(value) {
  if (!Array.isArray(value)) fail('nt_weight_logs debe ser un array.');
  if (value.length > BACKUP_LIMITS.maxWeightLogs) fail('nt_weight_logs excede el máximo de registros.');
  value.forEach((log, index) => {
    const path = `nt_weight_logs[${index}]`;
    exactFields(log, ['date', 'weight'], path);
    validDate(log.date, `${path}.date`);
    numberValue(log.weight, `${path}.weight`, { min: 20, max: 300 });
  });
  return value;
}

function validateFavorite(favorite, index) {
  const path = `nt_favorites[${index}]`;
  exactFields(favorite, FAVORITE_FIELDS, path, FAVORITE_FIELDS.filter(field => field !== 'ai_input_mode'));
  stringValue(favorite.id, `${path}.id`, { min: 1, max: 200 });
  stringValue(favorite.food_name, `${path}.food_name`, { min: 1, max: 300 });
  for (const field of ['quantity', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar']) {
    validateHistoricalFoodNumber(favorite[field], `${path}.${field}`, { nullable: field !== 'quantity' });
  }
  enumValue(favorite.source, FOOD_SOURCES, `${path}.source`);
  if (Object.hasOwn(favorite, 'ai_input_mode')) {
    enumValue(favorite.ai_input_mode, AI_INPUT_MODES, `${path}.ai_input_mode`);
    if (favorite.source === 'ai_label' && favorite.ai_input_mode !== 'image') fail(`${path}.ai_input_mode debe ser image para ai_label.`);
  } else if (favorite.source === 'ai_label') {
    fail(`${path}.ai_input_mode es obligatorio para ai_label.`);
  }
  numberValue(favorite.savedAt, `${path}.savedAt`, { min: 0, max: 8_640_000_000_000_000 });
}

function validateFavorites(value) {
  if (!Array.isArray(value)) fail('nt_favorites debe ser un array.');
  if (value.length > BACKUP_LIMITS.maxFavorites) fail('nt_favorites excede el máximo permitido.');
  value.forEach(validateFavorite);
  return value;
}

function validateAIFood(food, path) {
  exactFields(food, AI_FOOD_FIELDS, path);
  stringValue(food.alimento, `${path}.alimento`, { min: 1, max: 300 });
  stringValue(food.cantidad_estimada, `${path}.cantidad_estimada`, { min: 1, max: 200 });
  for (const field of ['gramos_estimados', 'kcal', 'proteinas', 'carbohidratos', 'grasas']) {
    validateHistoricalFoodNumber(food[field], `${path}.${field}`, { nullable: true });
  }
}

function validateAICache(value) {
  const cacheKeys = ownKeys(value, 'nt_ai_cache');
  if (cacheKeys.length > BACKUP_LIMITS.maxCacheEntries) fail('nt_ai_cache excede el máximo de entradas.');
  for (const cacheKey of cacheKeys) {
    stringValue(cacheKey, 'clave de nt_ai_cache', { min: 1, max: BACKUP_LIMITS.maxCacheKeyLength });
    const path = `nt_ai_cache[${JSON.stringify(cacheKey)}]`;
    const entry = value[cacheKey];
    exactFields(entry, ['result', 'ts', 'mode'], path);
    numberValue(entry.ts, `${path}.ts`, { min: 0, max: 8_640_000_000_000_000 });
    enumValue(entry.mode, ['ai', 'offline', 'hybrid'], `${path}.mode`);
    exactFields(entry.result, ['alimentos'], `${path}.result`);
    if (!Array.isArray(entry.result.alimentos)) fail(`${path}.result.alimentos debe ser un array.`);
    if (entry.result.alimentos.length > BACKUP_LIMITS.maxCachedFoods) fail(`${path}.result.alimentos excede el máximo permitido.`);
    entry.result.alimentos.forEach((food, index) => validateAIFood(food, `${path}.result.alimentos[${index}]`));
  }
  return value;
}

function validateIgnoredAIConfig(value) {
  exactFields(value, ['apiKey', 'provider'], 'nt_ai_config');
  stringValue(value.apiKey, 'nt_ai_config.apiKey', { min: 1, max: 1000 });
  enumValue(value.provider, ['gemini', 'openai'], 'nt_ai_config.provider');
}

function classifyKey(key) {
  if (FIXED_KEYS.has(key)) return { kind: key };
  if (LEGACY_KEYS.has(key)) return { kind: key };
  if (IGNORED_LEGACY_KEYS.has(key)) return { kind: key };
  for (const descriptor of DYNAMIC_KEYS) {
    const match = descriptor.pattern.exec(key);
    if (match) return { kind: descriptor.kind, date: match[1] };
  }
  return null;
}

// Nombre conservado por compatibilidad pública con la suite de backups.
export const isManagedStorageKey = isBackupStorageKey;

function parseInner(rawValue, key) {
  if (typeof rawValue !== 'string') fail(`El valor exterior de "${key}" debe ser un string.`);
  if (rawValue.length > BACKUP_LIMITS.maxTextLength) fail(`El valor de "${key}" excede el tamaño máximo.`);
  try {
    return JSON.parse(rawValue);
  } catch (error) {
    fail(`El JSON interno de "${key}" no es válido.`, 'BACKUP_INVALID', error);
  }
}

function validateByKind(kind, value, date) {
  switch (kind) {
    case 'nt_user': return validateUser(value);
    case 'nt_weight_logs': return validateWeightLogs(value);
    case 'nt_favorites':
    case 'nt_nt_favorites': return validateFavorites(value);
    case 'nt_dark_mode':
    case 'nutritrack_dark_mode':
      if (typeof value !== 'boolean') fail(`${kind} debe ser un booleano.`);
      return value;
    case 'nt_ai_cache': return validateAICache(value);
    case 'nt_last_active_date': return validDate(value, 'nt_last_active_date');
    case 'foodLogs':
      validDate(date, 'fecha de la clave de comidas');
      return validateFoodLogs(value, date);
    case 'water':
      validDate(date, 'fecha de la clave de agua');
      return numberValue(value, `nt_water_${date}`, { min: 0, max: 1000, integer: true });
    case 'nt_ai_config':
      validateIgnoredAIConfig(value);
      return undefined;
    default: fail('Tipo de clave de respaldo desconocido.');
  }
}

export function prepareBackupObject(backup) {
  const keys = ownKeys(backup, 'El respaldo');
  if (keys.length > BACKUP_LIMITS.maxKeys) fail('El respaldo contiene demasiadas claves.');
  if (!keys.includes('nt_user')) fail('El respaldo no contiene la clave obligatoria "nt_user".');
  if (keys.includes('nt_favorites') && keys.includes('nt_nt_favorites')) {
    fail('El respaldo contiene simultáneamente nt_favorites y su alias nt_nt_favorites.');
  }
  if (keys.includes('nt_dark_mode') && keys.includes('nutritrack_dark_mode')) {
    fail('El respaldo contiene simultáneamente nt_dark_mode y su alias nutritrack_dark_mode.');
  }

  const prepared = Object.create(null);
  for (const key of keys) {
    const descriptor = classifyKey(key);
    if (!descriptor) fail(`El respaldo contiene la clave desconocida "${key}".`);
    const parsed = parseInner(backup[key], key);
    const normalized = validateByKind(descriptor.kind, parsed, descriptor.date);
    if (descriptor.kind === 'nt_ai_config') continue;
    const finalKey = descriptor.kind === 'nt_nt_favorites'
      ? 'nt_favorites'
      : descriptor.kind === 'nutritrack_dark_mode'
        ? 'nt_dark_mode'
        : key;
    prepared[finalKey] = JSON.stringify(normalized);
  }
  return prepared;
}

export function parseAndPrepareBackup(text) {
  if (typeof text !== 'string') fail('El contenido del respaldo debe ser texto.');
  if (text.length > BACKUP_LIMITS.maxTextLength) fail('El archivo de respaldo excede el tamaño máximo.');
  let backup;
  try {
    backup = JSON.parse(text);
  } catch (error) {
    fail('El JSON exterior del respaldo no es válido.', 'BACKUP_INVALID', error);
  }
  return prepareBackupObject(backup);
}

function listStorageKeys(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string') keys.push(key);
  }
  return keys;
}

export function createFilteredBackup(storage) {
  const candidate = Object.create(null);
  for (const key of listStorageKeys(storage)) {
    if (!isManagedStorageKey(key)) continue;
    candidate[key] = storage.getItem(key);
  }
  return prepareBackupObject(candidate);
}

export function serializeFilteredBackup(storage, spacing = 2) {
  return JSON.stringify(createFilteredBackup(storage), null, spacing);
}

export function snapshotManagedStorage(storage) {
  const snapshot = Object.create(null);
  for (const key of listStorageKeys(storage)) {
    if (isManagedStorageKey(key)) snapshot[key] = storage.getItem(key);
  }
  return snapshot;
}

function verifyValue(storage, key, expected, phase) {
  let actual;
  try {
    actual = storage.getItem(key);
  } catch (error) {
    fail(`No se pudo verificar "${key}" durante ${phase}.`, 'BACKUP_COMMIT_FAILED', error);
  }
  if (actual !== expected) fail(`La verificación de "${key}" falló durante ${phase}.`, 'BACKUP_COMMIT_FAILED');
}

function rollback(storage, snapshot, affectedKeys, preservedAIConfig) {
  const errors = [];
  const keys = [...affectedKeys].sort();
  for (const key of keys) {
    try { storage.removeItem(key); } catch (error) { errors.push(error); }
  }
  for (const key of Object.keys(snapshot).sort()) {
    try { storage.setItem(key, snapshot[key]); } catch (error) { errors.push(error); }
  }
  for (const key of keys) {
    try {
      const expected = Object.prototype.hasOwnProperty.call(snapshot, key) ? snapshot[key] : null;
      if (storage.getItem(key) !== expected) errors.push(new Error(`Rollback incorrecto para ${key}`));
    } catch (error) { errors.push(error); }
  }
  try {
    if (storage.getItem('nt_ai_config') !== preservedAIConfig) errors.push(new Error('nt_ai_config cambió durante el rollback'));
  } catch (error) { errors.push(error); }
  if (errors.length) fail('El rollback no pudo verificarse; el almacenamiento puede requerir recuperación manual.', 'BACKUP_ROLLBACK_FAILED', errors[0]);
}

export function commitPreparedBackup(storage, prepared) {
  const preparedKeys = Object.keys(prepared).sort();
  const snapshot = snapshotManagedStorage(storage);
  const snapshotKeys = Object.keys(snapshot);
  const affectedKeys = new Set([...snapshotKeys, ...preparedKeys]);
  let preservedAIConfig;
  try {
    preservedAIConfig = storage.getItem('nt_ai_config');
  } catch (error) {
    fail('No se pudo leer la configuración local de IA antes de restaurar.', 'BACKUP_STORAGE_READ_FAILED', error);
  }

  try {
    for (const key of preparedKeys) {
      storage.setItem(key, prepared[key]);
      verifyValue(storage, key, prepared[key], 'la escritura');
    }
    for (const key of snapshotKeys.sort()) {
      if (Object.prototype.hasOwnProperty.call(prepared, key)) continue;
      storage.removeItem(key);
      verifyValue(storage, key, null, 'la eliminación');
    }
    for (const key of preparedKeys) verifyValue(storage, key, prepared[key], 'la verificación final');
    for (const key of snapshotKeys) {
      if (!Object.prototype.hasOwnProperty.call(prepared, key)) verifyValue(storage, key, null, 'la verificación final');
    }
    verifyValue(storage, 'nt_ai_config', preservedAIConfig, 'la preservación de la configuración de IA');
  } catch (error) {
    try {
      rollback(storage, snapshot, affectedKeys, preservedAIConfig);
    } catch (rollbackError) {
      if (rollbackError instanceof BackupError && rollbackError.code === 'BACKUP_ROLLBACK_FAILED') throw rollbackError;
      fail('El rollback falló de forma crítica.', 'BACKUP_ROLLBACK_FAILED', rollbackError);
    }
    if (error instanceof BackupError) throw error;
    fail('La restauración falló y se revirtió por completo.', 'BACKUP_COMMIT_FAILED', error);
  }

  return { written: preparedKeys.length, removed: snapshotKeys.filter((key) => !Object.prototype.hasOwnProperty.call(prepared, key)).length };
}

export function restoreBackupText(storage, text) {
  const prepared = parseAndPrepareBackup(text);
  return commitPreparedBackup(storage, prepared);
}
