import { App, LS } from './state.js';
import { LOCAL_FOOD_DB, SYNONYMS_MAP } from './db.js';
import { parseExternalNumber, parseUserNumber } from './validation.js';

export function getLocalDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toDateStr(date) {
  return getLocalDateString(date);
}

export function formatDateLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  const today = toDateStr(new Date());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yest = toDateStr(yesterday);

  const ds = toDateStr(d);
  if (ds === today) return 'Hoy';
  if (ds === yest) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/* ──────────────────────────────────────────────────────────────
   DETECCIÓN DE CAMBIO DE DÍA (reinicio automático de contadores)
   ────────────────────────────────────────────────────────────── */
export function checkAndResetForNewDay() {
  const lastDate = LS.get('last_active_date', null);
  const todayStr = toDateStr(new Date());
  const changedDay = lastDate && lastDate !== todayStr;
  // La fecha activa se confirma antes de reflejar el cambio en memoria.
  LS.set('last_active_date', todayStr);
  if (changedDay) {
    // Los registros de comida y agua son por fecha → se reinician solos.
    // Actualizamos App.todayWater para reflejar el nuevo día.
    App.todayWater = 0;
    console.info('[App] ✦ Nuevo día detectado. Contadores reiniciados.');
  }
  return changedDay;
}
export function calculateBMR(gender, age, weight, height) {
  return gender === 'male'
    ? 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    : 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
}
export function calculateTDEE(bmr, activity) {
  const m = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  return bmr * (m[activity] || 1.55);
}
export function calculateDailyCalories(tdee, goal) {
  const adj = { lose_weight: -500, maintain: 0, gain_muscle: +300 };
  return Math.max(1200, Math.round(tdee + (adj[goal] || 0)));
}
export function calculateMacros(dailyCal, goal) {
  const r = {
    lose_weight: { protein: .35, carbs: .40, fat: .25 },
    maintain: { protein: .30, carbs: .45, fat: .25 },
    gain_muscle: { protein: .35, carbs: .45, fat: .20 }
  }[goal] || { protein: .30, carbs: .45, fat: .25 };
  return {
    protein: Math.round((dailyCal * r.protein) / 4),
    carbs: Math.round((dailyCal * r.carbs) / 4),
    fat: Math.round((dailyCal * r.fat) / 9)
  };
}
export function goalLabel(goal) {
  return { lose_weight: 'Perder peso', maintain: 'Mantener peso', gain_muscle: 'Ganar músculo' }[goal] || goal;
}
export function activityLabel(level) {
  return { sedentary: 'Sedentario', light: 'Ligero', moderate: 'Moderado', active: 'Activo', very_active: 'Muy activo' }[level] || level;
}
export function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  /* P0 Optimización: DP de 2 filas (antes asignaba una matriz (m+1)×(n+1)
     por comparación; en el análisis IA eran miles de matrices por llamada). */
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n];
}

/**
 * Similitud [0,1] entre dos cadenas (1 = idénticas).
 */
export function fuzzyScore(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return (maxLen - levenshteinDistance(a, b)) / maxLen;
}

/**
 * Normaliza texto para búsqueda: minúsculas, sin acentos, sin especiales.
 */
