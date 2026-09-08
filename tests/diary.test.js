import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window ||= { Chart: function Chart() {}, lucide: { createIcons() {} } };
globalThis.window.Chart ||= function Chart() {};
globalThis.window.lucide ||= { createIcons() {} };
globalThis.lucide ||= globalThis.window.lucide;

const { App, LS } = await import('../www/js/modules/state.js');
const UI = await import('../www/js/modules/ui.js');

class ClassList {
  constructor(owner) { this.owner = owner; this.names = new Set(); }
  add(...names) { names.forEach(name => this.names.add(name)); this.sync(); }
  remove(...names) { names.forEach(name => this.names.delete(name)); this.sync(); }
  contains(name) { return this.names.has(name); }
  toggle(name, force) {
    const next = force === undefined ? !this.contains(name) : Boolean(force);
    if (next) this.names.add(name); else this.names.delete(name);
    this.sync();
    return next;
  }
  sync() { this.owner._className = [...this.names].join(' '); }
}

class ElementStub {
  constructor(tagName = 'div', fragment = false) {
    this.tagName = tagName;
    this.isFragment = fragment;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.value = '';
    this.parentElement = null;
    this._innerHTML = '';
    this._className = '';
    this.classList = new ClassList(this);
    this.virtual = new Map();
  }
  set className(value) {
    this._className = String(value || '');
    this.classList.names = new Set(this._className.split(/\s+/).filter(Boolean));
  }
  get className() { return this._className; }
  set innerHTML(value) { this._innerHTML = String(value); this.children = []; this.virtual.clear(); }
  get innerHTML() { return this._innerHTML; }
  appendChild(child) {
    if (child?.isFragment) {
      [...child.children].forEach(item => this.appendChild(item));
      child.children = [];
      return child;
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  querySelector(selector) {
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      const found = this.findByClass(className);
      if (found) return found;
      if (this._innerHTML.includes(className)) {
        if (!this.virtual.has(selector)) this.virtual.set(selector, new ElementStub('button'));
        return this.virtual.get(selector);
      }
    }
    return null;
  }
  findByClass(className) {
    for (const child of this.children) {
      if (child.classList?.contains(className)) return child;
      const nested = child.findByClass?.(className);
      if (nested) return nested;
    }
    return null;
  }
  querySelectorAll() { return []; }
  addEventListener() {}
  setAttribute() {}
  removeAttribute() {}
  focus() {}
  remove() {}
}

function food(id, mealType, calories, overrides = {}) {
  return {
    id,
    user_id: 'u1',
    date: '2026-09-01',
    meal_type: mealType,
    food_name: `Food ${id}`,
    quantity: 100,
    calories,
    protein: 2,
    carbs: 10,
    fat: 1,
    fiber: 0,
    sugar: 0,
    source: 'manual',
    ...overrides,
  };
}

function createDiaryDocument({ missingMeal = null } = {}) {
  const elements = new Map();
  const subtotals = new Map();
  const document = {
    body: new ElementStub('body'),
    head: new ElementStub('head'),
    getElementById: id => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: tag => new ElementStub(tag),
    createDocumentFragment: () => new ElementStub('#fragment', true),
    createTextNode: text => ({ textContent: text }),
  };

  elements.set('diary-date-label', new ElementStub('span'));
  elements.set('toast-container', new ElementStub('div'));
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) {
    if (meal === missingMeal) continue;
    const subtotal = new ElementStub('span');
    const section = new ElementStub('section');
    section.querySelector = selector => selector === '.meal-cal-display' ? subtotal : null;
    const list = new ElementStub('div');
    list.parentElement = section;
    elements.set(`food-list-${meal}`, list);
    subtotals.set(meal, subtotal);
  }

