/* NutriTracks validation boundary: parsing is explicit; persistence is strict. */

export const FOOD_SOURCES = Object.freeze(['local', 'off', 'manual', 'ai', 'hybrid', 'ai_label']);
export const AI_INPUT_MODES = Object.freeze(['text', 'image', 'mixed']);
export const MEAL_TYPES = Object.freeze(['breakfast', 'lunch', 'dinner', 'snack']);
export const GENDERS = Object.freeze(['male', 'female']);
export const ACTIVITY_LEVELS = Object.freeze(['sedentary', 'light', 'moderate', 'active', 'very_active']);
export const GOALS = Object.freeze(['lose_weight', 'maintain', 'gain_muscle']);

export const VALIDATION_LIMITS = Object.freeze({
  string: 500,
  id: 200,
  foodName: 300,
  quantity: 1_000_000,
  nutrient: 1_000_000,
  calories: 1_000_000,
  age: Object.freeze({ min: 12, max: 100 }),
  weight: Object.freeze({ min: 20, max: 300 }),
  height: Object.freeze({ min: 100, max: 250 }),
  water: Object.freeze({ min: 0, max: 1000 }),
  externalReview: Object.freeze({
    quantity: 5_000, calories: 5_000, nutrient: 1_000,
    protein: 100, carbs: 100, fat: 100, fiber: 100, sugar: 100,
  }),
});

export const FOOD_LOG_FIELDS = Object.freeze([
  'id', 'user_id', 'date', 'meal_type', 'food_name', 'quantity', 'calories',
  'protein', 'carbs', 'fat', 'fiber', 'sugar', 'source', 'ai_input_mode',
]);

export class ValidationError extends Error {
  constructor(message, fieldErrors = []) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_FAILED';
    this.fieldErrors = fieldErrors.map(error => Object.freeze({ ...error }));
    this.fields = Object.freeze(Object.fromEntries(this.fieldErrors.map(error => [error.field, error])));
  }
}

function issue(field, code, message, value) {
  return { field, code, message, ...(value === undefined ? {} : { value }) };
}

function throwIssues(errors, message = 'Los datos no cumplen el contrato de validación.') {
  if (errors.length) throw new ValidationError(message, errors);
}

export function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Parses a complete user-entered number using the approved Spanish policy.
 * A dot followed by exactly three digits is a thousands separator unless the
 * integer part is zero; comma-only input always uses a decimal comma.
 */
