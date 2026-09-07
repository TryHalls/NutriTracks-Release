import assert from 'node:assert/strict';
import test from 'node:test';

import { commitPreparedBackup } from '../www/js/modules/backup.js';
import {
  LS,
  PersistenceCode,
  PersistenceError,
} from '../www/js/modules/state.js';
import {
  isBackupStorageKey,
  isOwnedStorageKey,
  isResetStorageKey,
} from '../www/js/modules/storage-policy.js';

class MemoryStorage {
  constructor(initial = {}, hooks = {}) {
    this.data = new Map(Object.entries(initial));
    this.hooks = hooks;
    this.counts = { get: 0, set: 0, remove: 0 };
  }

  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }

  getItem(key) {
    this.counts.get += 1;
    const result = this.hooks.get?.(key, this.counts.get, this);
    if (result?.throw) throw result.throw;
    if (result && Object.hasOwn(result, 'value')) return result.value;
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.counts.set += 1;
    const result = this.hooks.set?.(key, String(value), this.counts.set, this);
    if (result?.throwBefore) throw result.throwBefore;
    this.data.set(key, String(value));
    if (result?.throwAfter) throw result.throwAfter;
  }

  removeItem(key) {
    this.counts.remove += 1;
    const result = this.hooks.remove?.(key, this.counts.remove, this);
    if (result?.throwBefore) throw result.throwBefore;
    this.data.delete(key);
    if (result?.throwAfter) throw result.throwAfter;
  }

  dump() { return Object.fromEntries(this.data); }
}

function useStorage(storage) {
  globalThis.localStorage = storage;
  return storage;
}

function raw(value) { return JSON.stringify(value); }

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof PersistenceError);
    assert.equal(error.code, code);
    return true;
  });
}

test('LS.get: ausencia usa fallback, valor válido se parsea y no comparte referencias', () => {
  const store = useStorage(new MemoryStorage({ nt_object: raw({ nested: { value: 1 } }) }));
  assert.deepEqual(LS.get('missing', []), []);
  const first = LS.get('object');
  first.nested.value = 99;
  assert.deepEqual(LS.get('object'), { nested: { value: 1 } });
  assert.equal(store.counts.get, 3);
});

test('LS.get: distingue JSON corrupto y fallo real de lectura', () => {
  useStorage(new MemoryStorage({ nt_bad: '{no-json' }));
  expectCode(() => LS.get('bad', []), PersistenceCode.PARSE_FAILED);

  useStorage(new MemoryStorage({}, { get: () => ({ throw: new Error('denied') }) }));
  expectCode(() => LS.get('missing', []), PersistenceCode.READ_FAILED);
});

test('LS.set: éxito verificado y serialización undefined rechazada sin mutar', () => {
  const store = useStorage(new MemoryStorage({ nt_value: raw('old') }));
  assert.equal(LS.set('value', { ok: true }), true);
  assert.equal(store.getItem('nt_value'), raw({ ok: true }));
  expectCode(() => LS.set('value', undefined), PersistenceCode.SERIALIZE_FAILED);
  assert.equal(store.getItem('nt_value'), raw({ ok: true }));
});

test('LS.set: setItem fallido revierte al valor anterior', () => {
  const old = raw({ old: true });
  const store = useStorage(new MemoryStorage({ nt_value: old }, {
    set: (_key, _value, count) => count === 1 ? { throwAfter: new Error('quota') } : null,
  }));
  expectCode(() => LS.set('value', { next: true }), PersistenceCode.WRITE_FAILED);
  assert.equal(store.getItem('nt_value'), old);
});

test('LS.set: fallo de read-back y mismatch revierten el snapshot', () => {
  const old = raw('old');
  let verifyReadFailed = false;
  const readFailure = useStorage(new MemoryStorage({ nt_value: old }, {
    get: (key, _count, store) => {
      if (key === 'nt_value' && store.counts.set === 1 && !verifyReadFailed) {
        verifyReadFailed = true;
        return { throw: new Error('read-back denied') };
      }
      return null;
    },
  }));
  expectCode(() => LS.set('value', 'next'), PersistenceCode.VERIFY_FAILED);
  assert.equal(readFailure.getItem('nt_value'), old);

  let mismatched = false;
  const mismatch = useStorage(new MemoryStorage({ nt_value: old }, {
    get: (key, _count, store) => {
      if (key === 'nt_value' && store.counts.set === 1 && !mismatched) {
        mismatched = true;
        return { value: '__wrong__' };
      }
      return null;
    },
  }));
  expectCode(() => LS.set('value', 'next'), PersistenceCode.VERIFY_FAILED);
  assert.equal(mismatch.getItem('nt_value'), old);
});

