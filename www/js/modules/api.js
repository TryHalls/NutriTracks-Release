import { App, LS } from './state.js';
import * as Utils from './utils.js';
import * as UI from './ui.js';
import { LOCAL_FOOD_DB } from './db.js';
import { parseExternalNumber } from './validation.js';

/*
   Hardcode para dev (descomenta y pon tu clave):

   const AI_CONFIG_OVERRIDE = {
     apiKey:   'AIzaSy-XXXXXXXXXXXXXXXXXXXXXXXX',
     provider: 'gemini'
   };

   Deja el objeto vacío para usar solo la config del usuario:
*/
export const AI_CONFIG_OVERRIDE = {};
// Incrementar ante cambios relevantes de parser, prompt, catálogo local o
// sanitización/mapeo nutricional que puedan cambiar el resultado persistido.
export const AI_ANALYSIS_CACHE_VERSION = 'v2';
export const AI_ANALYSIS_CACHE_MAX_ENTRIES = 200;
export const AI_ANALYSIS_CACHE_STRATEGIES = Object.freeze({
  LOCAL: 'local',
  REMOTE: 'remote',
});

export function buildAIAnalysisCacheKey(text, strategy, version = AI_ANALYSIS_CACHE_VERSION) {
  if (!Object.values(AI_ANALYSIS_CACHE_STRATEGIES).includes(strategy)) return null;
  return `${version}|${strategy}|${Utils.normalizeText(text)}`;
}

function isCacheRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const AI_CACHE_FOOD_FIELDS = [
  'alimento', 'cantidad_estimada', 'gramos_estimados', 'kcal',
  'proteinas', 'carbohidratos', 'grasas',
];

