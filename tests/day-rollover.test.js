import assert from 'node:assert/strict';
import test from 'node:test';
import { App, LS } from '../www/js/modules/state.js';
import * as Utils from '../www/js/modules/utils.js';
import * as UI from '../www/js/modules/ui.js';
import {
  InitializationState,
  initializeApp,
  registerDayLifecycle,
  registerDayLifecycleAfterStartup,
} from '../www/js/modules/startup.js';

const NativeDate = globalThis.Date;

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.operations = [];
    this.failReads = new Set();
    this.failWrites = new Set();
  }
  getItem(key) {
    this.operations.push(['get', key]);
    if (this.failReads.has(key)) throw new Error(`read failed: ${key}`);
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.operations.push(['set', key]);
    if (this.failWrites.has(key)) throw new Error(`write failed: ${key}`);
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.operations.push(['remove', key]);
    this.values.delete(key);
  }
}

function seed(storage, key, value) {
  storage.values.set(`nt_${key}`, JSON.stringify(value));
}

function stored(storage, key, fallback = null) {
  const raw = storage.values.get(`nt_${key}`);
  return raw === undefined ? fallback : JSON.parse(raw);
}

function localDate(date) {
  return new NativeDate(`${date}T12:00:00`);
}

function resetApp(date, { followsToday = true } = {}) {
  App.user = {
    id: 'user-1', name: 'Ada', water_goal: 8, daily_calories: 2000,
    protein_goal: 120, carbs_goal: 250, fat_goal: 70, weight: 68,
    initial_weight: 68, goal: 'maintain',
  };
  App.currentPage = 'diary';
  App.todayDate = date;
  App.todayLogs = [{ id: `memory-${date}` }];
  App.todayWater = 5;
  App.diaryLogs = [];
  App.currentDiaryDate = localDate(date);
  App.diaryFollowsToday = followsToday;
  App.currentMealType = 'lunch';
  App.selectedFood = null;
  App._pendingAIFoods = null;
  App.aiEditorIndex = 0;
  App.selectedAIMeal = 'lunch';
  App.lastAIInputMode = 'text';
  App.lastAISourceMode = 'offline';
}

function element(options = {}) {
  const names = new Set();
  return {
    value: options.value ?? '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: {
      add: (...items) => items.forEach(item => names.add(item)),
      remove: (...items) => items.forEach(item => names.delete(item)),
      contains: item => names.has(item),
      toggle: (item, force) => {
        if (force === undefined ? !names.has(item) : force) names.add(item);
        else names.delete(item);
      },
    },
  };
}

async function withEnvironment(storage, initialElements = {}, callback) {
  const previousStorage = globalThis.localStorage;
  const previousDocument = globalThis.document;
  const previousConfirm = globalThis.confirm;
  const elements = new Map(Object.entries(initialElements).map(([id, value]) => [id, element(value)]));
  globalThis.localStorage = storage;
  globalThis.confirm = () => true;
  globalThis.document = {
    visibilityState: 'visible',
    getElementById: id => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  try {
    return await callback(elements);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousConfirm === undefined) delete globalThis.confirm;
    else globalThis.confirm = previousConfirm;
  }
}

async function withNow(isoDateTime, callback) {
  const fixedTime = new NativeDate(isoDateTime).getTime();
  class FixedDate extends NativeDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(fixedTime);
    }
    static now() { return fixedTime; }
  }
  globalThis.Date = FixedDate;
  try {
    return await callback();
  } finally {
    globalThis.Date = NativeDate;
  }
}

function markerAndPreviousDay(storage, date = '2026-01-10') {
  seed(storage, 'last_active_date', date);
  seed(storage, `water_${date}`, 5);
  seed(storage, `food_logs_${date}`, [{ id: `food-${date}`, date }]);
}

test('H13: 23:59 → 00:01 reconcilia una vez y descarta el estado en memoria de ayer', async () => {
  const storage = new MemoryStorage();
  markerAndPreviousDay(storage);
  resetApp('2026-01-10');

  await withEnvironment(storage, {}, async () => {
    await withNow('2026-01-10T23:59:00', async () => {
      assert.equal(Utils.reconcileLocalDay(), false);
    });
    await withNow('2026-01-11T00:01:00', async () => {
      assert.equal(Utils.reconcileLocalDay(), true);
    });
  });

  assert.equal(App.todayDate, '2026-01-11');
  assert.equal(App.todayWater, 0);
  assert.deepEqual(App.todayLogs, []);
  assert.equal(Utils.toDateStr(App.currentDiaryDate), '2026-01-11');
  assert.equal(stored(storage, 'last_active_date'), '2026-01-11');
  assert.equal(stored(storage, 'water_2026-01-11', null), null);
  assert.equal(stored(storage, 'food_logs_2026-01-11', null), null);
  assert.ok(storage.operations.findIndex(([op, key]) => op === 'get' && key === 'nt_food_logs_2026-01-11')
    < storage.operations.findIndex(([op, key]) => op === 'set' && key === 'nt_last_active_date'));

  const operationCount = storage.operations.length;
  await withEnvironment(storage, {}, () => withNow('2026-01-11T00:02:00', async () => {
    assert.equal(Utils.reconcileLocalDay(), false);
  }));
  assert.equal(storage.operations.length, operationCount);
});