test('LS.set: rollback elimina una clave originalmente ausente', () => {
  let mismatch = false;
  const store = useStorage(new MemoryStorage({}, {
    get: (key, _count, current) => {
      if (key === 'nt_new' && current.counts.set === 1 && !mismatch) {
        mismatch = true;
        return { value: '__wrong__' };
      }
      return null;
    },
  }));
  expectCode(() => LS.set('new', 1), PersistenceCode.VERIFY_FAILED);
  assert.equal(store.getItem('nt_new'), null);
});

test('LS.set: rollback no verificable produce ROLLBACK_FAILED', () => {
  const store = useStorage(new MemoryStorage({ nt_value: raw('old') }, {
    set: (_key, _value, count) => count === 1
      ? { throwAfter: new Error('write failed') }
      : { throwBefore: new Error('rollback failed') },
  }));
  expectCode(() => LS.set('value', 'next'), PersistenceCode.ROLLBACK_FAILED);
  assert.equal(store.data.get('nt_value'), raw('next'));
});

test('LS.remove: éxito e idempotencia', () => {
  const store = useStorage(new MemoryStorage({ nt_value: raw(1) }));
  assert.equal(LS.remove('value'), true);
  assert.equal(LS.remove('value'), true);
  assert.equal(store.getItem('nt_value'), null);
});

test('LS.remove: fallo tras mutar restaura el valor anterior', () => {
  const old = raw({ old: true });
  const store = useStorage(new MemoryStorage({ nt_value: old }, {
    remove: (_key, count) => count === 1 ? { throwAfter: new Error('remove failed') } : null,
  }));
  expectCode(() => LS.remove('value'), PersistenceCode.REMOVE_FAILED);
  assert.equal(store.getItem('nt_value'), old);
});

for (const failAt of [1, 2, 3]) {
  test(`LS.setMany: fallo de escritura ${failAt} revierte todas las claves`, () => {
    const initial = { nt_a: raw('A'), nt_b: raw('B') };
    const store = useStorage(new MemoryStorage(initial, {
      set: (_key, _value, count) => count === failAt ? { throwAfter: new Error('write failed') } : null,
    }));
    const values = failAt === 3 ? { a: 'AA', b: 'BB', c: 'CC' } : { a: 'AA', b: 'BB' };
    assert.throws(() => LS.setMany(values), (error) => {
      assert.equal(error.code, PersistenceCode.COMMIT_FAILED);
      assert.equal(error.cause.code, PersistenceCode.WRITE_FAILED);
      return true;
    });
    assert.deepEqual(store.dump(), initial);
  });
}

test('LS.setMany: éxito y serialización completa previa a escrituras', () => {
  const store = useStorage(new MemoryStorage());
  assert.equal(LS.setMany({ a: [1], b: { ok: true } }), true);
  assert.deepEqual(store.dump(), { nt_a: '[1]', nt_b: raw({ ok: true }) });

  const circular = {};
  circular.self = circular;
  expectCode(() => LS.setMany({ a: 'changed', broken: circular }), PersistenceCode.SERIALIZE_FAILED);
  assert.equal(store.getItem('nt_a'), '[1]');
});

test('LS.setMany: fallo de verificación revierte presentes y ausentes', () => {
  const initial = { nt_a: raw('A'), nt_b: raw('B') };
  let mismatch = false;
  const store = useStorage(new MemoryStorage(initial, {
    get: (key, _count, current) => {
      if (key === 'nt_b' && current.counts.set === 3 && !mismatch) {
        mismatch = true;
        return { value: '__wrong__' };
      }
      return null;
    },
  }));
  assert.throws(() => LS.setMany({ a: 'AA', b: 'BB', c: 'CC' }), (error) => {
    assert.equal(error.code, PersistenceCode.COMMIT_FAILED);
    assert.equal(error.cause.code, PersistenceCode.VERIFY_FAILED);
    return true;
  });
  assert.deepEqual(store.dump(), initial);
});

test('LS.setMany: rollback crítico se distingue', () => {
  const store = useStorage(new MemoryStorage({ nt_a: raw('A') }, {
    set: (_key, _value, count) => count === 1
      ? { throwAfter: new Error('commit failed') }
      : { throwBefore: new Error('rollback failed') },
  }));
  expectCode(() => LS.setMany({ a: 'AA', b: 'BB' }), PersistenceCode.ROLLBACK_FAILED);
});