export function normalizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/1\/2/g, ' medio ')
    .replace(/1\/4/g, ' cuarto ')
    .replace(/3\/4/g, ' tres cuartos ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── P0 Optimización: reglas de sinónimos PRECOMPILADAS una sola vez al cargar.
   Antes se reordenaban y se compilaban ~228 regex en CADA llamada (cada búsqueda
   y cada análisis IA). Ahora la normalización y compilación ocurre 1 única vez. ── */
const _SYNONYM_RULES = (() => {
  const rules = [];
  for (const [synonym, standard] of Object.entries(SYNONYMS_MAP)) {
    const normSyn = normalizeSearchText(synonym);
    const normStd = normalizeSearchText(standard);
    if (!normSyn || !normStd || normSyn === normStd) continue;
    rules.push({
      len: synonym.length,
      rx: new RegExp(`\\b${escapeRegExp(normSyn)}\\b`, 'g'),
      std: normStd,
    });
  }
  /* Ordenamos por longitud desc para que términos largos tengan prioridad */
  return rules.sort((a, b) => b.len - a.len);
})();

/**
 * Aplica el mapa de sinónimos para estandarizar términos regionales.
 * Retorna el texto con los sinónimos reemplazados.
 */
export function applySynonyms(text) {
  let result = text;
  for (let i = 0; i < _SYNONYM_RULES.length; i++) {
    const rule = _SYNONYM_RULES[i];
    if (result.search(rule.rx) !== -1) result = result.replace(rule.rx, rule.std);
  }
  return result;
}

/**
 * Divide la frase por conectores: "y", "con", "+", ",".
 * "2 huevos y tocino con arepa" → ["2 huevos", "tocino", "arepa"]
 */
export function splitByConnectors(text) {
  const input = String(text || '');
  const protectedCommas = input.replace(/(\d),(?=\d)/g, '$1\uE000');
  return protectedCommas
    .split(/\s+y\s+|\s+con\s+|,(?:\s*|$)|\s*\+\s*/i)
    .map(part => part.replace(/\uE000/g, ',').trim())
    .filter(Boolean);
}

/* ──────────────────────────────────────────────────────────────
   CONSTANTES DE PARSEO DE CANTIDADES
   ────────────────────────────────────────────────────────────── */
export const SEARCH_STOP_WORDS = new Set([
  'a', 'al', 'algo', 'con', 'de', 'del', 'desayune', 'desayuné', 'el', 'en', 'esta', 'esto', 'fue', 'la', 'las', 'lo', 'los',
  'me', 'mi', 'mis', 'para', 'por', 'que', 'sin', 'su', 'sus', 'una', 'un', 'uno', 'unos', 'unas', 'y', 'yo', 'comi', 'comí',
  'cene', 'cené', 'almorce', 'almorcé', 'tome', 'tomé', 'bebi', 'bebí', 'despues', 'después'
]);

export const NUMBER_WORDS = {
  'media docena': 6, 'docena': 12, 'tres cuartos': 0.75, 'medio': 0.5, 'media': 0.5, 'cuarto': 0.25,
  'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10
};

export const UNIT_ALIASES = {
  kg: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  l: 'l', lt: 'l', litro: 'l', litros: 'l',
  taza: 'taza', tazas: 'taza',
  vaso: 'vaso', vasos: 'vaso',
  cucharada: 'cucharada', cucharadas: 'cucharada',
  cucharadita: 'cucharadita', cucharaditas: 'cucharadita',
  rebanada: 'rebanada', rebanadas: 'rebanada',
  lonja: 'lonja', lonjas: 'lonja', tira: 'lonja', tiras: 'lonja',
  unidad: 'unidad', unidades: 'unidad',
  pieza: 'pieza', piezas: 'pieza',
  lata: 'lata', latas: 'lata',
  filete: 'filete', filetes: 'filete',
  porcion: 'porcion', porciones: 'porcion',
  rodaja: 'rodaja', rodajas: 'rodaja',
  presa: 'presa', presas: 'presa',
  scoop: 'scoop', scoops: 'scoop',
  tallo: 'tallo', tallos: 'tallo',
  tajada: 'tajada', tajadas: 'tajada',
  mitad: 'mitad',
};

export const DEFAULT_UNIT_GRAMS = {
  taza: 240, vaso: 240, cucharada: 15, cucharadita: 5,
  rebanada: 30, lonja: 20, unidad: 100, pieza: 100,
  lata: 120, filete: 120, porcion: 100, rodaja: 20,
  presa: 120, scoop: 30, tallo: 40, tajada: 150, mitad: 75,
};

export const QUANTITY_PATTERN = 'media docena|docena|tres cuartos|medio|media|cuarto|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[\\.,]\\d+)?';
export const UNIT_PATTERN = 'kg|kilos?|g|grs?|gramos?|ml|mililitros?|l|lt|litros?|tazas?|vasos?|cucharadas?|cucharaditas?|rebanadas?|lonjas?|tiras?|unidades?|piezas?|latas?|filetes?|porciones?|rodajas?|presas?|scoops?|tallos?|tajadas?|mitad';

export function normalizeText(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function prettyQty(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

export function parseQuantityValue(raw) {
  const token = normalizeSearchText(raw);
  if (NUMBER_WORDS[token] != null) return NUMBER_WORDS[token];
  return parseUserNumber(String(raw || '').trim());
}

export function canonicalUnit(raw) {
  return UNIT_ALIASES[normalizeSearchText(raw)] || '';
}

export function convertEstimate(food, quantityRaw, unitRaw) {
  const quantity = parseQuantityValue(quantityRaw);
  const unit = canonicalUnit(unitRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { grams: null, label: 'Cantidad inválida', explicit: true, unit, convertible: false, needsReview: true, blocking: true };
  }
  let grams = food.defaultServingGrams || 100;
  let label = food.defaultServingLabel || `${grams}g`;
  let needsReview = false;
  let unitCount = null;

  if (unit === 'kg') { grams = quantity * 1000; label = `${prettyQty(quantity)}kg`; }
  else if (unit === 'g') { grams = quantity; label = `${prettyQty(quantity)}g`; }
  else if (unit === 'ml') { grams = quantity; label = `${prettyQty(quantity)}ml`; }
  else if (unit === 'l') { grams = quantity * 1000; label = `${prettyQty(quantity)}L`; }
  else if (unit && food.measures?.[unit]) {
    grams = quantity * food.measures[unit];
    unitCount = quantity;
    label = `${prettyQty(quantity)} ${quantity === 1 ? unit : unit + 's'}`;
  } else if (unit && DEFAULT_UNIT_GRAMS[unit]) {
    grams = quantity * DEFAULT_UNIT_GRAMS[unit];
    label = `${prettyQty(quantity)} ${unit}`;
    unitCount = quantity;
    needsReview = true;
  } else if (!unit && food.defaultUnitLabel && food.defaultServingGrams) {
    grams = quantity * food.defaultServingGrams;
    unitCount = quantity;
    label = `${prettyQty(quantity)} ${food.defaultUnitLabel}`;
  } else {
    grams = quantity * (food.defaultServingGrams || 100);
    label = `${prettyQty(grams)}g`;
    needsReview = true;
  }
  const roundedGrams = Math.round(grams * 100) / 100;
  const external = parseExternalNumber(roundedGrams, 'quantity');
  return {
    grams: external.value,
    label,
    explicit: true,
    unit,
    unitCount,
    convertible: external.value !== null,
    needsReview: needsReview || external.needsReview,
    blocking: external.value === null,
  };
}

/* P0 Optimización: aliases normalizados cacheados por alimento (la base es
   estática, no hace falta re-normalizar nombres+aliases en cada búsqueda/análisis). */
const _aliasCache = new WeakMap();
export function getFoodAliases(food) {
  if (!food || typeof food !== 'object') return [];
  let cached = _aliasCache.get(food);
  if (cached) return cached;
  const explicit = [food.name, ...(food.aliases || [])].map(normalizeSearchText).filter(Boolean);
  const generated = [];
  for (const alias of explicit) {
    if (alias.includes(' ')) continue;
    if (alias.endsWith('z')) generated.push(alias.slice(0, -1) + 'ces');
    else if (/[aeiou]$/.test(alias)) generated.push(alias + 's');
    else generated.push(alias + 'es');
  }
  cached = Array.from(new Set([...explicit, ...generated]));
  _aliasCache.set(food, cached);
  return cached;
}

export function estimateFoodPortion(normalizedText, food, totalMatches = 1) {
  const parserText = String(normalizedText || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.,\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const aliases = getFoodAliases(food).sort((a, b) => b.length - a.length);

  for (const alias of aliases) {
    const ap = alias.split(' ').map(escapeRegExp).join('\\s+');
    const beforeRx = new RegExp(`(?:^|\\b)(${QUANTITY_PATTERN})\\s*(${UNIT_PATTERN})?\\s*(?:de\\s+)?${ap}(?=\\b|$)`);
    const afterRx = new RegExp(`${ap}\\s*(?:de\\s+)?(${QUANTITY_PATTERN})\\s*(${UNIT_PATTERN})?(?=\\b|$)`);
    const bm = beforeRx.exec(parserText);
    if (bm) return convertEstimate(food, bm[1], bm[2]);
    const am = afterRx.exec(parserText);
    if (am) return convertEstimate(food, am[1], am[2]);

    // A number plus an unsupported unit is explicit but cannot be converted.
    const unknownRx = new RegExp(`(?:^|\\b)(${QUANTITY_PATTERN})\\s+([a-z]+)\\s+(?:de\\s+)?${ap}(?=\\b|$)`);
    const unknown = unknownRx.exec(parserText);
    if (unknown && !canonicalUnit(unknown[2])) {
      return {
        grams: null,
        label: `${unknown[1]} ${unknown[2]}`,
        explicit: true,
        unit: unknown[2],
        convertible: false,
        needsReview: true,
        blocking: true,
        validationErrors: [{ field: 'quantity', code: 'UNKNOWN_UNIT', message: `Unidad no reconocida: ${unknown[2]}.` }],
      };
    }
  }

  if (totalMatches === 1) {
    const gm = new RegExp(`(?:^|\\b)(${QUANTITY_PATTERN})\\s*(${UNIT_PATTERN})(?=\\b|$)`).exec(parserText);
    if (gm) return convertEstimate(food, gm[1], gm[2]);
  }

  return {
    grams: Math.max(1, Math.round(food.defaultServingGrams || 100)),
    label: food.defaultServingLabel || `${Math.max(1, Math.round(food.defaultServingGrams || 100))}g`,
    explicit: false,
    unit: '',
    unitCount: null,
    convertible: true,
    needsReview: true,
    blocking: false,
  };
}

export function buildAIFoodFromLocalFood(food, estimate) {
  const ratio = estimate.grams === null ? null : estimate.grams / 100;
  const round = value => Math.round(value * 10) / 10;
  return {
    alimento: food.name,
    cantidad_estimada: estimate.label || (estimate.grams === null ? 'Cantidad por confirmar' : `${estimate.grams}g`),
    gramos_estimados: estimate.grams,
    kcal: ratio === null ? null : Math.round(food.calories_per_100g * ratio),
    proteinas: ratio === null ? null : round(food.protein_per_100g * ratio),
    carbohidratos: ratio === null ? null : round(food.carbs_per_100g * ratio),
    grasas: ratio === null ? null : round(food.fat_per_100g * ratio),
    needsReview: !!estimate.needsReview,
    quantityExplicit: !!estimate.explicit,
    unit: estimate.unit || '',
    unitCount: estimate.unitCount ?? null,
    blocking: !!estimate.blocking,
    validationErrors: estimate.validationErrors || [],
  };
}

/* ── P0 Optimización: índice de aliases PRECOMPILADO una sola vez al cargar.
   Antes se compilaba un RegExp por alias por alimento en CADA llamada
   (≈90 alimentos × aliases) y se re-normalizaban los alias en bucles anidados. ── */
const _FOOD_ALIAS_INDEX = (() => {
  const list = [];
  LOCAL_FOOD_DB.forEach(food => {
    const explicitAliases = new Set([food.name, ...(food.aliases || [])].map(normalizeSearchText));
    getFoodAliases(food).forEach(alias => {
      const ap = alias.split(' ').map(escapeRegExp).join('\\s+');
      list.push({
        food,
        alias,
        len: alias.length,
        explicitAlias: explicitAliases.has(alias),
        rx: new RegExp(`(?:^|\\b)${ap}(?=\\b|$)`, 'g'),
      });
    });
  });
  return list.sort((a, b) => Number(b.explicitAlias) - Number(a.explicitAlias) || b.len - a.len);
})();

/**
 * Busca menciones de alimentos en el texto con:
 *   1. Exact / substring match
 *   2. Aplicación de sinónimos regionales
 *   3. Fuzzy matching (Levenshtein) con umbral > 75%
 */
export function findLocalFoodMentions(text) {
  // Aplicar sinónimos antes de buscar
  const normalized = applySynonyms(normalizeSearchText(text));
  if (!normalized) return [];

  const candidates = [];
  const tokenMatches = [...normalized.matchAll(/\b[a-z0-9]+\b/g)].filter(match => match[0].length > 3);
  const matchedTokens = new Set();

  // 1. Match exacto / substring con regex precompiladas
  for (let i = 0; i < _FOOD_ALIAS_INDEX.length; i++) {
    const entry = _FOOD_ALIAS_INDEX[i];
    entry.rx.lastIndex = 0;
    let match;
    while ((match = entry.rx.exec(normalized))) {
      candidates.push({
        food: entry.food, alias: entry.alias,
        start: match.index, end: match.index + match[0].length,
        len: entry.len, score: 1.0,
      });
      matchedTokens.add(entry.alias);
    }
  }

  // 2. Fuzzy matching: solo para tokens que no coincidieron exactamente
  if (tokenMatches.length) {
    for (let fi = 0; fi < LOCAL_FOOD_DB.length; fi++) {
      const food = LOCAL_FOOD_DB[fi];
      const aliases = getFoodAliases(food); // cacheado (WeakMap)
      for (let ti = 0; ti < tokenMatches.length; ti++) {
        const tokenMatch = tokenMatches[ti];
        const token = tokenMatch[0];
        if (matchedTokens.has(`${tokenMatch.index}:${token}`)) continue;
        for (let ai = 0; ai < aliases.length; ai++) {
          const alias = aliases[ai];
          // Solo considerar alias de 1 palabra para fuzzy individual
          if (alias.includes(' ')) continue;
          const sim = fuzzyScore(token, alias);
          if (sim > 0.75 && sim < 1.0) { // < 1.0 para no duplicar exactos
            const pos = tokenMatch.index;
            if (pos >= 0) {
              candidates.push({
                food, alias: token, start: pos, end: pos + token.length,
                len: alias.length, score: sim, fuzzy: true,
              });
              matchedTokens.add(`${pos}:${token}`);
              break; // 1 candidato fuzzy por (token, alimento)
            }
          }
        }
      }
    }
  }

  // Ordenar: mayor longitud de alias primero, luego mayor score
  candidates.sort((a, b) => b.score - a.score || b.len - a.len || a.start - b.start);

  const selected = [];
  candidates.forEach(candidate => {
    const overlaps = selected.some(item => !(candidate.end <= item.start || candidate.start >= item.end));
    if (!overlaps) selected.push(candidate);
  });

  return selected.sort((a, b) => a.start - b.start);
}

/**
 * Analiza frases complejas ("2 huevos y arepa con queso y café") usando:
 *   1. Parser de conectores (split por y/con/,/+)
 *   2. Búsqueda por mentions en cada sub-frase
 *   3. Si no hay matches en sub-frase, busca en el texto completo
 */
export function smartOfflineAnalyzeText(text) {
  const originalText = String(text || '').trim();
  if (!originalText) return null;

  const occurrences = [];
  for (const segment of splitByConnectors(originalText)) {
    const linguisticText = applySynonyms(normalizeSearchText(segment));
    const mentions = findLocalFoodMentions(linguisticText);
    for (const mention of mentions) {
      const estimate = estimateFoodPortion(segment, mention.food, mentions.length);
      if (mention.fuzzy) estimate.needsReview = true;
      if (mentions.length > 1 && estimate.explicit) estimate.needsReview = true;
      occurrences.push({
        food: mention.food,
        segment,
        mention,
        estimate,
        candidate: {
          ...buildAIFoodFromLocalFood(mention.food, estimate),
          originalText,
          needsReview: !!estimate.needsReview || !!mention.fuzzy,
        },
      });
    }
  }
  if (!occurrences.length) return null;

  const output = [];
  const consumed = new Set();
  for (let index = 0; index < occurrences.length; index += 1) {
    if (consumed.has(index)) continue;
    const current = occurrences[index];
    const group = occurrences.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item, itemIndex }) => (
      itemIndex >= index && !consumed.has(itemIndex) &&
      item.food.name === current.food.name && item.estimate.explicit && current.estimate.explicit &&
      item.estimate.convertible && current.estimate.convertible &&
      !item.estimate.needsReview && !current.estimate.needsReview &&
      !item.estimate.blocking && !current.estimate.blocking
    ));

    if (group.length > 1) {
      group.forEach(({ itemIndex }) => consumed.add(itemIndex));
      const grams = Math.round(group.reduce((sum, { item }) => sum + item.estimate.grams, 0) * 100) / 100;
      const allUnitCounts = group.every(({ item }) => item.estimate.unitCount !== null);
      const unitCount = allUnitCounts
        ? group.reduce((sum, { item }) => sum + item.estimate.unitCount, 0)
        : null;
      const consolidated = buildAIFoodFromLocalFood(current.food, {
        grams,
        label: unitCount === null ? `${prettyQty(grams)}g` : `${prettyQty(unitCount)} unidades`,
        explicit: true,
        unit: current.estimate.unit,
        unitCount,
        convertible: true,
        needsReview: false,
        blocking: false,
      });
      output.push({ ...consolidated, originalText, consolidatedOccurrences: group.length });
    } else {
      consumed.add(index);
      output.push(current.candidate);
    }
  }

  return { originalText, alimentos: output };
}

export function extractFoodKeywords(text) {
  const normalized = normalizeSearchText(text);
  const tokens = normalized.split(' ').filter(t => t.length > 2 && !SEARCH_STOP_WORDS.has(t));
  return tokens.slice(0, 4).join(' ') || normalized.split(' ').slice(0, 2).join(' ');
}

export function round1(value) {
  const parsed = typeof value === 'number' ? value : parseUserNumber(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
}

export function sanitizeAIFoodItem(a = {}) {
  const quantity = parseExternalNumber(a.gramos_estimados, 'quantity');
  const calories = parseExternalNumber(a.kcal, 'calories');
  const protein = parseExternalNumber(a.proteinas, 'protein');
  const carbs = parseExternalNumber(a.carbohidratos, 'carbs');
  const fat = parseExternalNumber(a.grasas, 'fat');
  const parsedFields = [quantity, calories, protein, carbs, fat];
  const inheritedErrors = Array.isArray(a.validationErrors) ? a.validationErrors : [];
  const validationErrors = [...inheritedErrors, ...parsedFields.map(field => field.error).filter(Boolean)];
  const name = typeof a.alimento === 'string' ? a.alimento.trim() : '';
  if (!name) validationErrors.push({ field: 'food_name', code: 'REQUIRED', message: 'Falta el nombre del alimento.' });
  if (quantity.value === null) validationErrors.push({ field: 'quantity', code: 'REQUIRED', message: 'Falta una cantidad válida.' });
  const needsReview = Boolean(a.needsReview) || parsedFields.some(field => field.needsReview) || validationErrors.length > 0;
  const qty = typeof a.cantidad_estimada === 'string' && a.cantidad_estimada.trim()
    ? a.cantidad_estimada.trim()
    : quantity.value === null ? 'Cantidad por confirmar' : `${quantity.value}g`;
  return {
    alimento: name,
    cantidad_estimada: qty,
    gramos_estimados: quantity.value,
    kcal: calories.value,
    proteinas: protein.value === null ? null : round1(protein.value),
    carbohidratos: carbs.value === null ? null : round1(carbs.value),
    grasas: fat.value === null ? null : round1(fat.value),
    needsReview,
    blocking: Boolean(a.blocking) || validationErrors.some(error => error.field === 'food_name' || error.field === 'quantity'),
    validationErrors,
    ...(Object.hasOwn(a, 'originalText') ? { originalText: a.originalText } : {}),
    ...(Object.hasOwn(a, 'quantityExplicit') ? { quantityExplicit: Boolean(a.quantityExplicit) } : {}),
    ...(Object.hasOwn(a, 'unit') ? { unit: a.unit } : {}),
    ...(Object.hasOwn(a, 'unitCount') ? { unitCount: a.unitCount } : {}),
    ...(Object.hasOwn(a, 'consolidatedOccurrences') ? { consolidatedOccurrences: a.consolidatedOccurrences } : {}),
  };
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export function loadImageFromDataURL(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo abrir la imagen seleccionada'));
    img.src = dataUrl;
  });
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.8) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('No se pudo optimizar la imagen'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

