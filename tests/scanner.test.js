import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { App, LS } from '../www/js/modules/state.js';
import * as UI from '../www/js/modules/ui.js';
import * as Utils from '../www/js/modules/utils.js';
import {
  ScannerPhase,
  createScannerMachine,
  resetScannerMachine,
  retryScanner,
  transitionScannerState,
} from '../www/js/modules/scanner-machine.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

class ElementStub {
  constructor() {
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.style = {};
    this.disabled = false;
    this.attributes = {};
    this.listeners = new Map();
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, force) => {
        const enabled = force === undefined ? !classes.has(name) : !!force;
        if (enabled) classes.add(name); else classes.delete(name);
        return enabled;
      },
    };
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) listener.call(this, { target: this, type: event.type });
  }
  appendChild() {}
  remove() {}
  click() { this.clicked = true; }
  focus() {}
}

function setScannerPhase(phase) {
  resetScannerMachine(UI.ScannerState);
  if (phase === ScannerPhase.CLOSED) return;
  assert.equal(transitionScannerState(UI.ScannerState, ScannerPhase.STARTING), true);
  if (phase === ScannerPhase.STARTING) return;
  assert.equal(transitionScannerState(UI.ScannerState, ScannerPhase.SCANNING), true);
  if (phase === ScannerPhase.SCANNING) return;
  if (phase === ScannerPhase.LABEL_ANALYSIS) {
    assert.equal(transitionScannerState(UI.ScannerState, ScannerPhase.LABEL_ANALYSIS), true);
    return;
  }
  assert.equal(transitionScannerState(UI.ScannerState, ScannerPhase.LOOKUP), true);
  if (phase === ScannerPhase.LOOKUP) return;
  if (phase === ScannerPhase.NOT_FOUND) {
    assert.equal(transitionScannerState(UI.ScannerState, ScannerPhase.NOT_FOUND), true);
    return;
  }
  assert.equal(transitionScannerState(UI.ScannerState, ScannerPhase.CONFIRM), true);
}

