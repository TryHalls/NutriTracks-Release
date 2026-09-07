import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BACKUP_LIMITS,
  BackupError,
  commitPreparedBackup,
  createFilteredBackup,
  parseAndPrepareBackup,
  restoreBackupText,
  serializeFilteredBackup,
} from '../www/js/modules/backup.js';

class MemoryStorage {
  constructor(initial = {}, behavior = {}) {
    this.data = new Map(Object.entries(initial));
    this.behavior = behavior;
    this.mutations = [];
    this.mutationCount = 0;
    this.getCount = 0;
    this.mutationStarted = false;
  }

  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }

  getItem(key) {
    this.getCount += 1;
    if (this.behavior.failReadsAfterMutation && this.mutationStarted) {
      if (this.behavior.persistentReadFailure || !this.behavior.readFailed) {
        this.behavior.readFailed = true;
        throw new Error('simulated read failure');
      }
    }
    if (this.behavior.wrongReadAfterMutation && this.mutationStarted && !this.behavior.wrongReadDone) {
      this.behavior.wrongReadDone = true;
      return '__wrong__';
    }
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.#mutate('set', key);
    this.data.set(key, String(value));
  }

  removeItem(key) {
    this.#mutate('remove', key);
    this.data.delete(key);
  }

  #mutate(type, key) {
    this.mutationStarted = true;
    this.mutationCount += 1;
    this.mutations.push([type, key]);
    const failAt = this.behavior.failMutationAt;
    if (
      (this.behavior.persistentMutationFailure && this.mutationCount >= failAt) ||
      (!this.behavior.mutationFailed && this.mutationCount === failAt)
    ) {
      this.behavior.mutationFailed = true;
      throw new Error(`simulated ${type} failure`);
    }
  }

  dump() { return Object.fromEntries(this.data); }
}

const user = {
  id: 'user-1',
  name: 'Ada',
  gender: 'female',
  age: 34,
  weight: 64.5,
  initial_weight: 67,
  height: 168,
  activity_level: 'moderate',
  goal: 'maintain',
  bmr: 1450,
  daily_calories: 2100,
  protein_goal: 150,
  carbs_goal: 230,
  fat_goal: 65,
  water_goal: 8,
};

const food = {
  id: 'food-1',
  user_id: 'user-1',
  date: '2026-09-07',
  meal_type: 'lunch',
  food_name: 'Arroz',
  quantity: 150,
  calories: 195,
  protein: 4,
  carbs: 42,
  fat: 0.5,
  fiber: 1,
  sugar: 0.2,
  source: 'local',
};

const favorite = {
  id: 'fav-1',
  food_name: 'Yogur',
  quantity: 125,
  calories: 90,
  protein: 5,
  carbs: 10,
  fat: 3,
  fiber: 0,
  sugar: 8,
  source: 'manual',
  savedAt: 1_725_000_000_000,
};

const cachedFood = {
  alimento: 'Manzana',
  cantidad_estimada: '1 unidad',
  gramos_estimados: 180,
  kcal: 95,
  proteinas: 0.5,
  carbohidratos: 25,
  grasas: 0.3,
};

function raw(value) { return JSON.stringify(value); }

function validBackup(extra = {}) {
  return {
    nt_user: raw(user),
    nt_weight_logs: raw([
      { date: '2026-09-06', weight: 65 },
      { date: '2026-09-07', weight: 64.5 },
    ]),
    nt_favorites: raw([favorite]),
    nt_dark_mode: raw(true),
    nt_ai_cache: raw({
      manzana: { result: { alimentos: [cachedFood] }, ts: 1_725_000_000_000, mode: 'offline' },
    }),
    nt_last_active_date: raw('2026-09-07'),
    'nt_food_logs_2026-09-07': raw([food]),
    'nt_food_logs_2026-09-06': raw([{ ...food, id: 'food-2', date: '2026-09-06', meal_type: 'dinner' }]),
    'nt_water_2026-09-07': raw(7),
    'nt_water_2026-09-06': raw(8),
    ...extra,
  };
}

function asText(value) { return JSON.stringify(value); }

function assertInvalidWithoutMutation(textOrObject) {
  const storage = new MemoryStorage({ nt_user: raw(user), foreign: 'keep' });
  assert.throws(
    () => restoreBackupText(storage, typeof textOrObject === 'string' ? textOrObject : asText(textOrObject)),
    (error) => error instanceof BackupError && error.code === 'BACKUP_INVALID',
  );
  assert.equal(storage.mutations.length, 0);
}

