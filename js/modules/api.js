import { App, LS } from './state.js';
import * as Utils from './utils.js';
import * as UI from './ui.js';
import { LOCAL_FOOD_DB } from './db.js';

/*
   Hardcode para dev (descomenta y pon tu clave):

   const AI_CONFIG_OVERRIDE = {
     apiKey:   'AIzaSy-XXXXXXXXXXXXXXXXXXXXXXXX',
     provider: 'gemini'
   };

   Deja el objeto vacío para usar solo la config del usuario:
*/
export const AI_CONFIG_OVERRIDE = {};
export function getAIConfig() {
  if (AI_CONFIG_OVERRIDE.apiKey) return AI_CONFIG_OVERRIDE;
  const saved = LS.get('ai_config', null);
  return saved && saved.apiKey ? saved : null;
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
  LS.set('ai_config', { apiKey: key, provider: 'gemini' });
  updateAIStatusBar(true);
  UI.showToast('✦ Configuración de Gemini guardada', 'ai', '✦');
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

export function getCachedAIAnalysis(text) {
  const cache = LS.get('ai_cache', {});
  return cache[Utils.normalizeText(text)] || null;
}

export function setCachedAIAnalysis(text, result) {
  const key = Utils.normalizeText(text);
  const cache = LS.get('ai_cache', {});
  const keys = Object.keys(cache);
  if (keys.length >= 200) delete cache[keys[0]];
  cache[key] = { result, ts: Date.now(), mode: App.lastAISourceMode || 'ai' };
  LS.set('ai_cache', cache);
}

/* ── Activar modo offline ── */
export async function activateOfflineSmartFallback(text, originalError = null) {
  console.warn('[AI] ✦ Activando Inteligencia Local', originalError?.message || '');
  UI.showToast('✦ Usando Inteligencia Local', 'offline', '✦');

  const localResult = Utils.smartOfflineAnalyzeText(text);
  if (localResult?.alimentos?.length) {
    App.lastAISourceMode = 'offline';
    setCachedAIAnalysis(text, localResult);
    return localResult;
  }

  const hybridResult = await fallbackToOpenFoodFacts(text);
  if (hybridResult?.alimentos?.length) {
    setCachedAIAnalysis(text, hybridResult);
    return hybridResult;
  }

  throw originalError || new Error('NO_LOCAL_MATCH');
}

/* ── Obtener nutrientes (entrada principal) ── */
export async function getNutrientsFromAI(text, imageData = null) {
  const isImageMode = !!imageData;

  if (!isImageMode) {
    const cached = getCachedAIAnalysis(text);
    if (cached) {
      App.lastAISourceMode = cached.mode || 'ai';
      return cached.result || cached;
    }
  }

  const cfg = getAIConfig();
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
    if (!isImageMode) setCachedAIAnalysis(text, result);
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
      })
    });
  } catch (networkErr) {
    console.error('[Gemini] Error de red:', networkErr);
    throw new Error(`Gemini NETWORK_ERROR: ${networkErr.message}`);
  }

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
      kcal: Math.round(f.calories_per_100g),
      proteinas: parseFloat(f.protein_per_100g.toFixed(1)),
      carbohidratos: parseFloat(f.carbs_per_100g.toFixed(1)),
      grasas: parseFloat(f.fat_per_100g.toFixed(1)),
    }]
  };
}