export function parseUserNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const input = value.replace(/\u00a0/g, ' ').trim();
  if (!input || /[eE]/.test(input)) return null;

  const signMatch = /^([+-]?)(.*)$/.exec(input);
  const sign = signMatch[1] === '-' ? -1 : 1;
  let body = signMatch[2];
  if (!body || !/^\d[\d., ]*\d$|^\d$/.test(body)) return null;
  if (/ {2,}/.test(body)) return null;

  if (body.includes(' ')) {
    const commas = (body.match(/,/g) || []).length;
    const dots = (body.match(/\./g) || []).length;
    if (commas > 1 || dots > 1 || (commas && dots)) return null;
    const separator = commas ? ',' : dots ? '.' : null;
    const [integerPart, decimalPart] = separator ? body.split(separator) : [body, null];
    if (!/^\d{1,3}(?: \d{3})+$/.test(integerPart)) return null;
    if (decimalPart !== null && !/^\d+$/.test(decimalPart)) return null;
    const normalizedGrouped = integerPart.replace(/ /g, '') + (decimalPart === null ? '' : `.${decimalPart}`);
    const parsedGrouped = sign * Number(normalizedGrouped);
    return Number.isFinite(parsedGrouped) ? parsedGrouped : null;
  }

  const commaCount = (body.match(/,/g) || []).length;
  const dotCount = (body.match(/\./g) || []).length;
  let normalized;

  if (commaCount && dotCount) {
    // Only Spanish grouped form is supported: 1.234,56. US mixed form fails.
    if (commaCount !== 1 || body.lastIndexOf('.') > body.indexOf(',')) return null;
    const [integerPart, decimalPart] = body.split(',');
    if (!/^\d{1,3}(?:\.\d{3})+$/.test(integerPart) || !/^\d+$/.test(decimalPart)) return null;
    normalized = `${integerPart.replace(/\./g, '')}.${decimalPart}`;
  } else if (commaCount) {
    if (commaCount !== 1) return null;
    const [integerPart, decimalPart] = body.split(',');
    if (!/^\d+$/.test(integerPart) || !/^\d+$/.test(decimalPart)) return null;
    normalized = `${integerPart}.${decimalPart}`;
  } else if (dotCount) {
    if (dotCount > 1) {
      if (!/^\d{1,3}(?:\.\d{3})+$/.test(body)) return null;
      normalized = body.replace(/\./g, '');
    } else {
      const [integerPart, fractionalPart] = body.split('.');
      if (!/^\d+$/.test(integerPart) || !/^\d+$/.test(fractionalPart)) return null;
      const groupedThousands = fractionalPart.length === 3 && integerPart !== '0' && integerPart.length <= 3;
      normalized = groupedThousands ? integerPart + fractionalPart : `${integerPart}.${fractionalPart}`;
    }
  } else {
    if (!/^\d+$/.test(body)) return null;
    normalized = body;
  }

  const parsed = sign * Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isValidDateString(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function checkString(errors, field, value, { min = 1, max = VALIDATION_LIMITS.string } = {}) {
  if (typeof value !== 'string') errors.push(issue(field, 'TYPE', 'Debe ser texto.', value));
  else if (value.length < min || value.length > max || (min > 0 && !value.trim())) errors.push(issue(field, 'RANGE', 'Longitud no permitida.', value));
}

function checkNumber(errors, field, value, { min = 0, max = VALIDATION_LIMITS.nutrient, nullable = false, integer = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(issue(field, 'TYPE', 'Debe ser un número finito; no se aceptan strings numéricos.', value));
  } else if (value < min || value > max) {
    errors.push(issue(field, 'RANGE', `Debe estar entre ${min} y ${max}.`, value));
  } else if (integer && !Number.isInteger(value)) {
    errors.push(issue(field, 'INTEGER', 'Debe ser un entero.', value));
  }
}

function checkEnum(errors, field, value, allowed) {
  if (!allowed.includes(value)) errors.push(issue(field, 'ENUM', `Valor no permitido: ${String(value)}.`, value));
}

export function isLegacyQuickAdd(log) {
  return isPlainRecord(log) && log.quantity === 0 && log.source === 'manual' &&
    typeof log.calories === 'number' && Number.isFinite(log.calories) && log.calories > 0 &&
    ['protein', 'carbs', 'fat', 'fiber', 'sugar'].every(field => log[field] === 0);
}

export function isQuickAdd(log) {
  return isPlainRecord(log) && log.quantity === null && log.source === 'manual' &&
    typeof log.calories === 'number' && Number.isFinite(log.calories) && log.calories > 0 &&
    ['protein', 'carbs', 'fat', 'fiber', 'sugar'].every(field => log[field] === 0);
}

export function validateFoodLog(log, { keyDate, allowLegacyMissingAIInputMode = false } = {}) {
  const errors = [];
  if (!isPlainRecord(log)) throw new ValidationError('FoodLog debe ser un objeto.', [issue('$', 'TYPE', 'Debe ser un objeto.', log)]);

  const keys = Object.keys(log);
  const allowed = new Set(FOOD_LOG_FIELDS);
  keys.forEach(field => { if (!allowed.has(field)) errors.push(issue(field, 'UNKNOWN_FIELD', 'Campo no permitido.')); });
  FOOD_LOG_FIELDS.filter(field => field !== 'ai_input_mode').forEach(field => {
    if (!Object.hasOwn(log, field)) errors.push(issue(field, 'REQUIRED', 'Campo obligatorio.'));
  });

  checkString(errors, 'id', log.id, { max: VALIDATION_LIMITS.id });
  checkString(errors, 'user_id', log.user_id, { max: VALIDATION_LIMITS.id });
  if (!isValidDateString(log.date)) errors.push(issue('date', 'DATE', 'Debe ser una fecha real YYYY-MM-DD.', log.date));
  if (keyDate !== undefined && log.date !== keyDate) errors.push(issue('date', 'DATE_KEY_MISMATCH', 'No coincide con la clave diaria.', log.date));
  checkEnum(errors, 'meal_type', log.meal_type, MEAL_TYPES);
  checkString(errors, 'food_name', log.food_name, { max: VALIDATION_LIMITS.foodName });
  checkEnum(errors, 'source', log.source, FOOD_SOURCES);

  if (log.quantity === null) {
    if (!isQuickAdd(log)) errors.push(issue('quantity', 'QUICK_ADD_INVARIANT', 'quantity null sólo es válida para Quick Add manual.', log.quantity));
  } else {
    checkNumber(errors, 'quantity', log.quantity, { min: Number.MIN_VALUE, max: VALIDATION_LIMITS.quantity });
  }

  checkNumber(errors, 'calories', log.calories, { max: VALIDATION_LIMITS.calories, nullable: log.quantity !== null });
  for (const field of ['protein', 'carbs', 'fat', 'fiber', 'sugar']) {
    checkNumber(errors, field, log[field], { max: VALIDATION_LIMITS.nutrient, nullable: log.quantity !== null });
  }

  const hasMode = Object.hasOwn(log, 'ai_input_mode');
  if (hasMode) checkEnum(errors, 'ai_input_mode', log.ai_input_mode, AI_INPUT_MODES);
  if (['ai', 'hybrid', 'ai_label'].includes(log.source) && !hasMode && !allowLegacyMissingAIInputMode) {
    errors.push(issue('ai_input_mode', 'REQUIRED', 'Obligatorio para source ai/hybrid/ai_label.'));
  }
  if (log.source === 'ai_label' && hasMode && log.ai_input_mode !== 'image') {
    errors.push(issue('ai_input_mode', 'INVARIANT', 'ai_label sólo admite image.', log.ai_input_mode));
  }

  throwIssues(errors, 'FoodLog inválido.');
  return log;
}

export function validateProfile(profile) {
  const errors = [];
  if (!isPlainRecord(profile)) throw new ValidationError('Perfil inválido.', [issue('$', 'TYPE', 'Debe ser un objeto.')]);
  checkString(errors, 'name', profile.name, { max: 200 });
  checkEnum(errors, 'gender', profile.gender, GENDERS);
  checkNumber(errors, 'age', profile.age, { ...VALIDATION_LIMITS.age });
  checkNumber(errors, 'weight', profile.weight, { ...VALIDATION_LIMITS.weight });
  checkNumber(errors, 'height', profile.height, { ...VALIDATION_LIMITS.height });
  checkEnum(errors, 'activity_level', profile.activity_level, ACTIVITY_LEVELS);
  checkEnum(errors, 'goal', profile.goal, GOALS);
  throwIssues(errors, 'Perfil inválido.');
  return profile;
}

export function validateWeight(value) {
  const errors = [];
  checkNumber(errors, 'weight', value, { ...VALIDATION_LIMITS.weight });
  throwIssues(errors, 'Peso inválido.');
  return value;
}

export function validateWater(value) {
  const errors = [];
  checkNumber(errors, 'water', value, { ...VALIDATION_LIMITS.water, integer: true });
  throwIssues(errors, 'Agua inválida.');
  return value;
}

export function parseExternalNumber(value, field, { nullable = true, max, reviewAbove } = {}) {
  if ((value === null || value === undefined || value === '') && nullable) {
    return { value: null, needsReview: false, error: null };
  }
  const parsed = parseUserNumber(value);
  const effectiveMax = max ?? (field === 'quantity' ? VALIDATION_LIMITS.quantity : field === 'calories' ? VALIDATION_LIMITS.calories : VALIDATION_LIMITS.nutrient);
  if (parsed === null || parsed < 0 || parsed > effectiveMax) {
    return { value: null, needsReview: true, error: issue(field, 'EXTERNAL_INVALID', 'Valor externo inválido.', value) };
  }
  const threshold = reviewAbove ?? VALIDATION_LIMITS.externalReview[field] ?? VALIDATION_LIMITS.externalReview.nutrient;
  return { value: parsed, needsReview: parsed > threshold, error: null };
}