test('H13: agua A=5, B ausente, +1 guarda B=1', async () => {
  const storage = new MemoryStorage();
  markerAndPreviousDay(storage);
  resetApp('2026-01-10');

  await withEnvironment(storage, {}, () => withNow('2026-01-11T00:01:00', async () => {
    assert.equal(await UI.addWater(), true);
  }));

  assert.equal(stored(storage, 'water_2026-01-10'), 5);
  assert.equal(stored(storage, 'water_2026-01-11'), 1);
  assert.equal(App.todayWater, 1);
  assert.equal(App.todayDate, '2026-01-11');
});

test('H13: agua B=2, +1 conserva lo guardado y llega a B=3', async () => {
  const storage = new MemoryStorage();
  markerAndPreviousDay(storage);
  seed(storage, 'water_2026-01-11', 2);
  seed(storage, 'food_logs_2026-01-11', [{ id: 'food-B', date: '2026-01-11' }]);
  resetApp('2026-01-10');

  await withEnvironment(storage, {}, () => withNow('2026-01-11T00:01:00', async () => {
    assert.equal(await UI.addWater(), true);
  }));

  assert.equal(stored(storage, 'water_2026-01-11'), 3);
  assert.equal(App.todayWater, 3);
  assert.deepEqual(App.todayLogs, [{ id: 'food-B', date: '2026-01-11' }]);
});

test('H13: el diario que sigue hoy avanza y una fecha elegida conserva su intención histórica', async () => {
  const storage = new MemoryStorage();
  markerAndPreviousDay(storage);
  seed(storage, 'food_logs_2026-01-09', [{ id: 'historical', date: '2026-01-09' }]);
  resetApp('2026-01-10');

  await withEnvironment(storage, { 'qty-input': { value: '100' } }, async () => {
    await withNow('2026-01-10T23:59:00', async () => {
      assert.equal(await UI.changeDate(-1), true);
    });
    assert.equal(App.diaryFollowsToday, false);
    assert.equal(Utils.toDateStr(App.currentDiaryDate), '2026-01-09');

    await withNow('2026-01-11T00:01:00', async () => {
      assert.equal(Utils.reconcileLocalDay(), true);
    });
    assert.equal(App.todayDate, '2026-01-11');
    assert.equal(App.diaryFollowsToday, false);
    assert.equal(Utils.toDateStr(App.currentDiaryDate), '2026-01-09');

    App.selectedFood = {
      name: 'Manzana', source: 'local', calories_per_100g: 52, protein_per_100g: 0.3,
      carbs_per_100g: 14, fat_per_100g: 0.2, fiber_per_100g: 2.4, sugar_per_100g: 10,
    };
    assert.equal(await UI.confirmAddFood(), true);
    assert.equal(stored(storage, 'food_logs_2026-01-09').length, 2);
    assert.equal(stored(storage, 'food_logs_2026-01-09')[1].date, '2026-01-09');
  });
});

async function runTodayDiaryFlow(elements, operation) {
  const storage = new MemoryStorage();
  markerAndPreviousDay(storage);
  seed(storage, 'food_logs_2026-01-11', []);
  resetApp('2026-01-10');
  await withEnvironment(storage, elements, () => withNow('2026-01-11T00:01:00', operation));
  const logs = stored(storage, 'food_logs_2026-01-11');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].date, '2026-01-11');
  assert.equal(App.todayDate, '2026-01-11');
  assert.equal(Utils.toDateStr(App.currentDiaryDate), '2026-01-11');
  assert.equal(stored(storage, 'food_logs_2026-01-10').length, 1);
}

test('H13: alta manual usa el día reconciliado', async () => {
  await runTodayDiaryFlow({ 'qty-input': { value: '50' } }, async () => {
    App.selectedFood = {
      name: 'Avena', source: 'local', calories_per_100g: 380, protein_per_100g: 13,
      carbs_per_100g: 68, fat_per_100g: 7, fiber_per_100g: 10, sugar_per_100g: 1,
    };
    assert.equal(await UI.confirmAddFood(), true);
  });
});

test('H13: Quick Add usa el día reconciliado', async () => {
  await runTodayDiaryFlow({ 'quick-cal-input': { value: '250' } }, async () => {
    assert.equal(await UI.quickAddCalories(), true);
  });
});