function hasExactCacheFields(value, expected) {
  if (!isCacheRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every(field => Object.hasOwn(value, field));
}

function isValidCachedNutritionValue(value) {
  return value === null || (Number.isFinite(value) && value >= 0);
}

function isValidAIAnalysisCacheFood(food) {
  return hasExactCacheFields(food, AI_CACHE_FOOD_FIELDS)
    && typeof food.alimento === 'string'
    && food.alimento.trim().length > 0
    && typeof food.cantidad_estimada === 'string'
    && food.cantidad_estimada.trim().length > 0
    && ['gramos_estimados', 'kcal', 'proteinas', 'carbohidratos', 'grasas']
      .every(field => isValidCachedNutritionValue(food[field]));
}

function isValidAIAnalysisCacheEntry(entry) {
  return hasExactCacheFields(entry, ['result', 'ts', 'mode'])
    && hasExactCacheFields(entry.result, ['alimentos'])
    && Array.isArray(entry.result.alimentos)
    && entry.result.alimentos.every(isValidAIAnalysisCacheFood)
    && Number.isFinite(entry.ts)
    && entry.ts >= 0
    && ['ai', 'offline', 'hybrid'].includes(entry.mode);
}

function findOldestAIAnalysisCacheKey(cache) {
  let oldestKey = null;
  let oldestTimestamp = Infinity;
  for (const key of Object.keys(cache)) {
    const timestamp = Number.isFinite(cache[key]?.ts) ? cache[key].ts : -Infinity;
    if (oldestKey === null || timestamp < oldestTimestamp) {
      oldestKey = key;
      oldestTimestamp = timestamp;
    }
  }
  return oldestKey;
}

export function getAIConfig() {
  if (AI_CONFIG_OVERRIDE.apiKey) return AI_CONFIG_OVERRIDE;
  try {
    const saved = LS.get('ai_config', null);
    return saved && saved.apiKey ? saved : null;
  } catch (error) {
    // La configuración es secundaria para el arranque: se degrada a modo local
    // sin confundir corrupción/indisponibilidad con una escritura exitosa.
    console.error('[Persistencia] No se pudo leer la configuración de IA:', error);
    return null;
  }
}

export function loadAIConfig() {
  const cfg = getAIConfig();
  const keyEl = document.getElementById('ai-api-key-input');
  /* P0: provider siempre es gemini, no es necesario leer el select eliminado */
  if (!cfg) { updateAIStatusBar(false); return; }
  if (keyEl && cfg.apiKey) keyEl.value = cfg.apiKey;
  updateAIStatusBar(!!cfg.apiKey);
}

export function saveAIConfig() {
  const key = document.getElementById('ai-api-key-input')?.value.trim();
  /* P0: proveedor fijo a gemini — se elimina referencia a openai */
  if (!key) { UI.showToast('Ingresa una API Key válida', 'error'); return; }
  /* P1: No loguear la key en consola */
  try {
    LS.set('ai_config', { apiKey: key, provider: 'gemini' });
  } catch (error) {
    UI.showPersistenceFailure(error, 'guardar la configuración de IA');
    return false;
  }
  updateAIStatusBar(true);
  UI.showToast('✦ Configuración de Gemini guardada', 'ai', '✦');
  return true;
}

export function updateAIStatusBar(hasKey) {
  const icon = document.getElementById('ai-status-icon');
  const text = document.getElementById('ai-status-text');
  if (!icon || !text) return;
  if (hasKey) {
    icon.style.cssText = '';
    text.textContent = 'IA activa · Fallback: Inteligencia Local + Open Food Facts ES';
  } else {
    icon.style.cssText = 'opacity:.95';
    text.textContent = 'Sin API Key · Inteligencia Local + Open Food Facts ES';
  }
}

export function getAISourceTitle() {
  const prefix = App.lastAIInputMode === 'image' || App.lastAIInputMode === 'mixed' ? '✦ ' : '✦ ';
  if (App.lastAISourceMode === 'offline') return `${prefix}Detectado por Inteligencia Local`;
  if (App.lastAISourceMode === 'hybrid') return `${prefix}Detectado por Base Local + OFF`;
  return `${prefix}Detectado por IA`;
}

export function getSelectedAIMealLabel() {
  return {
    breakfast: 'Desayuno',
    lunch: 'Almuerzo',
    dinner: 'Cena',
    snack: 'Snack'
  }[UI.getSelectedAIMeal()] || 'Comida';
}

export function makeAIResultQuantityLabel(food) {
  if (!food) return 'Cantidad por confirmar';
  if (food.cantidad_estimada && /\d/.test(food.cantidad_estimada)) return food.cantidad_estimada;
  if (food.gramos_estimados > 0) return `${food.gramos_estimados}g`;
  return 'Cantidad por confirmar';
}

export function getAIFallbackSearchSeed(text = '') {
  const clean = String(text || '').trim();
  if (!clean) return '';
  return Utils.extractFoodKeywords(clean) || clean.split(' ').slice(0, 3).join(' ');
}

export async function processImageForAI(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Selecciona una imagen válida');
  }

  const dataUrl = await Utils.fileToDataURL(file);
  const img = await Utils.loadImageFromDataURL(dataUrl);
  const longestSide = Math.max(img.width, img.height);
  const scale = longestSide > 1024 ? 1024 / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(img.width * scale));
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas no disponible en este navegador');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const jpegBlob = await Utils.canvasToBlob(canvas, 'image/jpeg', 0.8);
  const jpegDataUrl = await Utils.blobToDataURL(jpegBlob);
  const base64 = jpegDataUrl.split(',')[1] || '';
  const previewUrl = URL.createObjectURL(jpegBlob);

  return {
    base64,
    mimeType: 'image/jpeg',
    previewUrl,
    name: file.name || 'foto-comida.jpg',
    width: targetWidth,
    height: targetHeight,
    sizeKB: Math.round(jpegBlob.size / 1024),
  };
}

export function getCachedAIAnalysis(text, strategy) {
  try {
    const key = buildAIAnalysisCacheKey(text, strategy);
    if (!key) return null;
    const cache = LS.get('ai_cache', {});
    if (!isCacheRecord(cache)) return null;
    const entry = cache[key];
    return isValidAIAnalysisCacheEntry(entry) ? entry : null;
  } catch (error) {
    console.warn('[AI cache] No se pudo leer la caché; se continuará sin ella.', error);
    return null;
  }
}