test('roundtrip export/import includes all supported data and filters foreign/sensitive keys', () => {
  const sourceData = {
    ...validBackup(),
    nt_ai_config: raw({ apiKey: 'secret', provider: 'gemini' }),
    'nt_unknown_component': raw({ artifact: true }),
    analytics_widget: 'foreign',
  };
  const source = new MemoryStorage(sourceData);
  const exported = serializeFilteredBackup(source);
  const exportedObject = JSON.parse(exported);

  assert.deepEqual(Object.keys(exportedObject).sort(), Object.keys(validBackup()).sort());
  assert.equal(Object.hasOwn(exportedObject, 'nt_ai_config'), false);
  assert.equal(Object.hasOwn(exportedObject, 'nt_unknown_component'), false);
  assert.equal(Object.hasOwn(exportedObject, 'analytics_widget'), false);

  const destination = new MemoryStorage({
    nt_user: raw({ ...user, name: 'Antes' }),
    nt_dark_mode: raw(false),
    'nt_water_2020-01-01': raw(2),
    nt_ai_config: raw({ apiKey: 'local-secret', provider: 'gemini' }),
    analytics_widget: 'preserve-me',
  });
  restoreBackupText(destination, exported);

  const result = destination.dump();
  assert.equal(result.nt_ai_config, raw({ apiKey: 'local-secret', provider: 'gemini' }));
  assert.equal(result.analytics_widget, 'preserve-me');
  assert.equal(Object.hasOwn(result, 'nt_water_2020-01-01'), false);
  for (const [key, value] of Object.entries(validBackup())) assert.equal(result[key], value);
});

test('valid HTML-looking strings are preserved as text', () => {
  const html = '<img src=x data-test="backup-html">';
  const backup = validBackup({
    nt_user: raw({ ...user, name: html }),
    'nt_food_logs_2026-09-07': raw([{ ...food, food_name: html }]),
  });
  const prepared = parseAndPrepareBackup(asText(backup));
  assert.equal(JSON.parse(prepared.nt_user).name, html);
  assert.equal(JSON.parse(prepared['nt_food_logs_2026-09-07'])[0].food_name, html);
});

test('AI food logs export with every application-supported ai_input_mode', async (t) => {
  for (const mode of ['text', 'image', 'mixed']) {
    await t.test(mode, () => {
      const aiFood = { ...food, source: 'ai', ai_input_mode: mode };
      const source = new MemoryStorage(validBackup({ 'nt_food_logs_2026-09-07': raw([aiFood]) }));
      const exported = JSON.parse(serializeFilteredBackup(source));
      assert.equal(JSON.parse(exported['nt_food_logs_2026-09-07'])[0].ai_input_mode, mode);
    });
  }
});

test('export/import roundtrip preserves ai_input_mode', () => {
  const aiFood = { ...food, source: 'ai', ai_input_mode: 'mixed' };
  const source = new MemoryStorage(validBackup({ 'nt_food_logs_2026-09-07': raw([aiFood]) }));
  const destination = new MemoryStorage();
  restoreBackupText(destination, serializeFilteredBackup(source));
  assert.equal(JSON.parse(destination.getItem('nt_food_logs_2026-09-07'))[0].ai_input_mode, 'mixed');
});

test('food logs without ai_input_mode remain valid', () => {
  const prepared = parseAndPrepareBackup(asText(validBackup()));
  assert.equal(Object.hasOwn(JSON.parse(prepared['nt_food_logs_2026-09-07'])[0], 'ai_input_mode'), false);
});

test('unsupported ai_input_mode is rejected without mutating storage', () => {
  assertInvalidWithoutMutation(validBackup({
    'nt_food_logs_2026-09-07': raw([{ ...food, source: 'ai', ai_input_mode: 'video' }]),
  }));
});

test('HTML-looking strings and objects are rejected in restorable numeric fields', async (t) => {
  const html = '<img src=x data-test="backup-html">';
  const cases = [
    ['food quantity string', validBackup({ 'nt_food_logs_2026-09-07': raw([{ ...food, quantity: html }]) })],
    ['food quantity object', validBackup({ 'nt_food_logs_2026-09-07': raw([{ ...food, quantity: { value: 150 } }]) })],
    ['favorite quantity string', validBackup({ nt_favorites: raw([{ ...favorite, quantity: html }]) })],
    ['profile weight string', validBackup({ nt_user: raw({ ...user, weight: html }) })],
    ['cached kcal string', validBackup({
      nt_ai_cache: raw({ q: { result: { alimentos: [{ ...cachedFood, kcal: html }] }, ts: 1, mode: 'ai' } }),
    })],
  ];
  for (const [name, value] of cases) await t.test(name, () => assertInvalidWithoutMutation(value));
});

