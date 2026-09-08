import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

class ClassList {
  constructor(...names) { this.names = new Set(names); }
  add(...names) { names.forEach((name) => this.names.add(name)); }
  remove(...names) { names.forEach((name) => this.names.delete(name)); }
  contains(name) { return this.names.has(name); }
  toggle(name, force) {
    const next = force === undefined ? !this.contains(name) : !!force;
    if (next) this.add(name); else this.remove(name);
    return next;
  }
}

class ElementStub {
  constructor({ value = '', classes = [] } = {}) {
    this.value = value;
    this.textContent = '';
    this.innerHTML = '';
    this.style = {};
    this.classList = new ClassList(...classes);
    this.children = [];
    this.dataset = {};
  }
  appendChild(child) { this.children.push(child); return child; }
  remove() {}
  focus() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  setAttribute() {}
  removeAttribute() {}
}

const elements = new Map();
const body = new ElementStub();
globalThis.window = {
  Chart: function Chart() {},
  lucide: { createIcons() {} },
  requestIdleCallback() {},
};
globalThis.crypto = { randomUUID };
globalThis.lucide = window.lucide;
globalThis.document = {
  body,
  getElementById: (id) => elements.get(id) || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => new ElementStub(),
  createTextNode: (text) => ({ textContent: text }),
  createDocumentFragment: () => new ElementStub(),
};

const nativeSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (...args) => {
  const timer = nativeSetTimeout(...args);
  timer.unref?.();
  return timer;
};

const { App, LS } = await import('../www/js/modules/state.js');
const UI = await import('../www/js/modules/ui.js');
const API = await import('../www/js/modules/api.js');

function element(id, options) {
  const value = new ElementStub(options);
  elements.set(id, value);
  return value;
}

function resetDOM() {
  elements.clear();
  body.classList = new ClassList();
  element('toast-container');
}

function toastTypes() {
  return elements.get('toast-container').children.map((toast) => toast.className.split(' ')[1]);
}

async function withLS(overrides, callback) {
  const originals = {};
  const originalError = console.error;
  const originalWarn = console.warn;
  for (const [name, replacement] of Object.entries(overrides)) {
    originals[name] = LS[name];
    LS[name] = replacement;
  }
  console.error = () => {};
  console.warn = () => {};
  try {
    return await callback();
  } finally {
    Object.assign(LS, originals);
    console.error = originalError;
    console.warn = originalWarn;
  }
}

const persistenceFailure = () => { throw new Error('simulated persistence failure'); };

test('comida: un fallo conserva modal/selección y muestra solo error', async () => {
  resetDOM();
  const modal = element('food-modal', { classes: ['open'] });
  element('qty-input', { value: '100' });
  App.selectedFood = {
    name: 'Arroz', calories_per_100g: 100, protein_per_100g: 2,
    carbs_per_100g: 20, fat_per_100g: 1,
  };
  App.currentDiaryDate = new Date('2026-09-07T12:00:00');
  const selected = App.selectedFood;

  const result = await withLS({ get: () => [], set: persistenceFailure }, () => UI.confirmAddFood());
  assert.equal(result, false);
  assert.equal(App.selectedFood, selected);
  assert.equal(modal.classList.contains('open'), true);
  assert.deepEqual(toastTypes(), ['error']);
});

test('agua: un fallo no cambia App ni pinta éxito', async () => {
  resetDOM();
  App.user = { water_goal: 8 };
  App.todayWater = 2;
  const result = await withLS({ set: persistenceFailure }, () => UI.addWater());
  assert.equal(result, false);
  assert.equal(App.todayWater, 2);
  assert.deepEqual(toastTypes(), ['error']);
});

test('peso: setMany fallido conserva usuario e input', async () => {
  resetDOM();
  const input = element('log-weight-input', { value: '70' });
  const user = { id: 'u1', weight: 68 };
  App.user = user;
  const result = await withLS({ get: () => [], setMany: persistenceFailure }, () => UI.logWeight());
  assert.equal(result, false);
  assert.equal(App.user, user);
  assert.equal(input.value, '70');
  assert.deepEqual(toastTypes(), ['error']);
});

test('perfil: fallo conserva App, formulario e inputs útiles', async () => {
  resetDOM();
  element('edit-name', { value: 'Ada nueva' });
  element('edit-age', { value: '34' });
  element('edit-height', { value: '168' });
  element('edit-weight', { value: '64' });
  element('edit-activity', { value: 'moderate' });
  element('edit-goal', { value: 'maintain' });
  const form = element('edit-profile-form', { classes: ['open'] });
  const user = { id: 'u1', name: 'Ada', gender: 'female', weight: 65 };
  App.user = user;

  const result = await withLS({ setUser: persistenceFailure }, () => UI.saveProfile());
  assert.equal(result, false);
  assert.equal(App.user, user);
  assert.equal(form.classList.contains('open'), true);
  assert.equal(elements.get('edit-name').value, 'Ada nueva');
  assert.deepEqual(toastTypes(), ['error']);
});