/* ── Renderizar resultados de IA ── */
export async function callGeminiPlainText(cfg, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${cfg.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
    })
  });
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
        const kcal = Number(
          p.nutriments?.['energy-kcal_100g'] ??
          (p.nutriments?.energy_100g ? p.nutriments.energy_100g / 4.184 : 0)
        );
        if (!p.product_name && !p.product_name_es) return null;
        if (!Number.isFinite(kcal) || kcal <= 0) return null;
        return {
          name: p.product_name_es || p.product_name,
          category: p.brands || 'Open Food Facts ES',
          calories_per_100g: Math.round(kcal),
          protein_per_100g: parseFloat((Number(p.nutriments?.proteins_100g) || 0).toFixed(1)),
          carbs_per_100g: parseFloat((Number(p.nutriments?.carbohydrates_100g) || 0).toFixed(1)),
          fat_per_100g: parseFloat((Number(p.nutriments?.fat_100g) || 0).toFixed(1)),
          fiber_per_100g: parseFloat((Number(p.nutriments?.fiber_100g) || 0).toFixed(1)),
          sugar_per_100g: parseFloat((Number(p.nutriments?.sugars_100g) || 0).toFixed(1)),
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

function _safeTriggerLabelPhotoFallback() {
  try {
    if (typeof UI._triggerLabelPhotoFallback === 'function') {
      UI._triggerLabelPhotoFallback();
      return;
    }
  } catch (err) {
    console.warn('[Scanner] No se pudo activar fallback de foto:', err?.message || err);
  }
  UI.showToast('No pude encontrar el producto. Usa foto de etiqueta o registro manual.', 'warning');
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
      var kcal = Number(n['energy-kcal_100g'] || (n.energy_100g ? n.energy_100g / 4.184 : 0));
      var name = p.product_name_es || p.product_name || 'Producto escaneado';
      if (kcal > 0) {
        UI._scannerSetPhase(3);
        UI._scannerSetStatus('\u2705 "' + name + '" encontrado', false);
        UI._registerScannedProduct({
          name: name,
          calories_per_100g: Math.round(kcal),
          protein_per_100g: parseFloat((Number(n.proteins_100g) || 0).toFixed(1)),
          carbs_per_100g: parseFloat((Number(n.carbohydrates_100g) || 0).toFixed(1)),
          fat_per_100g: parseFloat((Number(n.fat_100g) || 0).toFixed(1)),
          fiber_per_100g: parseFloat((Number(n.fiber_100g) || 0).toFixed(1)),
          sugar_per_100g: parseFloat((Number(n.sugars_100g) || 0).toFixed(1)),
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
    var systemPrompt = 'Extrae los datos nutricionales de esta etiqueta y responde SOLO un JSON valido EXACTAMENTE con este formato:\n{"name":"Nombre del producto","calories":123,"protein":4.5,"carbs":20.1,"fat":2.3}\nNo agregues markdown, comentarios, ni texto fuera del JSON. Si falta un valor usa 0.';
    var apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + cfg.apiKey;
    var res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { inline_data: { mime_type: 'image/jpeg', data: processed.base64 } }
          ]
        }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.1, response_mime_type: 'application/json' }
      })
    });
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
    var name = String(parsed.name || 'Producto escaneado').trim();
    var calories = Math.max(0, Math.round(Number(parsed.calories) || 0));
    var protein = parseFloat((Number(parsed.protein) || 0).toFixed(1));
    var carbs = parseFloat((Number(parsed.carbs) || 0).toFixed(1));
    var fat = parseFloat((Number(parsed.fat) || 0).toFixed(1));
    if (!calories) throw new Error('No se encontraron calorias en la etiqueta');
    UI._scannerSetPhase(3);
    UI._scannerSetStatus('\u2756 "' + name + '" analizado con IA', false);
    UI._registerScannedProduct({
      name: name,
      calories_per_100g: calories,
      protein_per_100g: protein,
      carbs_per_100g: carbs,
      fat_per_100g: fat,
      fiber_per_100g: 0,
      sugar_per_100g: 0,
    }, 100, 'ai_label');
  } catch (err) {
    console.error('[Scanner][Gemini]', err);
    UI.showToast('No pude leer la etiqueta. Registralo manualmente.', 'error');
    UI._scannerSetStatus('Error al analizar etiqueta', false);
    UI.ScannerState.processed = false;
  }
}

/* Fase 4: persistir en el diario */