export function setCachedAIAnalysis(text, result, strategy) {
  try {
    const key = buildAIAnalysisCacheKey(text, strategy);
    if (!key) return false;
    const storedCache = LS.get('ai_cache', {});
    const nextCache = isCacheRecord(storedCache) ? { ...storedCache } : {};
    const isExistingKey = Object.hasOwn(nextCache, key);
    if (!isExistingKey) {
      while (Object.keys(nextCache).length >= AI_ANALYSIS_CACHE_MAX_ENTRIES) {
        const oldestKey = findOldestAIAnalysisCacheKey(nextCache);
        if (oldestKey === null) break;
        delete nextCache[oldestKey];
      }
    }
    const cacheResult = {
      alimentos: (result?.alimentos || []).map(food => ({
        alimento: food.alimento,
        cantidad_estimada: food.cantidad_estimada,
        gramos_estimados: food.gramos_estimados,
        kcal: food.kcal,
        proteinas: food.proteinas,
        carbohidratos: food.carbohidratos,
        grasas: food.grasas,
      })),
    };
    const nextEntry = { result: cacheResult, ts: Date.now(), mode: App.lastAISourceMode || 'ai' };
    if (!isValidAIAnalysisCacheEntry(nextEntry)) return false;
    nextCache[key] = nextEntry;
    LS.set('ai_cache', nextCache);
    return true;
  } catch (error) {
    // La caché es solo una optimización: nunca invalida un resultado nutricional.
    console.warn('[AI cache] No se pudo persistir la caché; se conserva el resultado principal.', error);
    return false;
  }
}

/* ── Activar modo offline ── */
export async function activateOfflineSmartFallback(text, originalError = null) {
  console.warn('[AI] ✦ Activando Inteligencia Local', originalError?.message || '');
  UI.showToast('✦ Usando Inteligencia Local', 'offline', '✦');

  const localResult = Utils.smartOfflineAnalyzeText(text);
  if (localResult?.alimentos?.length) {
    App.lastAISourceMode = 'offline';
    setCachedAIAnalysis(text, localResult, AI_ANALYSIS_CACHE_STRATEGIES.LOCAL);
    return localResult;
  }

  const hybridResult = await fallbackToOpenFoodFacts(text);
  if (hybridResult?.alimentos?.length) {
    // Hybrid es el fallback remoto de la estrategia local; no debe ocupar la
    // identidad remote ni impedir que una solicitud posterior pruebe Gemini.
    setCachedAIAnalysis(text, hybridResult, AI_ANALYSIS_CACHE_STRATEGIES.LOCAL);
    return hybridResult;
  }

  throw originalError || new Error('NO_LOCAL_MATCH');
}

/* ── Obtener nutrientes (entrada principal) ── */
export async function getNutrientsFromAI(text, imageData = null) {
  const isImageMode = !!imageData;
  const cfg = getAIConfig();
  const requestedStrategy = cfg
    ? AI_ANALYSIS_CACHE_STRATEGIES.REMOTE
    : AI_ANALYSIS_CACHE_STRATEGIES.LOCAL;

  if (!isImageMode) {
    const cached = getCachedAIAnalysis(text, requestedStrategy);
    if (cached) {
      App.lastAISourceMode = cached.mode || 'ai';
      return cached.result || cached;
    }
  }

  if (!cfg) {
    if (isImageMode) {
      throw new Error('IMAGE_NO_API_KEY');
    }
    return activateOfflineSmartFallback(text, new Error('NO_API_KEY'));
  }

  const textPrompt = `Eres un nutricionista experto. Analiza el texto del usuario y devuelve ÚNICAMENTE un JSON válido (sin markdown, sin texto extra):
{
  "alimentos": [
    {
      "alimento": "nombre del alimento",
      "cantidad_estimada": "2 unidades / 150g / 1 taza",
      "gramos_estimados": 150,
      "kcal": 200,
      "proteinas": 10.5,
      "carbohidratos": 25.0,
      "grasas": 8.0
    }
  ]
}
Usa valores estándar por 100g y escala según la cantidad. Responde SOLO JSON.`;

  const imagePrompt = 'Analiza esta imagen de comida. Identifica cada alimento, estima su peso en gramos basándote en proporciones estándar y devuelve un JSON estrictamente con esta estructura: { alimentos: [{ alimento, cantidad_estimada, gramos_estimados, kcal, proteinas, carbohidratos, grasas }] }.';

  try {
    /* P0: Gemini es el único proveedor. Se elimina la bifurcación de OpenAI */
    const result = await callGeminiAPI(cfg.apiKey, isImageMode ? imagePrompt : textPrompt, text, imageData);
    App.lastAISourceMode = 'ai';
    if (!isImageMode) setCachedAIAnalysis(text, result, AI_ANALYSIS_CACHE_STRATEGIES.REMOTE);
    return result;
  } catch (e) {
    if (isImageMode) throw e;
    console.error('[AI] Fallo de API, activando modo offline:', e.message);
    return activateOfflineSmartFallback(text, e);
  }
}