test('onboarding: fallo transaccional no abandona pantalla ni asigna usuario', async () => {
  resetDOM();
  element('ob-age', { value: '34' });
  element('ob-height', { value: '168' });
  element('ob-weight', { value: '64' });
  const screen = element('onboarding-screen');
  element('app', { classes: ['hidden'] });
  Object.assign(UI.ob, {
    name: 'Ada', gender: 'female', age: 34, height: 168,
    weight: 64, activity: 'moderate', goal: 'maintain',
  });
  App.user = null;

  const result = await withLS({ setMany: persistenceFailure }, () => UI.finishOnboarding());
  assert.equal(result, false);
  assert.equal(App.user, null);
  assert.equal(screen.classList.contains('hidden'), false);
  assert.deepEqual(toastTypes(), ['error']);
});

test('favoritos: fallo no muta el array leído ni muestra éxito', async () => {
  resetDOM();
  const persisted = [{ id: 'f1', food_name: 'Yogur' }];
  const food = { food_name: 'Arroz', quantity: 100, calories: 100, protein: 2, carbs: 20, fat: 1 };
  const result = await withLS({
    get: (key, fallback) => key === 'favorites' ? persisted : fallback,
    setMany: persistenceFailure,
  }, () => UI.toggleFavorite(food));
  assert.equal(result, false);
  assert.deepEqual(persisted, [{ id: 'f1', food_name: 'Yogur' }]);
  assert.deepEqual(toastTypes(), ['error']);
});

test('favoritos: migra exactamente nt_nt_favorites sin borrar la clave canonical', async () => {
  resetDOM();
  const legacy = [{ id: 'legacy', food_name: 'Arepa' }];
  let transaction = null;
  const result = await withLS({
    get: (key, fallback) => key === 'favorites' ? null : key === 'nt_favorites' ? legacy : fallback,
    setMany: (values, options) => { transaction = { values, options }; return true; },
  }, () => UI.getFavorites({ strict: true }));
  assert.deepEqual(result, legacy);
  assert.deepEqual(transaction, {
    values: { favorites: legacy },
    options: { remove: ['nt_favorites'] },
  });
});

test('configuración IA: fallo no anuncia IA activa ni éxito', async () => {
  resetDOM();
  element('ai-api-key-input', { value: 'private-key' });
  const status = element('ai-status-text');
  const result = await withLS({ set: persistenceFailure }, () => API.saveAIConfig());
  assert.equal(result, false);
  assert.equal(status.textContent, '');
  assert.deepEqual(toastTypes(), ['error']);
});

test('H14: el acceso rápido usa UI.getSelectedAIMeal y abre el modal para la comida seleccionada', () => {
  resetDOM();
  const modal = element('food-modal');
  element('modal-meal-title');
  element('food-search-input');
  element('qty-picker-section');
  element('quick-cal-input');
  element('food-search-results');
  App.selectedAIMeal = 'dinner';

  UI.openAddFood(null, UI.getSelectedAIMeal());

  assert.equal(App.currentMealType, 'dinner');
  assert.equal(elements.get('modal-meal-title').textContent, 'Añadir a Cena');
  assert.equal(modal.classList.contains('open'), true);

  const script = readFileSync(new URL('../www/js/script.js', import.meta.url), 'utf8');
  assert.match(script, /UI\.openAddFood\(null, UI\.getSelectedAIMeal\(\)\)/);
  assert.doesNotMatch(script, /(?<![.\w$])getSelectedAIMeal\s*\(/);
  assert.doesNotMatch(script, /window\.getSelectedAIMeal\s*=/);
});

test('tema: fallo mantiene el tema anterior', async () => {
  resetDOM();
  body.classList.add('dark-theme');
  const result = await withLS({ set: persistenceFailure }, () => UI.toggleDarkMode());
  assert.equal(result, false);
  assert.equal(body.classList.contains('dark-theme'), true);
  assert.deepEqual(toastTypes(), ['error']);
});

test('caché IA: fallo se limita a la optimización y no genera feedback nutricional', async () => {
  resetDOM();
  const result = await withLS({ get: () => ({}), set: persistenceFailure }, () => (
    API.setCachedAIAnalysis('arroz', { alimentos: [{ alimento: 'Arroz' }] })
  ));
  assert.equal(result, false);
  assert.deepEqual(toastTypes(), []);
});
