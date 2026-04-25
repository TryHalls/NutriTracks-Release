import { App, LS } from './state.js';
import { LOCAL_FOOD_DB, SYNONYMS_MAP } from './db.js';

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
  if (lastDate && lastDate !== todayStr) {
    // Los registros de comida y agua son por fecha → se reinician solos.
    // Actualizamos App.todayWater para reflejar el nuevo día.
    App.todayWater = 0;
    console.info('[App] ✦ Nuevo día detectado. Contadores reiniciados.');
  }
  LS.set('last_active_date', todayStr);
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
  return Math.round(tdee + (adj[goal] || 0));
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
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
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

/**
 * Aplica el mapa de sinónimos para estandarizar términos regionales.
 * Retorna el texto con los sinónimos reemplazados.
 */
export function applySynonyms(text) {
  let result = text;
  // Ordenamos por longitud desc para que términos largos tengan prioridad
  const entries = Object.entries(SYNONYMS_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [synonym, standard] of entries) {
    const normSyn = normalizeSearchText(synonym);
    const normStd = normalizeSearchText(standard);
    if (result.includes(normSyn)) {
      result = result.replace(new RegExp(`\\b${escapeRegExp(normSyn)}\\b`, 'g'), normStd);
    }
  }
  return result;
}

/**
 * Divide la frase por conectores: "y", "con", "+", ",".
 * "2 huevos y tocino con arepa" → ["2 huevos", "tocino", "arepa"]
 */
export function splitByConnectors(text) {
  return text
    .split(/\s+y\s+|\s+con\s+|,\s*|\+\s*/i)
    .map(t => t.trim())
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

export const QUANTITY_PATTERN = 'media docena|docena|tres cuartos|medio|media|cuarto|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\\d+(?:[\\.,]\\d+)?';
export const UNIT_PATTERN = 'kg|kilos?|g|grs?|gramos?|ml|mililitros?|l|lt|litros?|tazas?|vasos?|cucharadas?|cucharaditas?|rebanadas?|lonjas?|tiras?|unidades?|piezas?|latas?|filetes?|porciones?|rodajas?|presas?|scoops?|tallos?|tajadas?|mitad';

export function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
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
  const num = parseFloat(token.replace(',', '.'));
  return Number.isFinite(num) ? num : 1;
}

export function canonicalUnit(raw) {
  return UNIT_ALIASES[normalizeSearchText(raw)] || '';
}

export function convertEstimate(food, quantityRaw, unitRaw) {
  const quantity = Math.max(0.25, parseQuantityValue(quantityRaw));
  const unit = canonicalUnit(unitRaw);
  let grams = Math.round(food.defaultServingGrams || 100);
  let label = food.defaultServingLabel || `${grams}g`;

  if (unit === 'kg') { grams = quantity * 1000; label = `${prettyQty(quantity)}kg`; }
  else if (unit === 'g') { grams = quantity; label = `${prettyQty(quantity)}g`; }
  else if (unit === 'ml') { grams = quantity; label = `${prettyQty(quantity)}ml`; }
  else if (unit === 'l') { grams = quantity * 1000; label = `${prettyQty(quantity)}L`; }
  else if (unit && food.measures?.[unit]) {
    grams = quantity * food.measures[unit];
    label = `${prettyQty(quantity)} ${quantity === 1 ? unit : unit + 's'}`;
  } else if (unit && DEFAULT_UNIT_GRAMS[unit]) {
    grams = quantity * DEFAULT_UNIT_GRAMS[unit];
    label = `${prettyQty(quantity)} ${unit}`;
  } else if (!unit && food.defaultUnitLabel && food.defaultServingGrams) {
    grams = quantity * food.defaultServingGrams;
    label = `${prettyQty(quantity)} ${food.defaultUnitLabel}`;
  } else {
    grams = quantity * (food.defaultServingGrams || 100);
    label = `${Math.max(1, Math.round(grams))}g`;
  }
  return { grams: Math.max(1, Math.round(grams)), label };
}

export function getFoodAliases(food) {
  return Array.from(new Set([food.name, ...(food.aliases || [])].map(normalizeSearchText).filter(Boolean)));
}

export function estimateFoodPortion(normalizedText, food, totalMatches = 1) {
  const aliases = getFoodAliases(food).sort((a, b) => b.length - a.length);

  for (const alias of aliases) {
    const ap = alias.split(' ').map(escapeRegExp).join('\\s+');
    const beforeRx = new RegExp(`(?:^|\\b)(${QUANTITY_PATTERN})\\s*(${UNIT_PATTERN})?\\s*(?:de\\s+)?${ap}(?=\\b|$)`);
    const afterRx = new RegExp(`${ap}\\s*(?:de\\s+)?(${QUANTITY_PATTERN})\\s*(${UNIT_PATTERN})?(?=\\b|$)`);
    const bm = beforeRx.exec(normalizedText);
    if (bm) return convertEstimate(food, bm[1], bm[2]);
    const am = afterRx.exec(normalizedText);
    if (am) return convertEstimate(food, am[1], am[2]);
  }

  if (totalMatches === 1) {
    const gm = new RegExp(`(?:^|\\b)(${QUANTITY_PATTERN})\\s*(${UNIT_PATTERN})(?=\\b|$)`).exec(normalizedText);
    if (gm) return convertEstimate(food, gm[1], gm[2]);
  }

  return {
    grams: Math.max(1, Math.round(food.defaultServingGrams || 100)),
    label: food.defaultServingLabel || `${Math.max(1, Math.round(food.defaultServingGrams || 100))}g`
  };
}