/* ── Google Gemini (texto + visión) ── */
export async function callGeminiAPI(apiKey, systemPrompt, userText, imageData = null) {
  // Mantén aquí el modelo que ya te funciona en producción.
  // En este proyecto se deja la ruta actual para no romper el flujo existente.
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

  if (!apiKey) {
    throw new Error('Gemini API key no configurada');
  }

  const prompt = imageData
    ? [systemPrompt, userText ? `Contexto adicional del usuario: ${userText}` : '']
      .filter(Boolean)
      .join('\n\n')
    : [systemPrompt, `Texto del usuario: ${userText}`]
      .filter(Boolean)
      .join('\n\n');

  const parts = [{ text: prompt }];
  if (imageData) {
    parts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: imageData
      }
    });
  }

  let res;

  /* P2: Timeout de 15s para no dejar la UI en "Analizando…" indefinidamente */
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts
          }
        ],
        generationConfig: {
          response_mime_type: 'application/json'
        }
      }),
      signal: controller.signal
    });
  } catch (networkErr) {
    clearTimeout(timeoutId);
    const timedOut = networkErr?.name === 'AbortError';
    console.error('[Gemini] Error de red:', networkErr);
    throw new Error(timedOut ? 'Gemini TIMEOUT: la IA tardó demasiado en responder' : `Gemini NETWORK_ERROR: ${networkErr.message}`);
  }
  clearTimeout(timeoutId);

  if (res.status !== 200) {
    const rawError = await res.text().catch(() => '');
    let errorData = {};

    try {
      errorData = rawError ? JSON.parse(rawError) : {};
    } catch (_) { }

    const googleMessage =
      errorData?.error?.message ||
      rawError ||
      'Error desconocido';

    console.error(`[Gemini] Error ${res.status}: ${googleMessage}`, errorData);
    throw new Error(`Gemini ${res.status}: ${googleMessage}`);
  }

  const data = await res.json();
  const generatedText = data?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text || '')
    .join('\n')
    .trim();

  if (!generatedText) {
    console.error('[Gemini] Respuesta inesperada:', data);
    throw new Error('Gemini respondió sin texto en data.candidates[0].content.parts[].text');
  }

  return parseAIResponse(generatedText);
}

/* ── Parsear respuesta de IA ── */
export function parseAIResponse(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed.alimentos || !Array.isArray(parsed.alimentos)) throw new Error('Formato inválido');
    parsed.alimentos = parsed.alimentos.map(Utils.sanitizeAIFoodItem);
    return parsed;
  } catch (e) {
    console.error('[AI] Error al parsear JSON:', e, '\nRaw:', raw);
    throw new Error('La IA devolvió un formato inesperado');
  }
}