test('H13: añadir un favorito al diario usa el día reconciliado', async () => {
  await runTodayDiaryFlow({}, async () => {
    UI.prepareFavAdd({
      id: 'favorite-1', food_name: 'Yogur', quantity: 100, calories: 80,
      protein: 5, carbs: 8, fat: 2, fiber: 0, sugar: 6, source: 'local',
    });
    assert.equal(await UI.addToMealFromFav('dinner'), true);
  });
});

test('H13: confirmar alimentos IA guarda el lote en el día reconciliado', async () => {
  await runTodayDiaryFlow({
    'ai-edit-name': { value: 'Lentejas' },
    'ai-edit-grams': { value: '150' },
    'ai-edit-kcal': { value: '170' },
    'ai-edit-protein': { value: '12' },
    'ai-edit-carbs': { value: '28' },
    'ai-edit-fat': { value: '1' },
  }, async () => {
    App._pendingAIFoods = [{
      alimento: 'Lentejas', gramos_estimados: 150, cantidad_estimada: '150g',
      kcal: 170, proteinas: 12, carbohidratos: 28, grasas: 1,
    }];
    assert.equal(await UI.confirmAIFoods(), true);
    assert.equal(await UI.saveEditedAIFoods(), true);
  });
});

test('H13: scanner y peso escriben la fecha local reconciliada', async () => {
  const storage = new MemoryStorage();
  markerAndPreviousDay(storage);
  resetApp('2026-01-10');
  await withEnvironment(storage, { 'log-weight-input': { value: '70' } }, () => withNow('2026-01-11T00:01:00', async () => {
    assert.equal(await UI._executeRegisterScannedProduct({
      name: 'Leche', calories_per_100g: 60, protein_per_100g: 3,
      carbs_per_100g: 5, fat_per_100g: 3, fiber_per_100g: 0, sugar_per_100g: 5,
    }, 100, 'off'), true);
    assert.equal(await UI.logWeight(), true);
  }));

  assert.equal(stored(storage, 'food_logs_2026-01-11')[0].date, '2026-01-11');
  assert.deepEqual(stored(storage, 'weight_logs'), [{ date: '2026-01-11', weight: 70 }]);
});

test('H13: la lectura del dashboard usa los FoodLogs y el agua del día reconciliado', async () => {
  const storage = new MemoryStorage();
  markerAndPreviousDay(storage);
  seed(storage, 'water_2026-01-11', 2);
  seed(storage, 'food_logs_2026-01-11', [{
    id: 'food-B', date: '2026-01-11', meal_type: 'lunch', calories: 400,
    protein: 20, carbs: 50, fat: 10, fiber: 3, sugar: 2,
  }]);
  resetApp('2026-01-10');
  await withEnvironment(storage, {
    'ring-remaining': {}, 'dash-consumed': {}, 'dash-goal': {}, 'dash-water': {},
  }, async elements => withNow('2026-01-11T00:01:00', async () => {
    assert.equal(await UI.refreshDashboard(), true);
    assert.equal(elements.get('dash-consumed').textContent, 400);
    assert.equal(elements.get('dash-water').textContent, 2);
  }));
  assert.equal(App.todayDate, '2026-01-11');
  assert.equal(App.todayLogs[0].id, 'food-B');
});

test('H13: el retorno desde background reconcilia y los eventos repetidos son idempotentes', async () => {
  const storage = new MemoryStorage();
  markerAndPreviousDay(storage);
  resetApp('2026-01-10');

  const documentListeners = new Map();
  const windowListeners = new Map();
  const listenerCounts = { document: 0, window: 0 };
  const documentRef = {
    visibilityState: 'hidden',
    addEventListener: (type, listener) => {
      listenerCounts.document += 1;
      documentListeners.set(type, listener);
    },
  };
  const windowRef = {
    addEventListener: (type, listener) => {
      listenerCounts.window += 1;
      windowListeners.set(type, listener);
    },
  };
  let changedCount = 0;
  const onResume = registerDayLifecycle({
    app: App,
    documentRef,
    windowRef,
    reconcileLocalDay: Utils.reconcileLocalDay,
    onDayChanged: () => { changedCount += 1; },
    onError: error => { throw error; },
  });
  const duplicateRegistration = registerDayLifecycle({
    app: App,
    documentRef,
    windowRef,
    reconcileLocalDay: Utils.reconcileLocalDay,
    onDayChanged: () => { changedCount += 1; },
    onError: error => { throw error; },
  });
  assert.strictEqual(duplicateRegistration, onResume);
  assert.deepEqual(listenerCounts, { document: 1, window: 2 });

  await withEnvironment(storage, {}, () => withNow('2026-01-11T00:01:00', async () => {
    assert.equal(documentListeners.get('visibilitychange')(), false);
    documentRef.visibilityState = 'visible';
    assert.equal(documentListeners.get('visibilitychange')(), true);
    assert.equal(windowListeners.get('focus')(), false);
    assert.equal(windowListeners.get('pageshow')(), false);
    assert.equal(onResume(), false);
  }));

  assert.equal(App.todayDate, '2026-01-11');
  assert.equal(changedCount, 1);
  assert.equal(storage.operations.filter(([op, key]) => op === 'set' && key === 'nt_last_active_date').length, 1);
});