  for (const id of [
    'edit-food-modal', 'edit-food-name', 'edit-food-grams', 'edit-food-kcal',
    'edit-food-protein', 'edit-food-carbs', 'edit-food-fat', 'edit-food-fiber',
    'edit-food-sugar', 'edit-food-extra', 'edit-food-scale-note', 'edit-food-fav-btn',
  ]) elements.set(id, new ElementStub(id === 'edit-food-modal' ? 'div' : 'input'));

  return { document, elements, subtotals };
}

async function withDiaryEnvironment(callback, options = {}) {
  const previousDocument = globalThis.document;
  const previousConfirm = globalThis.confirm;
  const originalGet = LS.get;
  const originalSet = LS.set;
  const originalSetMany = LS.setMany;
  const dom = createDiaryDocument(options);
  const storage = new Map();
  const writes = [];

  globalThis.document = dom.document;
  globalThis.confirm = () => true;
  LS.get = (key, fallback = null) => storage.has(key) ? storage.get(key) : fallback;
  LS.set = (key, value) => { writes.push({ key, value }); storage.set(key, value); return true; };
  LS.setMany = values => { Object.entries(values).forEach(([key, value]) => storage.set(key, value)); return true; };
  App.user = { id: 'u1' };
  App.currentPage = 'diary';
  App.diaryLogs = [];

  try {
    return await callback({ ...dom, storage, writes });
  } finally {
    LS.get = originalGet;
    LS.set = originalSet;
    LS.setMany = originalSetMany;
    globalThis.document = previousDocument;
    globalThis.confirm = previousConfirm;
  }
}

function setDateStorage(storage, date, logs) {
  storage.set(`food_logs_${date}`, logs.map(log => ({ ...log, date })));
}

async function showDate(storage, date) {
  App.currentDiaryDate = new Date(`${date}T12:00:00`);
  assert.equal(await UI.refreshDiary(), true);
}

function renderedIds(elements, meal) {
  return (elements.get(`food-list-${meal}`)?.children || []).map(child => child.dataset.logId);
}

function renderedNames(elements, meal) {
  return (elements.get(`food-list-${meal}`)?.children || [])
    .map(child => child.children[0]?.innerHTML || '')
    .join(' ');
}

function snapshot(elements, subtotals) {
  return Object.fromEntries(['breakfast', 'lunch', 'dinner', 'snack'].map(meal => [meal, {
    ids: renderedIds(elements, meal),
    html: elements.get(`food-list-${meal}`)?.innerHTML,
    subtotal: subtotals.get(meal)?.textContent,
  }]));
}

test('H08: A con comidas → B vacío → A reconstruye el DOM y los subtotales', async () => {
  await withDiaryEnvironment(async ({ elements, subtotals, storage }) => {
    setDateStorage(storage, '2026-09-01', [food('a', 'breakfast', 120)]);
    setDateStorage(storage, '2026-09-02', []);
    await showDate(storage, '2026-09-01');
    await showDate(storage, '2026-09-02');
    assert.match(elements.get('food-list-breakfast').innerHTML, /Sin alimentos/);
    assert.equal(subtotals.get('breakfast').textContent, 0);
    await showDate(storage, '2026-09-01');
    assert.deepEqual(renderedIds(elements, 'breakfast'), ['a']);
    assert.equal(subtotals.get('breakfast').textContent, 120);
  });
});

test('H08: A vacío → B con comidas → A restaura las cuatro secciones vacías', async () => {
  await withDiaryEnvironment(async ({ elements, subtotals, storage }) => {
    setDateStorage(storage, '2026-09-01', []);
    setDateStorage(storage, '2026-09-02', [food('b', 'lunch', 210)]);
    await showDate(storage, '2026-09-01');
    await showDate(storage, '2026-09-02');
    await showDate(storage, '2026-09-01');
    for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) {
      assert.match(elements.get(`food-list-${meal}`).innerHTML, /Sin alimentos/);
      assert.equal(subtotals.get(meal).textContent, 0);
    }
  });
});

