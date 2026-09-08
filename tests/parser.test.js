import assert from 'node:assert/strict';
import test from 'node:test';

import { smartOfflineAnalyzeText, splitByConnectors } from '../www/js/modules/utils.js';

function foods(text) { return smartOfflineAnalyzeText(text)?.alimentos || []; }

test('parser conserva decimales, miles españoles y convierte unidades', () => {
  for (const [text, grams] of [
    ['1,5 kg de arroz', 1500], ['1.5 kg de arroz', 1500],
    ['0,5 litros de leche', 500], ['0.5 litros de leche', 500],
    ['250,5 g de arroz', 250.5], ['100 g de arroz', 100],
    ['2 huevos', 100], ['3 plátanos', 360], ['1.000 g de arroz', 1000],
  ]) assert.equal(foods(text)[0]?.gramos_estimados, grams, text);
});

test('parser distingue coma decimal de coma conectora', () => {
  assert.deepEqual(splitByConnectors('100,5 g arroz, 200 g pollo'), ['100,5 g arroz', '200 g pollo']);
  assert.deepEqual(splitByConnectors('arroz, 1,5 kg pollo'), ['arroz', '1,5 kg pollo']);
  assert.equal(foods('arroz, pollo').length, 2);
});

test('parser consolida sólo repeticiones explícitas convertibles', () => {
  const rice = foods('100 g arroz y 200 g arroz');
  assert.equal(rice.length, 1);
  assert.equal(rice[0].gramos_estimados, 300);
  assert.equal(rice[0].consolidatedOccurrences, 2);

  const eggs = foods('1 huevo y 2 huevos');
  assert.equal(eggs.length, 1);
  assert.equal(eggs[0].gramos_estimados, 150);
  assert.match(eggs[0].cantidad_estimada, /3 unidades/);

  const distinct = foods('100 g arroz y 200 g pollo');
  assert.equal(distinct.length, 2);
  assert.deepEqual(distinct.map(item => item.gramos_estimados), [100, 200]);

  const estimated = foods('arroz y arroz');
  assert.equal(estimated.length, 2);
  assert.ok(estimated.every(item => item.needsReview));
});

test('parser produce candidatos revisables y bloquea unidad desconocida', () => {
  for (const text of ['comí arroz', 'arroz']) {
    const candidate = foods(text)[0];
    assert.equal(candidate.needsReview, true);
    assert.equal(candidate.quantityExplicit, false);
  }
  assert.equal(smartOfflineAnalyzeText('2'), null);
  const unknown = foods('2 xyz de arroz')[0];
  assert.equal(unknown.needsReview, true);
  assert.equal(unknown.blocking, true);
  assert.equal(unknown.gramos_estimados, null);
});

test('pluralización controlada reconoce aliases simples del catálogo', () => {
  assert.match(foods('3 plátanos')[0]?.alimento || '', /Plátano/);
  assert.match(foods('2 huevos')[0]?.alimento || '', /Huevo/);
  assert.match(foods('2 tomates')[0]?.alimento || '', /Tomate/);
});
