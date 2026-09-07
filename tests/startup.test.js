import assert from 'node:assert/strict';
import test from 'node:test';
import { App, LS, PersistenceCode, PersistenceError } from '../www/js/modules/state.js';
import {
  InitializationState,
  initializeApp,
  resetFromRecovery,
} from '../www/js/modules/startup.js';

class ClassListStub {
  constructor(...names) { this.names = new Set(names); }
  toggle(name, force) {
    if (force) this.names.add(name);
    else this.names.delete(name);
  }
  contains(name) { return this.names.has(name); }
}

function createHarness() {
  const elements = new Map([
    ['onboarding-screen', { classList: new ClassListStub('hidden') }],
    ['app', { classList: new ClassListStub('hidden') }],
    ['storage-recovery-screen', { classList: new ClassListStub('hidden') }],
    ['storage-recovery-detail', { textContent: '' }],
  ]);
  const calls = { date: 0, inject: 0, theme: 0, greeting: 0, dashboard: 0, config: 0, errors: 0 };
  return {
    elements,
    calls,
    documentRef: { getElementById: (id) => elements.get(id) || null },
    utils: { checkAndResetForNewDay: () => { calls.date += 1; } },
    ui: {
      injectWaterPage: () => { calls.inject += 1; },
      applySavedDarkMode: () => { calls.theme += 1; },
      setGreeting: () => { calls.greeting += 1; },
      refreshDashboard: () => { calls.dashboard += 1; },
    },
    api: { loadAIConfig: () => { calls.config += 1; } },
    logger: { error: () => { calls.errors += 1; } },
  };
}

function visible(harness, id) {
  return !harness.elements.get(id).classList.contains('hidden');
}

test('inicio: usuario ausente muestra onboarding normal sin error ni escritura de fecha', async () => {
  const harness = createHarness();
  const app = { user: { id: 'stale-memory' } };
  const result = await initializeApp({ ...harness, app, ls: { getUser: () => null } });

  assert.equal(result, InitializationState.ONBOARDING);
  assert.equal(app.user, null);
  assert.equal(visible(harness, 'onboarding-screen'), true);
  assert.equal(visible(harness, 'app'), false);
  assert.equal(visible(harness, 'storage-recovery-screen'), false);
  assert.equal(harness.calls.date, 0);
  assert.equal(harness.calls.errors, 0);
});

test('inicio: usuario válido valida primero y después inicializa fecha y aplicación', async () => {
  const harness = createHarness();
  const user = { id: 'user-b', name: 'Ada' };
  const app = { user: null };
  const order = [];
  const result = await initializeApp({
    ...harness,
    app,
    ls: { getUser: () => { order.push('user'); return user; } },
    utils: { checkAndResetForNewDay: () => { order.push('date'); harness.calls.date += 1; } },
  });

  assert.equal(result, InitializationState.READY);
  assert.deepEqual(order, ['user', 'date']);
  assert.equal(app.user, user);
  assert.equal(visible(harness, 'app'), true);
  assert.equal(visible(harness, 'onboarding-screen'), false);
  assert.equal(harness.calls.greeting, 1);
  assert.equal(harness.calls.dashboard, 1);
  assert.equal(harness.calls.config, 1);
});

test('inicio: nt_user corrupto entra en recuperación sin escribir ni mutar otros datos', async () => {
  const harness = createHarness();
  const app = { user: { id: 'stale-memory' } };
  const storageBefore = new Map([
    ['nt_user', '{json-corrupto'],
    ['nt_weight_logs', '[{"date":"2026-09-01","weight":70}]'],
    ['nt_food_logs_2026-09-01', '[{"id":"old-food"}]'],
    ['nt_water_2026-09-01', '4'],
    ['nt_favorites', '[{"id":"old-favorite"}]'],
  ]);
  globalThis.localStorage = {
    getItem: (key) => storageBefore.has(key) ? storageBefore.get(key) : null,
    setItem: (key, value) => storageBefore.set(key, value),
    removeItem: (key) => storageBefore.delete(key),
  };
  const snapshot = [...storageBefore];

  const result = await initializeApp({ ...harness, app, ls: LS });

  assert.equal(result, InitializationState.RECOVERY_ERROR);
  assert.equal(app.user, null);
  assert.equal(visible(harness, 'storage-recovery-screen'), true);
  assert.equal(visible(harness, 'onboarding-screen'), false);
  assert.equal(visible(harness, 'app'), false);
  assert.equal(harness.calls.date, 0);
  assert.equal(harness.calls.inject, 0);
  assert.equal(harness.calls.theme, 0);
  assert.deepEqual([...storageBefore], snapshot);
  assert.equal(storageBefore.has('nt_last_active_date'), false);
});

test('inicio: error de lectura usa el mismo estado conservador', async () => {
  const harness = createHarness();
  const app = { user: { id: 'stale-memory' } };
  const error = new PersistenceError(PersistenceCode.READ_FAILED, 'fallo simulado');
  const result = await initializeApp({
    ...harness,
    app,
    ls: { getUser: () => { throw error; } },
  });

  assert.equal(result, InitializationState.RECOVERY_ERROR);
  assert.equal(app.user, null);
  assert.equal(visible(harness, 'storage-recovery-screen'), true);
  assert.equal(visible(harness, 'onboarding-screen'), false);
  assert.equal(harness.calls.date, 0);
  assert.equal(harness.calls.inject, 0);
  assert.equal(harness.calls.errors, 1);
});

test('recuperación: sólo recarga después de un reset explícito exitoso', () => {
  let reloads = 0;
  assert.equal(resetFromRecovery({ clearData: () => false, reload: () => { reloads += 1; } }), false);
  assert.equal(reloads, 0);
  assert.equal(resetFromRecovery({ clearData: () => true, reload: () => { reloads += 1; } }), true);
  assert.equal(reloads, 1);
});

test('recuperación: reset exitoso deja onboarding limpio y no revive datos antiguos', async () => {
  const data = new Map([
    ['nt_user', '{json-corrupto'],
    ['nt_weight_logs', '[{"date":"2026-09-01","weight":70}]'],
    ['nt_food_logs_2026-09-01', '[{"id":"old-food"}]'],
    ['nt_water_2026-09-01', '4'],
    ['nt_favorites', '[{"id":"old-favorite"}]'],
    ['nt_ai_config', '{"apiKey":"secret","provider":"gemini"}'],
    ['foreign_key', 'preserved'],
  ]);
  globalThis.localStorage = {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };

  LS.clearManaged({ includeSensitive: true });
  const harness = createHarness();
  const result = await initializeApp({ ...harness, app: App, ls: LS });

  assert.equal(result, InitializationState.ONBOARDING);
  assert.equal(visible(harness, 'onboarding-screen'), true);
  assert.equal(LS.get('weight_logs', null), null);
  assert.equal(LS.get('food_logs_2026-09-01', null), null);
  assert.equal(LS.get('water_2026-09-01', null), null);
  assert.equal(LS.get('favorites', null), null);
  assert.equal(LS.get('ai_config', null), null);
  assert.equal(data.get('foreign_key'), 'preserved');
});