export function buildAIFoodFromLocalFood(food, estimate) {
  const ratio = estimate.grams / 100;
  return {
    alimento: food.name,
    cantidad_estimada: estimate.label || `${estimate.grams}g`,
    gramos_estimados: estimate.grams,
    kcal: Math.round(food.calories_per_100g * ratio),
    proteinas: parseFloat((food.protein_per_100g * ratio).toFixed(1)),
    carbohidratos: parseFloat((food.carbs_per_100g * ratio).toFixed(1)),
    grasas: parseFloat((food.fat_per_100g * ratio).toFixed(1)),
  };
}

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

  LOCAL_FOOD_DB.forEach(food => {
    getFoodAliases(food).forEach(alias => {
      // --- Match exacto / substring ---
      const ap = alias.split(' ').map(escapeRegExp).join('\\s+');
      const rx = new RegExp(`(?:^|\\b)${ap}(?=\\b|$)`, 'g');
      let match;
      while ((match = rx.exec(normalized))) {
        candidates.push({ food, alias, start: match.index, end: match.index + match[0].length, len: alias.length, score: 1.0 });
      }
    });

    // --- Fuzzy matching: dividir texto en tokens y comparar con alias ---
    const tokens = normalized.split(' ').filter(t => t.length > 3);
    tokens.forEach((token, idx) => {
      getFoodAliases(food).forEach(alias => {
        // Solo considerar alias de 1 palabra para fuzzy individual
        if (alias.includes(' ')) return;
        const sim = fuzzyScore(token, alias);
        if (sim > 0.75 && sim < 1.0) { // < 1.0 para no duplicar exactos
          // Calcular posición aproximada
          const pos = normalized.indexOf(token);
          if (pos >= 0) {
            candidates.push({
              food, alias: token, start: pos, end: pos + token.length,
              len: alias.length, score: sim
            });
          }
        }
      });
    });
  });

  // Ordenar: mayor longitud de alias primero, luego mayor score
  candidates.sort((a, b) => b.len - a.len || b.score - a.score || a.start - b.start);

  const selected = [];
  candidates.forEach(candidate => {
    const overlaps = selected.some(item => !(candidate.end <= item.start || candidate.start >= item.end));
    const sameFood = selected.some(item => item.food.name === candidate.food.name);
    if (!overlaps && !sameFood) selected.push(candidate);
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
  const normalized = normalizeSearchText(text);
  if (!normalized) return null;

  // Intento 1: analizar texto completo
  const mentionsFull = findLocalFoodMentions(normalized);

  // Intento 2: dividir por conectores y analizar cada fragmento
  const segments = splitByConnectors(normalized);
  const mentionsSegmented = [];
  const seenFoods = new Set();

  segments.forEach(seg => {
    const segMentions = findLocalFoodMentions(seg);
    segMentions.forEach(m => {
      if (!seenFoods.has(m.food.name)) {
        seenFoods.add(m.food.name);
        // Estimar porción en el segmento (más preciso)
        const estimate = estimateFoodPortion(
          applySynonyms(normalizeSearchText(seg)),
          m.food, segMentions.length
        );
        mentionsSegmented.push({ food: m.food, estimate });
      }
    });
  });

  // Si el análisis segmentado encontró más alimentos, usarlo
  const useSegmented = mentionsSegmented.length >= mentionsFull.length;

  if (useSegmented && mentionsSegmented.length > 0) {
    return {
      alimentos: mentionsSegmented.map(({ food, estimate }) =>
        buildAIFoodFromLocalFood(food, estimate)
      )
    };
  }

  if (mentionsFull.length > 0) {
    return {
      alimentos: mentionsFull.map(m =>
        buildAIFoodFromLocalFood(m.food, estimateFoodPortion(normalized, m.food, mentionsFull.length))
      )
    };
  }

  return null;
}

export function extractFoodKeywords(text) {
  const normalized = normalizeSearchText(text);
  const tokens = normalized.split(' ').filter(t => t.length > 2 && !SEARCH_STOP_WORDS.has(t));
  return tokens.slice(0, 4).join(' ') || normalized.split(' ').slice(0, 2).join(' ');
}

export function round1(value) {
  return parseFloat((Number(value) || 0).toFixed(1));
}

export function sanitizeAIFoodItem(a = {}) {
  const grams = Math.max(0, Math.round(Number(a.gramos_estimados) || 0));
  const qty = String(a.cantidad_estimada || (grams ? `${grams}g` : 'Cantidad por confirmar'));
  return {
    alimento: String(a.alimento || 'Alimento desconocido').trim() || 'Alimento desconocido',
    cantidad_estimada: qty,
    gramos_estimados: grams,
    kcal: Math.max(0, Math.round(Number(a.kcal) || 0)),
    proteinas: round1(a.proteinas),
    carbohidratos: round1(a.carbohidratos),
    grasas: round1(a.grasas),
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