test('outer JSON corruption and non-object roots never mutate storage', async (t) => {
  for (const [name, value] of [
    ['corrupt JSON', '{'],
    ['array', '[]'],
    ['null', 'null'],
    ['string', '"backup"'],
    ['number', '42'],
    ['boolean', 'true'],
  ]) await t.test(name, () => assertInvalidWithoutMutation(value));
});

test('invalid keys and inner representations never mutate storage', async (t) => {
  const cases = [
    ['missing nt_user', {}],
    ['nt_user is not an outer string', { ...validBackup(), nt_user: user }],
    ['corrupt inner JSON', { ...validBackup(), nt_user: '{' }],
    ['foreign key', validBackup({ widget: raw(true) })],
    ['unknown nt key', validBackup({ nt_surprise: raw(true) })],
  ];
  for (const [name, value] of cases) await t.test(name, () => assertInvalidWithoutMutation(value));
});

test('prototype-related keys are rejected without mutation', async (t) => {
  const texts = [
    ['hasOwnProperty', `{"nt_user":${JSON.stringify(raw(user))},"hasOwnProperty":"true"}`],
    ['__proto__', `{"nt_user":${JSON.stringify(raw(user))},"__proto__":"true"}`],
    ['constructor', `{"nt_user":${JSON.stringify(raw(user))},"constructor":"true"}`],
    ['prototype', `{"nt_user":${JSON.stringify(raw(user))},"prototype":"true"}`],
    ['internal __proto__', asText({ ...validBackup(), nt_user: `{"__proto__":{},${raw(user).slice(1)}` })],
  ];
  for (const [name, value] of texts) await t.test(name, () => assertInvalidWithoutMutation(value));
});

test('invalid structures, dates, numbers, limits, and unknown fields never mutate storage', async (t) => {
  const tooManyLogs = Array.from({ length: BACKUP_LIMITS.maxLogsPerDay + 1 }, (_, index) => ({ ...food, id: `f-${index}` }));
  const cases = [
    ['wrong user type', validBackup({ nt_user: raw([]) })],
    ['wrong food logs type', validBackup({ 'nt_food_logs_2026-09-07': raw({}) })],
    ['invalid date in key', { ...validBackup(), 'nt_water_2026-02-30': raw(1) }],
    ['invalid date in weight log', validBackup({ nt_weight_logs: raw([{ date: '2025-02-29', weight: 60 }]) })],
    ['key/log date mismatch', validBackup({ 'nt_food_logs_2026-09-07': raw([{ ...food, date: '2026-09-06' }]) })],
    ['negative water', validBackup({ 'nt_water_2026-09-07': raw(-1) })],
    ['negative nutrient', validBackup({ 'nt_food_logs_2026-09-07': raw([{ ...food, protein: -1 }]) })],
    ['non-finite number', validBackup({ 'nt_water_2026-09-07': '1e400' })],
    ['array limit', validBackup({ 'nt_food_logs_2026-09-07': raw(tooManyLogs) })],
    ['string limit', validBackup({ nt_user: raw({ ...user, name: 'x'.repeat(201) }) })],
    ['unknown user field', validBackup({ nt_user: raw({ ...user, admin: true }) })],
    ['unknown food field', validBackup({ 'nt_food_logs_2026-09-07': raw([{ ...food, html: '<b>x</b>' }]) })],
    ['unknown favorite field', validBackup({ nt_favorites: raw([{ ...favorite, extra: 1 }]) })],
    ['unknown cache field', validBackup({ nt_ai_cache: raw({ q: { result: { alimentos: [cachedFood] }, ts: 1, mode: 'ai', extra: true } }) })],
    ['HTML string in numeric field', validBackup({ 'nt_water_2026-09-07': raw('<img src=x data-test="backup-html">') })],
  ];
  for (const [name, value] of cases) await t.test(name, () => assertInvalidWithoutMutation(value));
});

test('legacy profile weight supplies initial_weight without overwriting an existing value', () => {
  const missing = { ...user };
  delete missing.initial_weight;
  const migrated = parseAndPrepareBackup(asText({ nt_user: raw(missing) }));
  assert.equal(JSON.parse(migrated.nt_user).initial_weight, user.weight);

  const existing = parseAndPrepareBackup(asText({ nt_user: raw(user) }));
  assert.equal(JSON.parse(existing.nt_user).initial_weight, 67);
});

test('legacy favorites and dark mode aliases migrate explicitly', () => {
  const backup = validBackup();
  delete backup.nt_favorites;
  delete backup.nt_dark_mode;
  backup.nt_nt_favorites = raw([favorite]);
  backup.nutritrack_dark_mode = raw(false);
  const prepared = parseAndPrepareBackup(asText(backup));
  assert.deepEqual(JSON.parse(prepared.nt_favorites), [favorite]);
  assert.equal(JSON.parse(prepared.nt_dark_mode), false);
  assert.equal(Object.hasOwn(prepared, 'nt_nt_favorites'), false);
  assert.equal(Object.hasOwn(prepared, 'nutritrack_dark_mode'), false);
});

