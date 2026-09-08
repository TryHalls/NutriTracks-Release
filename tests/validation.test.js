import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AI_INPUT_MODES,
  FOOD_SOURCES,
  ValidationError,
  parseExternalNumber,
  parseUserNumber,
  validateFoodLog,
  validateProfile,
  validateWater,
  validateWeight,
} from '../www/js/modules/validation.js';

const normalLog = (overrides = {}) => ({
  id: 'log-1', user_id: 'user-1', date: '2026-09-08', meal_type: 'lunch',
  food_name: 'Arroz', quantity: 100, calories: 130, protein: 2.7,
  carbs: 28.2, fat: 0.3, fiber: 0.4, sugar: 0.1, source: 'local',
  ...overrides,
});

test('parseUserNumber aplica la política decimal y de agrupación completa', () => {
  const accepted = new Map([
    ['1,5', 1.5], ['1.5', 1.5], ['12,5', 12.5], ['12.5', 12.5], ['1.000', 1000], ['0.500', 0.5],
    ['1,000', 1], ['0,500', 0.5], ['1.234,56', 1234.56], ['1 234,56', 1234.56],
    ['1\u00a0234,56', 1234.56],
  ]);
  for (const [input, expected] of accepted) assert.equal(parseUserNumber(input), expected, input);
  for (const input of ['1,234.56', '1e3', '12abc', '.5', ',5', '12.', '12,', '1..2', '1  234']) {
    assert.equal(parseUserNumber(input), null, input);
  }
  assert.equal(parseUserNumber(12.5), 12.5);
  assert.equal(parseUserNumber(NaN), null);
  assert.equal(parseUserNumber(Infinity), null);
});

test('FoodLog normal exige quantity positiva, números canónicos y campos exactos', () => {
  assert.doesNotThrow(() => validateFoodLog(normalLog()));
  for (const quantity of [0, -1, '100', NaN, Infinity, null]) {
    assert.throws(() => validateFoodLog(normalLog({ quantity })), ValidationError, String(quantity));
  }
  assert.throws(() => validateFoodLog(normalLog({ protein: '2.7' })), ValidationError);
  assert.throws(() => validateFoodLog(normalLog({ surprise: true })), error => (
    error instanceof ValidationError && error.fieldErrors.some(item => item.field === 'surprise' && item.code === 'UNKNOWN_FIELD')
  ));
});

test('nutrientes distinguen null desconocido de cero conocido', () => {
  assert.doesNotThrow(() => validateFoodLog(normalLog({ protein: null, fiber: null })));
  assert.doesNotThrow(() => validateFoodLog(normalLog({ protein: 0, fiber: 0 })));
  assert.throws(() => validateFoodLog(normalLog({ calories: -1 })), ValidationError);
});

test('needsReview es metadato temporal y no forma parte de FoodLog', () => {
  assert.throws(() => validateFoodLog(normalLog({ needsReview: true })), error => (
    error instanceof ValidationError && error.fieldErrors.some(item => item.field === 'needsReview' && item.code === 'UNKNOWN_FIELD')
  ));
});

test('Quick Add sólo admite quantity null, manual, calorías positivas y macros cero', () => {
  const quick = normalLog({ food_name: 'Entrada rápida', quantity: null, calories: 250, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, source: 'manual' });
  assert.doesNotThrow(() => validateFoodLog(quick));
  assert.throws(() => validateFoodLog({ ...quick, quantity: 0 }), ValidationError);
  assert.throws(() => validateFoodLog({ ...quick, protein: null }), ValidationError);
  assert.throws(() => validateFoodLog({ ...quick, source: 'local' }), ValidationError);
});

test('source y ai_input_mode comparten enums e invariantes', () => {
  assert.deepEqual(FOOD_SOURCES, ['local', 'off', 'manual', 'ai', 'hybrid', 'ai_label']);
  assert.deepEqual(AI_INPUT_MODES, ['text', 'image', 'mixed']);
  assert.throws(() => validateFoodLog(normalLog({ source: 'ai' })), ValidationError);
  assert.doesNotThrow(() => validateFoodLog(normalLog({ source: 'ai', ai_input_mode: 'mixed' })));
  assert.doesNotThrow(() => validateFoodLog(normalLog({ source: 'ai_label', ai_input_mode: 'image' })));
  assert.throws(() => validateFoodLog(normalLog({ source: 'ai_label' })), ValidationError);
  assert.throws(() => validateFoodLog(normalLog({ source: 'ai_label', ai_input_mode: 'text' })), ValidationError);
  assert.throws(() => validateFoodLog(normalLog({ source: 'mystery' })), ValidationError);
});

test('perfil, peso y agua aplican límites defensivos sin coerción', () => {
  const profile = { name: 'Ada', gender: 'female', age: 34, weight: 64, height: 168, activity_level: 'moderate', goal: 'maintain' };
  assert.doesNotThrow(() => validateProfile(profile));
  assert.throws(() => validateProfile({ ...profile, age: '34' }), ValidationError);
  assert.doesNotThrow(() => validateWeight(64.5));
  assert.throws(() => validateWeight(-1), ValidationError);
  assert.doesNotThrow(() => validateWater(8));
  assert.throws(() => validateWater(1.5), ValidationError);
  assert.throws(() => validateWater('8'), ValidationError);
});

test('datos externos preservan missing/zero y marcan altos o inválidos', () => {
  assert.deepEqual(parseExternalNumber(undefined, 'protein'), { value: null, needsReview: false, error: null });
  assert.equal(parseExternalNumber('0', 'protein').value, 0);
  assert.equal(parseExternalNumber('150', 'protein').needsReview, true);
  assert.equal(parseExternalNumber('-1', 'protein').error.code, 'EXTERNAL_INVALID');
  assert.equal(parseExternalNumber('1e3', 'protein').error.code, 'EXTERNAL_INVALID');
});