test('clearManaged elimina solo política de reset, incluidas dinámicas, legacy y ai_config', () => {
  const store = useStorage(new MemoryStorage({
    nt_user: raw({ id: 1 }),
    'nt_food_logs_2026-09-07': raw([]),
    'nt_water_2026-09-07': raw(2),
    nt_nt_favorites: raw([]),
    nutritrack_dark_mode: raw(true),
    nt_ai_config: raw({ apiKey: 'secret', provider: 'gemini' }),
    nt_unknown_future: raw('keep'),
    unrelated: raw('keep'),
  }));
  assert.equal(LS.clearManaged(), true);
  assert.deepEqual(store.dump(), {
    nt_unknown_future: raw('keep'),
    unrelated: raw('keep'),
  });
});

test('la política distingue propiedad, backup y reset sensible', () => {
  assert.equal(isOwnedStorageKey('nt_ai_config'), true);
  assert.equal(isBackupStorageKey('nt_ai_config'), false);
  assert.equal(isResetStorageKey('nt_ai_config'), true);
  assert.equal(isResetStorageKey('nt_ai_config', { includeSensitive: false }), false);
  assert.equal(isOwnedStorageKey('nt_food_logs_2026-09-07'), true);
  assert.equal(isOwnedStorageKey('nt_unknown_future'), false);
});

test('clearManaged puede preservar explícitamente nt_ai_config', () => {
  const config = raw({ apiKey: 'secret', provider: 'gemini' });
  const store = useStorage(new MemoryStorage({ nt_user: raw({}), nt_ai_config: config }));
  LS.clearManaged({ includeSensitive: false });
  assert.deepEqual(store.dump(), { nt_ai_config: config });
});

test('clearManaged revierte el snapshot completo ante fallo', () => {
  const initial = { nt_user: raw({ id: 1 }), nt_weight_logs: raw([1]), other: raw(2) };
  const store = useStorage(new MemoryStorage(initial, {
    remove: (_key, count) => count === 2 ? { throwAfter: new Error('remove failed') } : null,
  }));
  expectCode(() => LS.clearManaged(), PersistenceCode.REMOVE_FAILED);
  assert.deepEqual(store.dump(), initial);
});

test('H07: reset elimina snapshots antiguos y onboarding crea solo el peso nuevo', () => {
  const store = useStorage(new MemoryStorage());
  LS.setMany({
    user: { id: 'old', weight: 90 },
    weight_logs: [{ date: '2026-01-01', weight: 90 }],
    'food_logs_2026-01-01': [{ id: 'old-food' }],
    'water_2026-01-01': 8,
    favorites: [{ id: 'old-favorite' }],
  });
  assert.equal(LS.get('weight_logs', []).length, 1);
  LS.clearManaged();
  assert.deepEqual(LS.get('weight_logs', []), []);
  assert.deepEqual(LS.get('food_logs_2026-01-01', []), []);
  assert.equal(LS.get('water_2026-01-01', 0), 0);
  assert.deepEqual(LS.get('favorites', []), []);

  LS.setMany({
    user: { id: 'new', weight: 65 },
    weight_logs: [{ date: '2026-09-07', weight: 65 }],
  });
  assert.deepEqual(LS.get('weight_logs'), [{ date: '2026-09-07', weight: 65 }]);
  assert.equal(store.getItem('nt_food_logs_2026-01-01'), null);
});

test('backup commit es visible inmediatamente por LS.get y preserva nt_ai_config', () => {
  const config = raw({ apiKey: 'secret', provider: 'gemini' });
  const store = useStorage(new MemoryStorage({ nt_user: raw({ id: 'old' }), nt_ai_config: config }));
  commitPreparedBackup(store, {
    nt_user: raw({ id: 'new' }),
    nt_weight_logs: raw([{ date: '2026-09-07', weight: 65 }]),
  });
  assert.deepEqual(LS.get('user'), { id: 'new' });
  assert.deepEqual(LS.get('weight_logs'), [{ date: '2026-09-07', weight: 65 }]);
  assert.equal(store.getItem('nt_ai_config'), config);
});

test('rollback de backup es visible inmediatamente por LS.get', () => {
  const oldUser = raw({ id: 'old' });
  let failed = false;
  const store = useStorage(new MemoryStorage({ nt_user: oldUser, nt_weight_logs: raw([]) }, {
    set: (key, value) => {
      if (key === 'nt_user' && value === raw({ id: 'new' }) && !failed) {
        failed = true;
        return { throwAfter: new Error('commit failed') };
      }
      return null;
    },
  }));
  assert.throws(() => commitPreparedBackup(store, {
    nt_user: raw({ id: 'new' }),
    nt_weight_logs: raw([{ date: '2026-09-07', weight: 65 }]),
  }));
  assert.deepEqual(LS.get('user'), { id: 'old' });
  assert.deepEqual(LS.get('weight_logs'), []);
});