/* ── Botón principal "Analizar con IA" ── */
export async function analyzeWithAI() {
  const ta = document.getElementById('ai-food-input');
  const text = ta?.value.trim() || '';
  const imageData = App.aiImage?.base64 || null;
  const hasImage = !!imageData;

  if (!text && !hasImage) {
    UI.showToast('Describe la comida o adjunta una foto primero', 'error');
    ta?.focus();
    return;
  }

  App.lastAIInputMode = hasImage ? (text ? 'mixed' : 'image') : 'text';

  const btn = document.getElementById('btn-ai-analyze');
  const processing = document.getElementById('ai-processing');
  const subEl = document.getElementById('ai-processing-sub');

  if (btn) btn.disabled = true;
  UI.renderAIResultsLoading(hasImage ? 'image' : 'text');
  if (processing) processing.style.display = 'block';
  if (subEl) subEl.textContent = hasImage ? 'Preparando análisis visual...' : 'Analizando nutrientes...';
  if (hasImage) UI.showToast('Analizando imagen...', 'ai');

  try {
    const cfg = getAIConfig();
    if (hasImage && cfg && cfg.provider !== 'gemini') {
      throw new Error('IMAGE_REQUIRES_GEMINI');
    }
    if (subEl) {
      if (hasImage) {
        subEl.textContent = cfg ? 'Consultando Gemini Vision...' : 'Se necesita Gemini para analizar fotos';
      } else {
        subEl.textContent = cfg ? 'Consultando IA...' : 'Activando Inteligencia Local...';
      }
    }

    const aiData = await getNutrientsFromAI(text, imageData);
    UI.renderAIResults(aiData.alimentos);
  } catch (err) {
    console.error('[AI] Error final:', err);
    UI.clearAIResults();

    if (err.message === 'IMAGE_REQUIRES_GEMINI') {
      UI.showToast('Para analizar fotos cambia el proveedor a Gemini en tu perfil.', 'error');
    } else if (err.message === 'IMAGE_NO_API_KEY') {
      UI.showToast('Necesitas una API Key de Gemini para analizar imágenes.', 'error');
    } else if (hasImage) {
      UI.showToast('No pude reconocer la comida en la imagen. Puedes registrarla manualmente.', 'info');
    } else {
      UI.showToast('No pude interpretar esa comida. Abriendo búsqueda manual.', 'info');
    }

    UI.openManualFoodRegistration(text);
  } finally {
    if (btn) btn.disabled = false;
    if (processing) processing.style.display = 'none';
  }
}

/* ── Fallback híbrido: Open Food Facts ── */
export async function fallbackToOpenFoodFacts(text) {
  const query = Utils.extractFoodKeywords(text);
  const foods = await searchOpenFoodFacts(query);
  if (!foods.length) throw new Error('Sin resultados en búsqueda híbrida');

  const f = foods[0];
  if (f.source === 'local') {
    App.lastAISourceMode = 'offline';
    const estimate = Utils.estimateFoodPortion(
      Utils.applySynonyms(Utils.normalizeSearchText(text)), f, 1
    );
    return { alimentos: [Utils.buildAIFoodFromLocalFood(f, estimate)] };
  }

  App.lastAISourceMode = 'hybrid';
  return {
    alimentos: [{
      alimento: f.name,
      cantidad_estimada: '100g',
      gramos_estimados: 100,
      kcal: f.calories_per_100g,
      proteinas: f.protein_per_100g,
      carbohidratos: f.carbs_per_100g,
      grasas: f.fat_per_100g,
      needsReview: Boolean(f.needsReview),
    }]
  };
}

/* ── Renderizar resultados de IA ── */
export async function callGeminiPlainText(cfg, userPrompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': cfg.apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 2500, temperature: 0.7 }
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') throw new Error('Gemini TIMEOUT: la IA tardó demasiado en responder');
    throw err;
  }
  clearTimeout(timeoutId);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Gemini ${res.status}: ${e?.error?.message || ''}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export let _searchAbortController = null;

export async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Búsqueda local con:
 *   1. Matching exacto y substring
 *   2. Sinónimos regionales
 *   3. Fuzzy (Levenshtein) con umbral > 75%
 */