test('H13: lifecycle de onboarding espera al usuario persistido y se activa tras terminarlo', async () => {
  const storage = new MemoryStorage();
  seed(storage, 'last_active_date', '2026-01-10');
  seed(storage, 'water_2026-01-11', 2);
  seed(storage, 'food_logs_2026-01-11', [{ id: 'food-B', date: '2026-01-11' }]);
  storage.operations = [];
  resetApp('2026-01-10');

  const startupResult = await initializeApp({
    app: App,
    ls: { getUser: () => null },
    utils: { reconcileLocalDay: () => { throw new Error('no debe reconciliarse sin usuario'); } },
    api: {},
    ui: { injectWaterPage() {}, applySavedDarkMode() {} },
    documentRef: { getElementById: () => null },
  });
  assert.equal(startupResult, InitializationState.ONBOARDING);
  assert.equal(App.user, null);

  const documentListeners = new Map();
  const windowListeners = new Map();
  const documentRef = {
    visibilityState: 'visible',
    addEventListener: (type, listener) => documentListeners.set(type, listener),
  };
  const windowRef = {
    addEventListener: (type, listener) => windowListeners.set(type, listener),
  };
  registerDayLifecycleAfterStartup(startupResult, {
    app: App,
    documentRef,
    windowRef,
    reconcileLocalDay: Utils.reconcileLocalDay,
  });

  await withEnvironment(storage, {}, () => withNow('2026-01-10T23:59:00', async () => {
    assert.equal(documentListeners.get('visibilitychange')(), false);
    assert.equal(windowListeners.get('focus')(), false);
    assert.equal(windowListeners.get('pageshow')(), false);
    assert.deepEqual(storage.operations, []);
  }));

  const previousOnboarding = { ...UI.ob };
  Object.assign(UI.ob, {
    name: 'Ada', gender: 'female', age: 34, height: 168,
    weight: 64, activity: 'moderate', goal: 'maintain',
  });
  const previousSetTimeout = globalThis.setTimeout;
  try {
    await withEnvironment(storage, {
      'ob-age': { value: '34' },
      'ob-height': { value: '168' },
      'ob-weight': { value: '64' },
      'onboarding-screen': {},
      app: {},
    }, () => withNow('2026-01-10T23:59:00', async () => {
      globalThis.setTimeout = () => 0;
      assert.equal(await UI.finishOnboarding(), true);
      assert.ok(App.user);
      assert.equal(stored(storage, 'user').id, App.user.id);
      assert.equal(storage.operations.some(([op, key]) => op === 'set' && key === 'nt_last_active_date'), false);

      storage.operations = [];
      documentRef.visibilityState = 'hidden';
      assert.equal(documentListeners.get('visibilitychange')(), false);
      documentRef.visibilityState = 'visible';
      await withNow('2026-01-11T00:01:00', async () => {
        assert.equal(windowListeners.get('pageshow')(), true);
      });
    }));
  } finally {
    globalThis.setTimeout = previousSetTimeout;
    Object.assign(UI.ob, previousOnboarding);
  }

  assert.equal(App.todayDate, '2026-01-11');
  assert.equal(App.todayWater, 2);
  assert.deepEqual(App.todayLogs, [{ id: 'food-B', date: '2026-01-11' }]);
  assert.equal(stored(storage, 'last_active_date'), '2026-01-11');
});

test('H13: un fallo de lectura o de marcador no publica estado parcial', async () => {
  for (const failure of ['read', 'write']) {
    const storage = new MemoryStorage();
    markerAndPreviousDay(storage);
    resetApp('2026-01-10');
    const originalDiaryDate = App.currentDiaryDate;
    const originalLogs = App.todayLogs;
    const originalWater = App.todayWater;
    if (failure === 'read') storage.failReads.add('nt_food_logs_2026-01-11');
    else storage.failWrites.add('nt_last_active_date');

    await withEnvironment(storage, {}, () => withNow('2026-01-11T00:01:00', async () => {
      assert.throws(() => Utils.reconcileLocalDay());
    }));
    assert.equal(App.todayDate, '2026-01-10');
    assert.strictEqual(App.currentDiaryDate, originalDiaryDate);
    assert.strictEqual(App.todayLogs, originalLogs);
    assert.equal(App.todayWater, originalWater);
    assert.equal(stored(storage, 'last_active_date'), '2026-01-10');
  }
});