async function withScannerEnvironment(callback) {
  const descriptors = new Map();
  const globals = ['document', 'localStorage', 'fetch', 'navigator', 'Html5Qrcode', 'crypto'];
  for (const name of globals) descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));

  const previousApp = {
    user: App.user,
    todayDate: App.todayDate,
    todayLogs: App.todayLogs,
    currentDiaryDate: App.currentDiaryDate,
    currentPage: App.currentPage,
    diaryFollowsToday: App.diaryFollowsToday,
  };
  const previousScannerState = { ...UI.ScannerState };
  const storage = new MemoryStorage();
  const todayDate = Utils.getLocalDateString();
  const elements = new Map();
  const ids = [
    'toast-container', 'scanner-container', 'scanner-barcode-result', 'scanner-spinner',
    'scanner-status-text', 'scanner-subtitle', 'scanner-not-found', 'scanner-confirmation',
    'scanner-camera-wrap', 'scanner-status', 'scanner-conf-name', 'scanner-conf-grams',
    'scanner-conf-kcal', 'scanner-conf-prot', 'scanner-conf-carb', 'scanner-conf-fat',
    'scanner-manual-code', 'btn-scanner-confirm', 'btn-scanner-retry-cam', 'phase-1', 'phase-2', 'phase-3',
  ];
  ids.forEach(id => elements.set(id, new ElementStub()));

  let scriptLoader = null;
  const documentRef = {
    visibilityState: 'visible',
    head: { appendChild: script => { scriptLoader = script; script.onload?.(); } },
    getElementById: id => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => new ElementStub(),
    createTextNode: text => ({ textContent: text }),
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: documentRef });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async () => ({ ok: true, json: async () => ({ status: 0 }) }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { vibrate() {} } });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, writable: true, value: { randomUUID } });
  delete globalThis.Html5Qrcode;

  App.user = { id: 'scanner-user', name: 'Ada' };
  App.todayDate = todayDate;
  App.todayLogs = [];
  App.currentDiaryDate = new Date('2026-09-01T12:00:00');
  App.currentPage = 'profile';
  App.diaryFollowsToday = false;
  resetScannerMachine(UI.ScannerState);
  UI.ScannerState.html5Qr = null;
  UI.ScannerState.cameraRunning = false;

  try {
    await callback({ storage, elements, documentRef, todayDate, get scriptLoader() { return scriptLoader; } });
  } finally {
    Object.assign(App, previousApp);
    Object.assign(UI.ScannerState, previousScannerState);
    for (const name of globals) {
      const descriptor = descriptors.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

function product(name = 'Barra de avena') {
  return {
    name,
    calories_per_100g: 200,
    protein_per_100g: 8,
    carbs_per_100g: 30,
    fat_per_100g: 5,
    fiber_per_100g: 4,
    sugar_per_100g: 6,
  };
}

test('scanner: la máquina permite una detección única y bloquea la siguiente antes de OFF', async () => {
  await withScannerEnvironment(async () => {
    setScannerPhase(ScannerPhase.SCANNING);
    let completeFetch;
    let fetchCount = 0;
    globalThis.fetch = () => {
      fetchCount += 1;
      return new Promise(resolve => { completeFetch = resolve; });
    };

    const firstDetection = UI._onBarcodeDetected('code-1');
    assert.equal(UI.ScannerState.phase, ScannerPhase.LOOKUP);
    assert.equal(UI.ScannerState.code, 'code-1');
    assert.equal(await UI._onBarcodeDetected('code-2'), false);
    await Promise.resolve();
    assert.equal(fetchCount, 1);

    completeFetch({ ok: true, json: async () => ({ status: 0 }) });
    assert.equal(await firstDetection, true);
    assert.equal(UI.ScannerState.phase, ScannerPhase.NOT_FOUND);
  });
});

test('scanner: reintento NOT_FOUND limpia el código y producto y reactiva SCANNING', async () => {
  await withScannerEnvironment(async ({ elements }) => {
    setScannerPhase(ScannerPhase.NOT_FOUND);
    UI.ScannerState.code = 'old-code';
    UI.ScannerState.pendingFood = product('Producto anterior');
    UI.ScannerState.pendingFoodSource = 'off';
    elements.get('scanner-manual-code').value = 'old-code';
    let starts = 0;
    globalThis.Html5Qrcode = class {
      async start() { starts += 1; }
      async stop() {}
    };

    assert.equal(await UI._retryBarcodeScanner(), true);
    await Promise.resolve();
    assert.equal(starts, 1);
    assert.equal(UI.ScannerState.phase, ScannerPhase.SCANNING);
    assert.equal(UI.ScannerState.code, null);
    assert.equal(UI.ScannerState.pendingFood, null);
    assert.equal(UI.ScannerState.pendingFoodSource, null);
    assert.equal(elements.get('scanner-manual-code').value, '');
  });
});

test('scanner: búsqueda manual y análisis de etiqueta respetan LOOKUP y LABEL_ANALYSIS', async () => {
  await withScannerEnvironment(async () => {
    setScannerPhase(ScannerPhase.NOT_FOUND);
    assert.equal(await UI._searchScannerBarcode('  manual-code  '), true);
    assert.equal(UI.ScannerState.code, 'manual-code');
    assert.equal(UI.ScannerState.phase, ScannerPhase.NOT_FOUND);

    assert.equal(await UI._beginScannerLabelAnalysis({ name: 'label.jpg' }), true);
    assert.equal(UI.ScannerState.phase, ScannerPhase.NOT_FOUND);

    setScannerPhase(ScannerPhase.LABEL_ANALYSIS);
    assert.equal(UI._registerScannedProduct(product('Etiqueta'), 100, 'ai_label'), true);
    assert.equal(UI.ScannerState.phase, ScannerPhase.CONFIRM);
    assert.equal(UI.ScannerState.pendingFoodSource, 'ai_label');
  });
});

test('scanner: SAVING deshabilita el botón, bloquea duplicados y conserva el producto al fallar', async () => {
  await withScannerEnvironment(async ({ elements }) => {
    setScannerPhase(ScannerPhase.LOOKUP);
    UI._registerScannedProduct(product(), 100, 'off');
    assert.equal(UI._scannerBeginSave(), true);
    assert.equal(UI.ScannerState.phase, ScannerPhase.SAVING);
    assert.equal(elements.get('btn-scanner-confirm').disabled, true);
    assert.equal(UI._scannerBeginSave(), false);
    assert.equal(await UI._executeRegisterScannedProduct(UI.ScannerState.pendingFood, 100, 'off'), false);

    assert.equal(UI._scannerFinishSave(false), true);
    assert.equal(UI.ScannerState.phase, ScannerPhase.CONFIRM);
    assert.equal(UI.ScannerState.pendingFood.name, 'Barra de avena');
    assert.equal(UI.ScannerState.pendingFoodSource, 'off');
    assert.equal(elements.get('btn-scanner-confirm').disabled, false);
  });
});

test('scanner: doble confirmación persiste un único FoodLog y consume el producto', async () => {
  await withScannerEnvironment(async ({ storage, elements, todayDate }) => {
    setScannerPhase(ScannerPhase.LOOKUP);
    UI.ScannerState.selectedMeal = 'lunch';
    UI._registerScannedProduct(product(), 100, 'off');
    const firstSave = UI._executeRegisterScannedProduct(UI.ScannerState.pendingFood, 100, 'off');
    const secondSave = UI._executeRegisterScannedProduct(UI.ScannerState.pendingFood, 100, 'off');

    assert.equal(await secondSave, false);
    assert.equal(await firstSave, true);
    const logs = JSON.parse(storage.getItem(`nt_food_logs_${todayDate}`));
    assert.equal(logs.length, 1);
    assert.equal(logs[0].date, todayDate);
    assert.equal(logs[0].meal_type, 'lunch');
    assert.equal(UI.ScannerState.phase, ScannerPhase.CLOSED);
    assert.equal(UI.ScannerState.pendingFood, null);
    assert.equal(elements.get('btn-scanner-confirm').disabled, false);
  });
});

test('scanner: fallo de persistencia vuelve a CONFIRM con el botón activo', async () => {
  await withScannerEnvironment(async ({ elements }) => {
    setScannerPhase(ScannerPhase.LOOKUP);
    UI._registerScannedProduct(product(), 100, 'off');
    const retainedFood = UI.ScannerState.pendingFood;
    const originalSet = LS.set;
    const originalConsoleError = console.error;
    LS.set = () => { throw new Error('storage unavailable'); };
    console.error = () => {};
    try {
      assert.equal(await UI._executeRegisterScannedProduct(retainedFood, 100, 'off'), false);
    } finally {
      LS.set = originalSet;
      console.error = originalConsoleError;
    }
    assert.equal(UI.ScannerState.phase, ScannerPhase.CONFIRM);
    assert.strictEqual(UI.ScannerState.pendingFood, retainedFood);
    assert.equal(elements.get('btn-scanner-confirm').disabled, false);
  });
});

test('scanner: cerrar y reabrir inicia una sesión limpia', async () => {
  await withScannerEnvironment(async ({ elements }) => {
    setScannerPhase(ScannerPhase.NOT_FOUND);
    UI.ScannerState.code = 'previous-code';
    UI.ScannerState.pendingFood = product('Producto viejo');
    await UI.closeScannerModal();
    assert.equal(UI.ScannerState.phase, ScannerPhase.CLOSED);
    assert.equal(UI.ScannerState.code, null);
    assert.equal(UI.ScannerState.pendingFood, null);

    let starts = 0;
    globalThis.Html5Qrcode = class {
      async start() { starts += 1; }
      async stop() {}
    };
    assert.equal(await UI.openScannerModal(), true);
    await Promise.resolve();
    assert.equal(starts, 1);
    assert.equal(UI.ScannerState.phase, ScannerPhase.SCANNING);
    assert.equal(UI.ScannerState.code, null);
    assert.equal(UI.ScannerState.pendingFood, null);
    assert.equal(elements.get('scanner-container').style.display, 'flex');
    await UI.closeScannerModal();
  });
});

test('scanner: transiciones inválidas se rechazan', () => {
  const machine = createScannerMachine();
  assert.equal(transitionScannerState(machine, ScannerPhase.LOOKUP), false);
  transitionScannerState(machine, ScannerPhase.STARTING);
  assert.equal(transitionScannerState(machine, ScannerPhase.CONFIRM), false);
  transitionScannerState(machine, ScannerPhase.SCANNING);
  assert.equal(transitionScannerState(machine, ScannerPhase.SAVING), false);
  assert.equal(retryScanner(machine), false);
});

test('scanner: tras reconciliar H13 usa App.todayDate, no la fecha histórica del diario', async () => {
  const RealDate = globalThis.Date;
  class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : ['2026-10-16T00:01:00'])); }
    static now() { return new RealDate('2026-10-16T00:01:00').getTime(); }
  }

  await withScannerEnvironment(async ({ storage }) => {
    globalThis.Date = FixedDate;
    try {
      storage.setItem('nt_last_active_date', JSON.stringify('2026-10-15'));
      storage.setItem('nt_food_logs_2026-10-15', JSON.stringify([{ id: 'yesterday', date: '2026-10-15' }]));
      App.todayDate = '2026-10-15';
      App.todayLogs = [{ id: 'stale-memory', date: '2026-10-15' }];
      App.currentDiaryDate = new RealDate('2026-09-01T12:00:00');
      App.diaryFollowsToday = false;
      setScannerPhase(ScannerPhase.LOOKUP);
      UI._registerScannedProduct(product('Snack actual'), 100, 'off');

      assert.equal(await UI._executeRegisterScannedProduct(UI.ScannerState.pendingFood, 100, 'off'), true);
      const logs = JSON.parse(storage.getItem('nt_food_logs_2026-10-16'));
      assert.equal(App.todayDate, '2026-10-16');
      assert.equal(logs.length, 1);
      assert.equal(logs[0].date, App.todayDate);
      assert.equal(UI.ScannerState.phase, ScannerPhase.CLOSED);
      assert.equal(App.currentDiaryDate.toISOString(), '2026-09-01T12:00:00.000Z');
    } finally {
      globalThis.Date = RealDate;
    }
  });
});