export function searchLocalFoodDatabase(query, limit = 12) {
  const rawQuery = Utils.normalizeSearchText(query);
  const synonymsQuery = Utils.applySynonyms(rawQuery);  // aplica sinónimos
  if (!synonymsQuery || synonymsQuery.length < 2) return [];

  const queryWords = synonymsQuery.split(' ').filter(Boolean);

  return LOCAL_FOOD_DB
    .map(food => {
      const terms = Utils.getFoodAliases(food);
      let score = 0;

      terms.forEach(term => {
        // Exacto
        if (term === synonymsQuery || term === rawQuery) { score = Math.max(score, 120); return; }
        // Starts-with
        if (term.startsWith(synonymsQuery) || term.startsWith(rawQuery)) { score = Math.max(score, 95); return; }
        // Contains
        if (synonymsQuery.startsWith(term)) { score = Math.max(score, 82); return; }
        if (term.includes(synonymsQuery) || term.includes(rawQuery)) { score = Math.max(score, 75); return; }

        // Palabras clave
        const wordHits = queryWords.filter(w => w.length > 1 && term.includes(w)).length;
        if (wordHits === queryWords.length && wordHits > 0) score = Math.max(score, 64 + wordHits * 6);
        else if (wordHits > 0) score = Math.max(score, 42 + wordHits * 4);

        // Fuzzy (Levenshtein) por token individual
        queryWords.forEach(word => {
          if (word.length < 3) return;
          term.split(' ').forEach(termToken => {
            if (termToken.length < 3) return;
            const sim = Utils.fuzzyScore(word, termToken);
            if (sim > 0.75) score = Math.max(score, Math.round(sim * 70));
          });
        });
      });

      return score >= 40 ? { ...food, source: 'local', _score: score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
    .map(({ _score, ...food }) => food);
}

export async function searchOpenFoodFactsRemote(query, signal) {
  /* P1: Timeout extendido a 4s para mejor tasa de éxito */
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    lc: 'es',
    tags_lc: 'es',
    fields: 'product_name,product_name_es,nutriments,brands'
  });

  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;

  try {
    /* P1: Acepta signal externo del AbortController de búsqueda + timeout propio */
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 4000);

    const forwardAbort = () => timeoutController.abort();
    if (signal) signal.addEventListener('abort', forwardAbort, { once: true });
    let res;
    try {
      res = await fetch(url, { signal: timeoutController.signal });
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', forwardAbort);
    }

    if (!res.ok) throw new Error(`OFF ${res.status}`);

    const data = await res.json();
    const prods = data.products || [];

    return prods
      .map(p => {
        const directEnergy = parseExternalNumber(p.nutriments?.['energy-kcal_100g'], 'calories');
        const joules = parseExternalNumber(p.nutriments?.energy_100g, 'calories');
        const kcal = directEnergy.value !== null
          ? directEnergy
          : joules.value === null ? joules : parseExternalNumber(joules.value / 4.184, 'calories');
        if (!p.product_name && !p.product_name_es) return null;
        if (kcal.error || kcal.value === null) return null;
        const protein = parseExternalNumber(p.nutriments?.proteins_100g, 'protein');
        const carbs = parseExternalNumber(p.nutriments?.carbohydrates_100g, 'carbs');
        const fat = parseExternalNumber(p.nutriments?.fat_100g, 'fat');
        const fiber = parseExternalNumber(p.nutriments?.fiber_100g, 'fiber');
        const sugar = parseExternalNumber(p.nutriments?.sugars_100g, 'sugar');
        const fields = [kcal, protein, carbs, fat, fiber, sugar];
        return {
          name: p.product_name_es || p.product_name,
          category: p.brands || 'Open Food Facts ES',
          calories_per_100g: kcal.value,
          protein_per_100g: protein.value,
          carbs_per_100g: carbs.value,
          fat_per_100g: fat.value,
          fiber_per_100g: fiber.value,
          sugar_per_100g: sugar.value,
          needsReview: fields.some(field => field.needsReview || field.error),
          source: 'off',
        };
      })
      .filter(Boolean)
      .slice(0, 15);
  } catch (e) {
    if (e.name === 'AbortError') {
      /* Puede ser por cancelación de búsqueda (usuario sigue escribiendo) o timeout */
      console.info('[OFF] Petición cancelada o timeout alcanzado.');
    } else {
      console.warn('[OFF] Error de red:', e.message);
    }
    return [];
  }
}