test('canonical and legacy aliases together are rejected as ambiguous', () => {
  assertInvalidWithoutMutation(validBackup({ nt_nt_favorites: raw([favorite]) }));
  assertInvalidWithoutMutation(validBackup({ nutritrack_dark_mode: raw(false) }));
});

test('historical nt_ai_config is accepted but ignored and local configuration is preserved', () => {
  const backup = validBackup({ nt_ai_config: raw({ apiKey: 'backup-secret', provider: 'gemini' }) });
  const prepared = parseAndPrepareBackup(asText(backup));
  assert.equal(Object.hasOwn(prepared, 'nt_ai_config'), false);

  const storage = new MemoryStorage({ nt_ai_config: raw({ apiKey: 'local-secret', provider: 'gemini' }) });
  commitPreparedBackup(storage, prepared);
  assert.equal(storage.getItem('nt_ai_config'), raw({ apiKey: 'local-secret', provider: 'gemini' }));
});

test('export normalizes unambiguous legacy aliases and never emits the aliases', () => {
  const data = validBackup();
  delete data.nt_favorites;
  delete data.nt_dark_mode;
  const storage = new MemoryStorage({
    ...data,
    nt_nt_favorites: raw([favorite]),
    nutritrack_dark_mode: raw(false),
  });
  const exported = createFilteredBackup(storage);
  assert.equal(Object.hasOwn(exported, 'nt_nt_favorites'), false);
  assert.equal(Object.hasOwn(exported, 'nutritrack_dark_mode'), false);
  assert.deepEqual(JSON.parse(exported.nt_favorites), [favorite]);
  assert.equal(JSON.parse(exported.nt_dark_mode), false);
});

for (const [name, failMutationAt] of [
  ['first write', 1],
  ['intermediate write', 2],
  ['last write', 3],
]) {
  test(`commit failure at ${name} restores the exact snapshot`, () => {
    const initial = {
      nt_user: raw({ ...user, name: 'Old' }),
      nt_dark_mode: raw(false),
      nt_ai_config: raw({ apiKey: 'local', provider: 'gemini' }),
      foreign: 'untouched',
    };
    const storage = new MemoryStorage(initial, { failMutationAt });
    const prepared = parseAndPrepareBackup(asText({
      nt_user: raw(user),
      nt_dark_mode: raw(true),
      nt_weight_logs: raw([]),
    }));
    assert.throws(() => commitPreparedBackup(storage, prepared), (error) => error.code === 'BACKUP_COMMIT_FAILED');
    assert.deepEqual(storage.dump(), initial);
  });
}

test('failure while deleting an obsolete managed key restores the exact snapshot', () => {
  const initial = {
    nt_user: raw({ ...user, name: 'Old' }),
    nt_dark_mode: raw(false),
    'nt_water_2020-01-01': raw(3),
    foreign: 'untouched',
  };
  const prepared = parseAndPrepareBackup(asText({ nt_user: raw(user) }));
  // One write, then the first sorted obsolete-key removal.
  const storage = new MemoryStorage(initial, { failMutationAt: 2 });
  assert.throws(() => commitPreparedBackup(storage, prepared), (error) => error.code === 'BACKUP_COMMIT_FAILED');
  assert.deepEqual(storage.dump(), initial);
});

for (const [name, behavior] of [
  ['read-back throws', { failReadsAfterMutation: true }],
  ['read-back mismatches', { wrongReadAfterMutation: true }],
]) {
  test(`${name} and triggers exact rollback`, () => {
    const initial = { nt_user: raw({ ...user, name: 'Old' }), foreign: 'untouched' };
    const storage = new MemoryStorage(initial, behavior);
    const prepared = parseAndPrepareBackup(asText({ nt_user: raw(user), nt_dark_mode: raw(true) }));
    assert.throws(() => commitPreparedBackup(storage, prepared), (error) => error.code === 'BACKUP_COMMIT_FAILED');
    assert.deepEqual(storage.dump(), initial);
  });
}

test('persistent storage failure reports a specific critical rollback error', () => {
  const initial = { nt_user: raw({ ...user, name: 'Old' }), foreign: 'untouched' };
  const storage = new MemoryStorage(initial, { failMutationAt: 1, persistentMutationFailure: true });
  const prepared = parseAndPrepareBackup(asText({ nt_user: raw(user) }));
  assert.throws(
    () => commitPreparedBackup(storage, prepared),
    (error) => error instanceof BackupError && error.code === 'BACKUP_ROLLBACK_FAILED' && /recuperación manual/.test(error.message),
  );
});