test('H08: A → B → A mantiene contenidos diferentes por fecha', async () => {
  await withDiaryEnvironment(async ({ elements, storage }) => {
    setDateStorage(storage, '2026-09-01', [food('a', 'breakfast', 100, { food_name: 'Arroz A' })]);
    setDateStorage(storage, '2026-09-02', [food('b', 'breakfast', 200, { food_name: 'Pollo B' })]);
    await showDate(storage, '2026-09-01');
    await showDate(storage, '2026-09-02');
    assert.match(renderedNames(elements, 'breakfast'), /Pollo B/);
    await showDate(storage, '2026-09-01');
    assert.match(renderedNames(elements, 'breakfast'), /Arroz A/);
    assert.doesNotMatch(renderedNames(elements, 'breakfast'), /Pollo B/);
  });
});

test('H08: A → B → C → A no reutiliza el DOM de otra fecha', async () => {
  await withDiaryEnvironment(async ({ elements, storage }) => {
    for (const [date, id, meal] of [
      ['2026-09-01', 'a', 'breakfast'],
      ['2026-09-02', 'b', 'lunch'],
      ['2026-09-03', 'c', 'dinner'],
    ]) setDateStorage(storage, date, [food(id, meal, 100)]);
    for (const date of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-01']) await showDate(storage, date);
    assert.deepEqual(renderedIds(elements, 'breakfast'), ['a']);
    assert.deepEqual(renderedIds(elements, 'lunch'), []);
    assert.deepEqual(renderedIds(elements, 'dinner'), []);
  });
});

test('H08: renderiza las cuatro comidas y calcula cada subtotal de forma independiente', async () => {
  await withDiaryEnvironment(async ({ elements, subtotals, storage }) => {
    setDateStorage(storage, '2026-09-01', [
      food('b1', 'breakfast', 10), food('b2', 'breakfast', 15),
      food('l', 'lunch', 20), food('d', 'dinner', 30), food('s', 'snack', 40),
    ]);
    await showDate(storage, '2026-09-01');
    assert.deepEqual(renderedIds(elements, 'breakfast'), ['b1', 'b2']);
    assert.deepEqual(Object.fromEntries([...subtotals].map(([meal, el]) => [meal, el.textContent])), {
      breakfast: 25, lunch: 20, dinner: 30, snack: 40,
    });
  });
});

test('H08: alta, edición, borrado y borrado del último elemento refrescan sin firmas', async () => {
  await withDiaryEnvironment(async ({ elements, subtotals, storage }) => {
    const date = '2026-09-01';
    setDateStorage(storage, date, []);
    await showDate(storage, date);

    const added = food('new', 'snack', 80, { date, food_name: 'Alta' });
    UI.saveFoodLogLocal(added);
    await UI.refreshDiary();
    assert.deepEqual(renderedIds(elements, 'snack'), ['new']);

    UI.openEditFoodModal('new');
    elements.get('edit-food-name').value = 'Editado';
    elements.get('edit-food-grams').value = '150';
    elements.get('edit-food-kcal').value = '95';
    elements.get('edit-food-protein').value = '3';
    elements.get('edit-food-carbs').value = '11';
    elements.get('edit-food-fat').value = '2';
    assert.equal(await UI.saveEditedFoodLog(), true);
    assert.match(renderedNames(elements, 'snack'), /Editado/);
    assert.equal(subtotals.get('snack').textContent, 95);

    assert.equal(await UI.deleteFoodLog('new'), true);
    assert.deepEqual(renderedIds(elements, 'snack'), []);
    assert.match(elements.get('food-list-snack').innerHTML, /Sin alimentos/);
    assert.equal(subtotals.get('snack').textContent, 0);
    assert.deepEqual(storage.get(`food_logs_${date}`), []);
  });
});

test('H08: strings numéricos se suman y valores no finitos se excluyen sin romper tarjetas', async () => {
  await withDiaryEnvironment(async ({ elements, subtotals, storage }) => {
    setDateStorage(storage, '2026-09-01', [
      food('a', 'breakfast', '120'),
      food('b', 'breakfast', '80'),
      food('bad', 'breakfast', 'no-numérico', { protein: 'Infinity' }),
    ]);
    await showDate(storage, '2026-09-01');
    assert.equal(subtotals.get('breakfast').textContent, 200);
    assert.match(renderedNames(elements, 'breakfast'), /120 kcal/);
    assert.match(renderedNames(elements, 'breakfast'), /—/);
    assert.deepEqual(UI.computeTotals(App.diaryLogs), {
      calories: 200, protein: 4, carbs: 30, fat: 3, fiber: 0, sugar: 0,
    });
  });
});

test('H08: dos renders idénticos son idempotentes en contenido', async () => {
  await withDiaryEnvironment(async ({ elements, subtotals, storage }) => {
    setDateStorage(storage, '2026-09-01', [food('same', 'lunch', 75)]);
    await showDate(storage, '2026-09-01');
    const first = snapshot(elements, subtotals);
    await showDate(storage, '2026-09-01');
    assert.deepEqual(snapshot(elements, subtotals), first);
  });
});

test('H08: un contenedor ausente no impide actualizar los demás', async () => {
  await withDiaryEnvironment(async ({ elements, subtotals, storage }) => {
    setDateStorage(storage, '2026-09-01', [
      food('breakfast', 'breakfast', 10),
      food('lunch', 'lunch', 20),
      food('dinner', 'dinner', 30),
      food('snack', 'snack', 40),
    ]);
    await showDate(storage, '2026-09-01');
    assert.equal(elements.get('food-list-lunch'), undefined);
    assert.deepEqual(renderedIds(elements, 'breakfast'), ['breakfast']);
    assert.deepEqual(renderedIds(elements, 'dinner'), ['dinner']);
    assert.deepEqual(renderedIds(elements, 'snack'), ['snack']);
    assert.equal(subtotals.get('snack').textContent, 40);
  }, { missingMeal: 'lunch' });
});

test('H10: frontera FoodLog rechaza inválidos sin escribir y acepta Quick Add null', async () => {
  await withDiaryEnvironment(async ({ storage }) => {
    const date = '2026-09-01';
    const key = `food_logs_${date}`;
    for (const quantity of [-1, NaN, Infinity, '100']) {
      assert.throws(() => UI.saveFoodLogLocal(food(`bad-${String(quantity)}`, 'lunch', 100, { date, quantity })));
      assert.equal(storage.has(key), false);
    }
    const quick = food('quick', 'snack', 250, {
      date, food_name: 'Entrada rápida', quantity: null,
      protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, source: 'manual',
    });
    assert.equal(UI.saveFoodLogLocal(quick), true);
    assert.equal(storage.get(key)[0].quantity, null);
    assert.throws(() => UI.saveFoodLogLocal(food('null-normal', 'lunch', 100, { date, quantity: null })));
    assert.equal(storage.get(key).length, 1);
  });
});

test('H10: lote IA valida todo antes de una única escritura lógica', async () => {
  await withDiaryEnvironment(async ({ storage, writes }) => {
    const date = '2026-09-01';
    const key = `food_logs_${date}`;
    const legacy = food('legacy', 'breakfast', '120', { date, quantity: '100' });
    storage.set(key, [legacy]);
    const valid = food('ai-ok', 'lunch', 200, { date, source: 'ai', ai_input_mode: 'text' });
    const invalid = food('ai-bad', 'lunch', 200, { date, source: 'ai', ai_input_mode: 'text', fat: Infinity });
    assert.throws(() => UI.saveFoodLogsLocal([valid, invalid]));
    assert.deepEqual(storage.get(key), [legacy]);
    assert.equal(writes.length, 0);
    assert.equal(UI.saveFoodLogsLocal([valid]), true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, key);
    assert.deepEqual(storage.get(key), [legacy, valid]);
  });
});