export function mergeFoodResults(localResults, apiResults) {
  const merged = [];
  const seen = new Set();
  [...localResults, ...apiResults].forEach(food => {
    const key = Utils.normalizeSearchText(food.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(food);
  });
  return merged.slice(0, 15);
}

export function updateSearchSourceBadge(foods = []) {
  const badge = document.getElementById('search-source-badge');
  if (!badge) return;
  const hasLocal = foods.some(f => f.source === 'local');
  const hasOff = foods.some(f => f.source === 'off');
  badge.textContent = hasLocal && hasOff ? 'LOCAL + OFF' : hasLocal ? 'LOCAL' : hasOff ? 'OFF ES' : 'LOCAL + OFF';
}

export async function searchOpenFoodFacts(query) {
  if (!query || query.length < 2) return [];

  /* P1: Cancelar petición anterior antes de iniciar la nueva */
  if (_searchAbortController) {
    _searchAbortController.abort();
  }
  _searchAbortController = new AbortController();
  const signal = _searchAbortController.signal;

  const localResults = searchLocalFoodDatabase(query, 12);
  const apiResults = await searchOpenFoodFactsRemote(query, signal);
  const merged = mergeFoodResults(localResults, apiResults);
  App.allFoods = merged;
  return merged;
}

/* ── P0 Optimización: búsqueda HÍBRIDA en 2 fases.
   Los resultados de la base local (instantáneos, ~3ms) se muestran de
   inmediato; la API de Open Food Facts (hasta 4s) se suma después cuando
   responde. Antes la UI esperaba la petición remota para renderizar HASTA
   los resultados locales — la búsqueda se sentía lenta incluso en local. ── */
export function searchFoodHybrid(query, onLocal, onMerged) {
  if (!query || query.length < 2) return;

  if (_searchAbortController) _searchAbortController.abort();
  _searchAbortController = new AbortController();
  const signal = _searchAbortController.signal;

  const localResults = searchLocalFoodDatabase(query, 12);
  if (typeof onLocal === 'function') onLocal(localResults);

  searchOpenFoodFactsRemote(query, signal)
    .then(apiResults => {
      /* P0 fix race: si el usuario ya escribió otra búsqueda mientras esta
         petición volaba, el AbortController ya no es el actual → descartar
         (una respuesta obsoleta NO debe pisar los resultados nuevos). */
      if (_searchAbortController?.signal !== signal) return;
      const merged = mergeFoodResults(localResults, apiResults);
      App.allFoods = merged;
      if (typeof onMerged === 'function') onMerged(merged);
    })
    .catch(() => {});
}

function _safeTriggerLabelPhotoFallback() {
  try {
    if (typeof UI._showLabelPhotoFallbackUI === 'function') {
      UI._showLabelPhotoFallbackUI();
      return;
    }
  } catch (err) {
    console.warn('[Scanner] No se pudo activar UI de fallback:', err?.message || err);
  }
  UI.showToast('Producto no encontrado. Registra manualmente.', 'warning');
}

/* ══════════════════════════════════════════════════════════════ */
export async function _queryOpenFoodFactsByBarcode(barcode) {
  var url = 'https://world.openfoodfacts.org/api/v0/product/' + encodeURIComponent(barcode) + '.json';
  try {
    var res = await fetchWithTimeout(url, {}, 7000);
    if (!res.ok) throw new Error('OFF ' + res.status);
    var data = await res.json();
    if (data.status === 1 && data.product) {
      var p = data.product;
      var n = p.nutriments || {};
      var directKcal = parseExternalNumber(n['energy-kcal_100g'], 'calories');
      var energyKj = parseExternalNumber(n.energy_100g, 'calories');
      var kcal = directKcal.value !== null
        ? directKcal
        : energyKj.value === null ? energyKj : parseExternalNumber(energyKj.value / 4.184, 'calories');
      var name = p.product_name_es || p.product_name || 'Producto escaneado';
      if (kcal.value !== null && !kcal.error) {
        var protein = parseExternalNumber(n.proteins_100g, 'protein');
        var carbs = parseExternalNumber(n.carbohydrates_100g, 'carbs');
        var fat = parseExternalNumber(n.fat_100g, 'fat');
        var fiber = parseExternalNumber(n.fiber_100g, 'fiber');
        var sugar = parseExternalNumber(n.sugars_100g, 'sugar');
        UI._scannerSetPhase(3);
        UI._scannerSetStatus('\u2705 "' + name + '" encontrado', false);
        UI._registerScannedProduct({
          name: name,
          calories_per_100g: kcal.value,
          protein_per_100g: protein.value,
          carbs_per_100g: carbs.value,
          fat_per_100g: fat.value,
          fiber_per_100g: fiber.value,
          sugar_per_100g: sugar.value,
          needsReview: [kcal, protein, carbs, fat, fiber, sugar].some(field => field.needsReview || field.error),
        });
        return;
      }
    }
    _safeTriggerLabelPhotoFallback();
  } catch (err) {
    console.warn('[Scanner] Error OFF:', err.message);
    _safeTriggerLabelPhotoFallback();
  }
}

/* Fase 2b: Fallback - foto de etiqueta */
export async function _analyzeLabelWithGemini(imageFile) {
  UI._scannerSetPhase(2);
  UI._scannerSetStatus('Analizando etiqueta con IA...', true);
  var cfg = getAIConfig();
  if (!cfg) {
    UI.showToast('Necesitas una API Key de Gemini para analizar la etiqueta.', 'error');
    UI._scannerSetStatus('Sin API Key de Gemini', false);
    UI.ScannerState.processed = false;
    return;
  }
  try {
    var processed = await processImageForAI(imageFile);
    var systemPrompt = 'Extrae los datos nutricionales de esta etiqueta y responde SOLO un JSON valido EXACTAMENTE con este formato:\n{"name":"Nombre del producto","calories":123,"protein":4.5,"carbs":20.1,"fat":2.3}\nNo agregues markdown, comentarios, ni texto fuera del JSON. Si falta un valor usa null.';
    var apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 15000);
    var res;
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': cfg.apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              { inline_data: { mime_type: 'image/jpeg', data: processed.base64 } }
            ]
          }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.1, response_mime_type: 'application/json' }
        }),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err && err.name === 'AbortError') throw new Error('Gemini TIMEOUT: la IA tardó demasiado en responder');
      throw err;
    }
    clearTimeout(timeoutId);
    if (!res.ok) {
      var errData = await res.json().catch(function () { return {}; });
      throw new Error('Gemini ' + res.status + ': ' + (errData && errData.error ? errData.error.message : ''));
    }
    var data = await res.json();
    var rawText = (data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text) ? data.candidates[0].content.parts[0].text.trim() : '';
    if (!rawText) throw new Error('Gemini no devolvio texto');
    var parsed = JSON.parse(rawText);
    var name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    var calories = parseExternalNumber(parsed.calories, 'calories');
    var protein = parseExternalNumber(parsed.protein, 'protein');
    var carbs = parseExternalNumber(parsed.carbs, 'carbs');
    var fat = parseExternalNumber(parsed.fat, 'fat');
    if (!name || calories.value === null || calories.error) throw new Error('No se encontraron calorias válidas en la etiqueta');
    UI._scannerSetPhase(3);
    UI._scannerSetStatus('\u2756 "' + name + '" analizado con IA', false);
    UI._registerScannedProduct({
      name: name,
      calories_per_100g: calories.value,
      protein_per_100g: protein.value,
      carbs_per_100g: carbs.value,
      fat_per_100g: fat.value,
      fiber_per_100g: null,
      sugar_per_100g: null,
      needsReview: [calories, protein, carbs, fat].some(field => field.needsReview || field.error),
    }, 100, 'ai_label');
  } catch (err) {
    console.error('[Scanner][Gemini]', err);
    UI.showToast('No pude leer la etiqueta. Registralo manualmente.', 'error');
    UI._scannerSetStatus('Error al analizar etiqueta', false);
    UI.ScannerState.processed = false;
  }
}

/* Fase 4: persistir en el diario */
