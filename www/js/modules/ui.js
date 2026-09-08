import { App, LS, PersistenceCode } from './state.js';
import * as Utils from './utils.js';
import * as API from './api.js';
import { LOCAL_FOOD_DB } from './db.js';
import {
  FOOD_SOURCES,
  ValidationError,
  isLegacyQuickAdd,
  isQuickAdd,
  parseExternalNumber,
  parseUserNumber,
  validateFoodLog,
  validateProfile,
  validateWater,
  validateWeight,
} from './validation.js';
import {
  BackupError,
  commitPreparedBackup,
  parseAndPrepareBackup,
  serializeFilteredBackup,
} from './backup.js';

let _html5QrcodeLoaded = null;
function loadHtml5Qrcode() {
  if (_html5QrcodeLoaded) return _html5QrcodeLoaded;
  _html5QrcodeLoaded = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    s.onload = resolve;
    /* P2: Resetear el flag al fallar para que la precarga en idle no rompa el escáner
       para toda la sesión (permite reintentar cuando vuelva la red) */
    s.onerror = () => { _html5QrcodeLoaded = null; reject(new Error('html5-qrcode failed to load')); };
    document.head.appendChild(s);
  });
  return _html5QrcodeLoaded;
}

/* ══════════════════════════════════════════════════════════════
   P0 Optimización/estabilidad: Chart.js y lucide se cargan con
   `async` (no bloquean el arranque). Estas utilidades ejecutan el
   código de gráficas cuando la librería ya está disponible; si el
   CDN va lento o falla, la app NUNCA se rompe por `Chart is not
   defined` (antes un `new Chart()` lanzaba y podía dejar el
   dashboard vacío / la app rota al abrir en offline).
   ══════════════════════════════════════════════════════════════ */
const _chartQueue = [];
const _chartQueued = {};
function whenChartReady(fn) {
  if (typeof window.Chart !== 'undefined') {
    try { fn(); } catch (e) { console.error('[Chart] Error al crear gráfica:', e); }
    return;
  }
  _chartQueue.push(fn);
}
/* Crea la gráfica una sola vez aunque se pida varias veces antes de que
   cargue la librería (evita instancias duplicadas sobre el mismo canvas). */
function ensureChartOnce(key, factory) {
  if (_chartQueued[key]) return;
  _chartQueued[key] = true;
  whenChartReady(() => {
    _chartQueued[key] = false;
    factory();
  });
}
/* Vigila la carga de las librerías async y vacía la cola + pinta iconos. */
(function startLibWatcher() {
  let tries = 0;
  const poll = () => {
    const chartReady = typeof window.Chart !== 'undefined';
    if (chartReady && _chartQueue.length) {
      const q = _chartQueue.splice(0);
      q.forEach(fn => { try { fn(); } catch (e) { console.error('[Chart] Error al crear gráfica:', e); } });
    }
    if (typeof window.lucide !== 'undefined' && !window.__lucideIconsDone) {
      window.__lucideIconsDone = true;
      try { lucide.createIcons(); } catch (_) {}
    }
    if ((chartReady && typeof window.lucide !== 'undefined') || tries > 100) {
      /* Si el watcher se rinde (CDN caído >10s), liberar los flags de creación
         para que un reintento posterior (CDN recuperado) pueda crear las gráficas. */
      if (tries > 100) Object.keys(_chartQueued).forEach(k => { _chartQueued[k] = false; });
      return;
    }
    tries++;
    setTimeout(poll, 100);
  };
  poll();
})();

export function showToast(message, type = 'success', icon = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ', ai: '✦', offline: '✦', warning: '⚠' };

  /* ── P0: Prevención XSS — construir DOM sin innerHTML con datos del usuario ── */
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icon || icons[type] || '✓';
  const textNode = document.createTextNode(' ' + String(message || ''));
  toast.appendChild(iconSpan);
  toast.appendChild(textNode);

  if (type === 'offline' || type === 'warning') {
    toast.style.background = 'linear-gradient(135deg, #f59e0b, #fde68a)';
    toast.style.color = '#78350f';
    toast.style.border = '1px solid rgba(146,64,14,.25)';
  }
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3400);
}

export function showPersistenceFailure(error, action = 'guardar los datos') {
  console.error(`[Persistencia] No se pudo ${action}:`, error);
  const message = error?.code === PersistenceCode.ROLLBACK_FAILED
    ? `Error crítico al ${action}: no se pudo confirmar la recuperación de los datos anteriores.`
    : `No se pudo ${action}. Tus cambios no se aplicaron.`;
  showToast(message, 'error');
}

// Recuperación limitada a datos secundarios de presentación. No reescribe ni
// elimina el valor corrupto: queda disponible para diagnóstico/recuperación.
function readSecondary(key, fallback) {
  try {
    return LS.get(key, fallback);
  } catch (error) {
    console.error(`[Persistencia] Dato secundario no disponible (${key}):`, error);
    return fallback;
  }
}
export function setGreeting() {
  if (!App.user) return;
  const firstName = (App.user.name || 'Usuario').split(' ')[0];
  const el = document.getElementById('greeting-text');
  const elDate = document.getElementById('greeting-date');
  if (el) el.textContent = `${Utils.greetingByHour()}, ${firstName}`;
  if (elDate) elDate.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
export function navigateTo(page, dir = 0) {
  const current = document.querySelector('.page.active');
  const target = document.getElementById(`page-${page}`);
  if (!target || current === target) return;

  // Dirección automática según el orden de las páginas (para las animaciones)
  const order = ['home', 'diary', 'water', 'progress', 'profile'];
  if (!dir) {
    const curIdx = current ? order.indexOf(current.id.replace('page-', '')) : -1;
    const nextIdx = order.indexOf(page);
    dir = (curIdx !== -1 && nextIdx !== -1) ? Math.sign(nextIdx - curIdx) : 1;
  }

  // Activar will-change en ambas páginas antes de la transición
  target.style.willChange = 'opacity, transform';
  if (current) current.style.willChange = 'opacity, transform';

  current?.classList.remove('active');
  target.classList.add('active');

  // Animación direccional de entrada + aparición escalonada del contenido
  target.classList.remove('enter-from-left', 'enter-from-right', 'page-anim');
  void target.offsetWidth; /* reiniciar animaciones */
  target.classList.add(dir >= 0 ? 'enter-from-right' : 'enter-from-left', 'page-anim');

  // Limpiar will-change y clases temporales después de la transición
  // (enter-from-* termina a los ~0.32s; el stagger de page-anim puede llegar hasta ~0.72s)
  setTimeout(() => {
    target.style.willChange = 'auto';
    if (current) current.style.willChange = 'auto';
    target.classList.remove('enter-from-left', 'enter-from-right');
  }, 420);
  setTimeout(() => {
    target.classList.remove('page-anim');
  }, 820);

  App.currentPage = page; /* P2: fijar la página activa para refrescos post-guardado */

  // Actualizar navegación y otros estados...
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Disparar refrescos específicos según la página
  if (page === 'home') refreshDashboard();
  if (page === 'diary') {
    refreshDiary();
    /* P2: Precargar html5-qrcode en idle al entrar al Diario (escáner arranca rápido) */
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000));
    idle(() => loadHtml5Qrcode().catch(() => {}));
  }
  if (page === 'water') refreshWaterPage();
  if (page === 'progress') refreshProgress();
  if (page === 'profile') refreshProfile(); // ← CAMBIADO: loadProfile → refreshProfile

  /* P2: Detener dictado por voz al salir del Diario (libera el micrófono) */
  if (page !== 'diary' && App.recognition) {
    try { App.recognition.stop(); } catch (_) {}
    App.recognition = null;
    document.getElementById('ai-mic-btn')?.classList.remove('recording');
  }

  /* Re-render Lucide icons for dynamically changed elements */
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
export function injectWaterPage() {
  if (document.getElementById('page-water')) return;
  const wp = document.createElement('main');
  wp.className = 'page';
  wp.id = 'page-water';
  wp.innerHTML = `
    <div class="water-hero">
      <span class="water-bubble b1"></span>
      <span class="water-bubble b2"></span>
      <span class="water-bubble b3"></span>
      <span class="water-bubble b4"></span>
      <div class="water-progress-circle">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="10"/>
          <circle cx="70" cy="70" r="58" fill="none" stroke="white" stroke-width="10"
            stroke-dasharray="364" stroke-dashoffset="364" stroke-linecap="round"
            id="water-progress-arc" style="transition:stroke-dashoffset 0.6s ease"/>
        </svg>
        <div class="water-circle-text" style="color:white">
          <div class="water-glasses-big" id="wp-glasses">0</div>
          <div class="water-of">vasos</div>
          <div class="water-pct" id="wp-pct">0%</div>
        </div>
      </div>
      <div class="water-hero-title" id="wp-title">¡Hidrátate!</div>
      <div class="water-hero-sub"   id="wp-sub">Meta: 8 vasos diarios</div>
    </div>
    <div class="water-grid" id="water-big-grid"></div>
    <div class="water-actions">
      <button class="btn-water-add"    onclick="addWater()">+ Agregar vaso</button>
      <button class="btn-water-remove" onclick="removeWater()">− Quitar vaso</button>
    </div>
    <div class="chart-card">
      <div class="chart-card-title"><i data-lucide="droplets" class="lucide-pill"></i> Hidratación — últimos 7 días</div>
      <div class="chart-card-sub">Promedio diario de vasos</div>
      <div class="chart-container"><canvas id="water-chart"></canvas></div>
    </div>
  `;
  const appEl = document.getElementById('app');
  appEl.insertBefore(wp, document.querySelector('.bottom-nav'));
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
export function openManualFoodRegistration(seedText = '') {
  openAddFood(null, App.selectedAIMeal || 'breakfast');
  const seed = API.getAIFallbackSearchSeed(seedText);
  if (!seed) return;
  setTimeout(() => {
    const input = document.getElementById('food-search-input');
    if (!input) return;
    input.value = seed;
    searchFood(seed);
  }, 320);
}
export function triggerAIImagePicker() {
  const input = document.getElementById('ai-image-input');
  if (!input) return;
  input.value = '';
  input.click();
}
export function renderAIImagePreview() {
  const wrap = document.getElementById('ai-image-preview');
  const img = document.getElementById('ai-image-preview-img');
  const meta = document.getElementById('ai-image-preview-meta');
  const btn = document.getElementById('ai-camera-btn');

  if (!wrap || !img || !meta || !btn) return;

  if (!App.aiImage) {
    wrap.classList.add('hidden');
    img.removeAttribute('src');
    meta.textContent = 'JPEG optimizado';
    btn.classList.remove('has-image');
    return;
  }

  img.src = App.aiImage.previewUrl;
  meta.textContent = `${App.aiImage.width}×${App.aiImage.height}px · ${App.aiImage.sizeKB} KB · JPEG 0.8`;
  wrap.classList.remove('hidden');
  btn.classList.add('has-image');
}
export function clearAIImageSelection(silent = false) {
  if (App.aiImage?.previewUrl) {
    URL.revokeObjectURL(App.aiImage.previewUrl);
  }
  App.aiImage = null;
  const input = document.getElementById('ai-image-input');
  if (input) input.value = '';
  renderAIImagePreview();
  if (!silent) showToast('Foto eliminada', 'info');
}
export async function handleAIImageSelection(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  try {
    if (App.aiImage?.previewUrl) {
      URL.revokeObjectURL(App.aiImage.previewUrl);
    }
    App.aiImage = await API.processImageForAI(file);
    renderAIImagePreview();
    showToast('Foto lista para analizar', 'info');
  } catch (err) {
    console.error('[AI Vision] Error al preparar imagen:', err);
    clearAIImageSelection(true);
    showToast(err.message || 'No pude procesar la imagen seleccionada', 'error');
  }
}
export function renderAIResultsLoading(mode = 'text') {
  const resultsEl = document.getElementById('ai-results');
  const listEl = document.getElementById('ai-results-list');
  const totalEl = document.getElementById('ai-results-total');
  const titleEl = resultsEl?.querySelector('.ai-results-title');
  const confirmBtn = resultsEl?.querySelector('.btn-ai-confirm');
  if (!resultsEl || !listEl || !totalEl || !confirmBtn) return;

  if (titleEl) titleEl.textContent = mode === 'image' ? '✦ Analizando imagen…' : '✦ Analizando con IA…';
  listEl.innerHTML = Array(3).fill(`
    <div class="ai-skeleton-row">
      <div style="flex:1;min-width:0;padding-right:12px">
        <div class="skeleton" style="height:14px;width:62%;margin-bottom:8px"></div>
        <div class="skeleton" style="height:11px;width:38%"></div>
      </div>
      <div style="width:96px">
        <div class="skeleton" style="height:14px;width:80%;margin-left:auto;margin-bottom:8px"></div>
        <div class="skeleton" style="height:11px;width:100%"></div>
      </div>
    </div>`).join('');
  totalEl.innerHTML = `
    <div class="skeleton" style="height:54px;flex:1"></div>
    <div class="skeleton" style="height:54px;flex:1"></div>`;
  confirmBtn.disabled = true;
  confirmBtn.textContent = mode === 'image' ? 'Procesando foto…' : 'Procesando…';
  resultsEl.style.display = 'block';
}
export function updateAIResultsSummary() {
  const alimentos = App._pendingAIFoods;
  const resultsEl = document.getElementById('ai-results');
  const listEl = document.getElementById('ai-results-list');
  const totalEl = document.getElementById('ai-results-total');
  const titleEl = resultsEl?.querySelector('.ai-results-title');
  const confirmBtn = resultsEl?.querySelector('.btn-ai-confirm');
  if (!resultsEl || !listEl || !totalEl || !confirmBtn) return;

  if (!alimentos?.length) {
    resultsEl.style.display = 'none';
    return;
  }

  if (titleEl) titleEl.textContent = API.getAISourceTitle();
  confirmBtn.disabled = false;
  confirmBtn.textContent = '✎ Revisar antes de guardar';

  listEl.innerHTML = '';
  alimentos.forEach(a => {
    const item = document.createElement('div');
    item.className = 'ai-result-item';
    item.innerHTML = `
      <div class="ai-result-left">
        <div class="ai-result-name">${escapeHtml(a.alimento)}</div>
        <div class="ai-result-qty">${escapeHtml(API.makeAIResultQuantityLabel(a))}</div>
      </div>
      <div class="ai-result-macros">
        <div class="ai-result-kcal">${Math.round(a.kcal)} kcal</div>
        <div class="ai-result-prot">${Utils.round1(a.proteinas)}P · ${Utils.round1(a.carbohidratos)}C · ${Utils.round1(a.grasas)}G</div>
      </div>`;
    listEl.appendChild(item);
  });

  const candidateValue = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
  const totals = alimentos.reduce(
    (acc, a) => ({ kcal: acc.kcal + candidateValue(a.kcal), prot: acc.prot + candidateValue(a.proteinas), carbs: acc.carbs + candidateValue(a.carbohidratos), fat: acc.fat + candidateValue(a.grasas) }),
    { kcal: 0, prot: 0, carbs: 0, fat: 0 }
  );

  totalEl.innerHTML = `
    <div class="ai-total-item"><div class="ai-total-value">${Math.round(totals.kcal)}</div><div class="ai-total-label">kcal</div></div>
    <div class="ai-total-item"><div class="ai-total-value" style="color:var(--protein-color)">${Utils.round1(totals.prot).toFixed(1)}g</div><div class="ai-total-label">Prot</div></div>
    <div class="ai-total-item"><div class="ai-total-value" style="color:var(--carbs-color)">${Utils.round1(totals.carbs).toFixed(1)}g</div><div class="ai-total-label">Carbs</div></div>
    <div class="ai-total-item"><div class="ai-total-value" style="color:var(--fat-color)">${Utils.round1(totals.fat).toFixed(1)}g</div><div class="ai-total-label">Grasas</div></div>`;

  resultsEl.style.display = 'block';
}
export function renderAIFoodEditNav() {
  const nav = document.getElementById('ai-edit-nav');
  if (!nav) return;
  const foods = App._pendingAIFoods || [];
  nav.innerHTML = '';

  foods.forEach((food, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `ai-edit-chip ${index === App.aiEditorIndex ? 'active' : ''}`;
    chip.innerHTML = `<span class="ai-edit-chip-label">${escapeHtml(food.alimento)}</span>`;
    chip.onclick = () => selectAIFoodEditorItem(index);
    nav.appendChild(chip);
  });
}
export function renderAIFoodEditSummary() {
  const wrap = document.getElementById('ai-edit-summary');
  if (!wrap) return;
  const foods = App._pendingAIFoods || [];
  const totals = foods.reduce(
    (acc, food) => ({
      kcal: acc.kcal + (typeof food.kcal === 'number' && Number.isFinite(food.kcal) ? food.kcal : 0),
      prot: acc.prot + (typeof food.proteinas === 'number' && Number.isFinite(food.proteinas) ? food.proteinas : 0),
      carbs: acc.carbs + (typeof food.carbohidratos === 'number' && Number.isFinite(food.carbohidratos) ? food.carbohidratos : 0),
      fat: acc.fat + (typeof food.grasas === 'number' && Number.isFinite(food.grasas) ? food.grasas : 0),
    }),
    { kcal: 0, prot: 0, carbs: 0, fat: 0 }
  );

  wrap.innerHTML = `
    <div class="ai-edit-summary-title">Resumen editable (${foods.length} alimento${foods.length === 1 ? '' : 's'})</div>
    <div class="ai-edit-summary-grid">
      <div class="ai-edit-summary-item"><div class="ai-edit-summary-value">${Math.round(totals.kcal)}</div><div class="ai-edit-summary-label">kcal</div></div>
      <div class="ai-edit-summary-item"><div class="ai-edit-summary-value" style="color:var(--protein-color)">${Utils.round1(totals.prot).toFixed(1)}g</div><div class="ai-edit-summary-label">Prot</div></div>
      <div class="ai-edit-summary-item"><div class="ai-edit-summary-value" style="color:var(--carbs-color)">${Utils.round1(totals.carbs).toFixed(1)}g</div><div class="ai-edit-summary-label">Carbs</div></div>
      <div class="ai-edit-summary-item"><div class="ai-edit-summary-value" style="color:var(--fat-color)">${Utils.round1(totals.fat).toFixed(1)}g</div><div class="ai-edit-summary-label">Grasas</div></div>
    </div>`;
}
export function loadAIFoodIntoEditor(index = 0) {
  const food = App._pendingAIFoods?.[index];
  if (!food) return;
  App.aiEditorIndex = index;

  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  };

  setVal('ai-edit-name', food.alimento);
  setVal('ai-edit-grams', food.gramos_estimados);
  setVal('ai-edit-kcal', food.kcal);
  setVal('ai-edit-protein', Utils.round1(food.proteinas));
  setVal('ai-edit-carbs', Utils.round1(food.carbohidratos));
  setVal('ai-edit-fat', Utils.round1(food.grasas));

  const position = document.getElementById('ai-edit-position');
  if (position) position.textContent = `Alimento ${index + 1} de ${App._pendingAIFoods.length}`;

  renderAIFoodEditNav();
  renderAIFoodEditSummary();
}
export function persistCurrentAIFoodFromForm() {
  const foods = App._pendingAIFoods;
  if (!foods?.length) return null;
  const current = foods[App.aiEditorIndex];
  if (!current) return null;

  const name = document.getElementById('ai-edit-name')?.value.trim();
  const grams = parseUserNumber(document.getElementById('ai-edit-grams')?.value);
  const kcal = parseUserNumber(document.getElementById('ai-edit-kcal')?.value);
  const prot = Utils.round1(document.getElementById('ai-edit-protein')?.value);
  const carbs = Utils.round1(document.getElementById('ai-edit-carbs')?.value);
  const fat = Utils.round1(document.getElementById('ai-edit-fat')?.value);

  const updated = {
    ...current,
    alimento: name || '',
    gramos_estimados: grams,
    cantidad_estimada: grams !== null && grams > 0 ? `${grams}g` : 'Cantidad por confirmar',
    kcal,
    proteinas: prot,
    carbohidratos: carbs,
    grasas: fat,
  };

  foods[App.aiEditorIndex] = updated;
  updateAIResultsSummary();
  renderAIFoodEditNav();
  renderAIFoodEditSummary();
  return updated;
}
export function selectAIFoodEditorItem(index) {
  /* Limpiar el persist pendiente del debounce de gramos antes de cambiar de alimento */
  clearTimeout(_gramsPersistTimer);
  persistCurrentAIFoodFromForm();
  loadAIFoodIntoEditor(index);
}
export function openAIFoodEditModal(resetIndex = false) {
  if (!App._pendingAIFoods?.length) return;
  if (resetIndex || App.aiEditorIndex >= App._pendingAIFoods.length) {
    App.aiEditorIndex = 0;
  }

  const subtitle = document.getElementById('ai-edit-subtitle');
  if (subtitle) {
    subtitle.textContent = `Se guardará en ${API.getSelectedAIMealLabel()}. Los macros se ajustan automáticamente si cambias los gramos.`;
  }

  loadAIFoodIntoEditor(App.aiEditorIndex);
  document.getElementById('ai-edit-modal')?.classList.add('open');
}
export function closeAIFoodEditModal(event) {
  if (event && event.target !== document.getElementById('ai-edit-modal')) return;
  /* Limpiar el persist pendiente del debounce de gramos antes de cerrar */
  clearTimeout(_gramsPersistTimer);
  persistCurrentAIFoodFromForm();
  document.getElementById('ai-edit-modal')?.classList.remove('open');
}
export function validatePendingAIFoods() {
  const foods = App._pendingAIFoods || [];
  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    if (!String(food.alimento || '').trim()) {
      App.aiEditorIndex = i;
      loadAIFoodIntoEditor(i);
      showToast('Cada alimento debe tener un nombre', 'error');
      return false;
    }
    if (!Number.isFinite(food.gramos_estimados) || food.gramos_estimados <= 0) {
      App.aiEditorIndex = i;
      loadAIFoodIntoEditor(i);
      showToast('El peso debe ser mayor a 0 g', 'error');
      return false;
    }
  }
  return true;
}
export async function saveEditedAIFoods() {
  persistCurrentAIFoodFromForm();
  if (!validatePendingAIFoods()) return;

  const foods = App._pendingAIFoods;
  const mealType = App.selectedAIMeal || 'breakfast';
  const dateStr = Utils.toDateStr(App.currentDiaryDate);

  // 1. Construir TODOS los logs en un array
  const source = App.lastAISourceMode === 'offline'
    ? 'local'
    : App.lastAISourceMode === 'hybrid' ? 'hybrid' : 'ai';
  const newLogs = foods.map(a => ({
    id: crypto.randomUUID(),
    user_id: App.user?.id || 'local',
    date: dateStr,
    meal_type: mealType,
    food_name: a.alimento,
    quantity: a.gramos_estimados,
    calories: a.kcal,
    protein: a.proteinas,
    carbs: a.carbohidratos,
    fat: a.grasas,
    fiber: null,
    sugar: null,
    source,
    ...((source === 'ai' || source === 'hybrid') ? { ai_input_mode: App.lastAIInputMode } : {}),
  }));
  try {
    saveFoodLogsLocal(newLogs);
  } catch (error) {
    showPersistenceFailure(error, 'guardar los alimentos');
    return false;
  }

  // El resto del código igual
  closeAIFoodEditModal();
  clearAIResults();
  clearAIImageSelection(true);

  const ta = document.getElementById('ai-food-input');
  if (ta) ta.value = '';
  const count = document.getElementById('ai-char-count');
  if (count) count.textContent = '0/500';

  await refreshDiary();
  if (App.currentPage === 'home') await refreshDashboard();
  showToast(`✦ ${foods.length} alimento(s) guardado(s) en ${API.getSelectedAIMealLabel()}`, 'ai', '✦');
  return true;
}
let _gramsPersistTimer = null;
export function setupAIEditorListeners() {
  const gramsInput = document.getElementById('ai-edit-grams');
  
  // Escuchar cambios en el input de gramos
  gramsInput?.addEventListener('input', (e) => {
    const foods = App._pendingAIFoods;
    if (!foods?.length) return;
    const current = foods[App.aiEditorIndex];

    // 1. Guardar los valores "base" de referencia si no existen
    if (current._base_grams === undefined) {
      current._base_grams = current.gramos_estimados || 1;
      current._base_kcal = current.kcal;
      current._base_prot = current.proteinas;
      current._base_carbs = current.carbohidratos;
      current._base_fat = current.grasas;
    }

    const parsedGrams = parseUserNumber(e.target.value);
    if (parsedGrams === null || parsedGrams < 0) return;
    const newGrams = parsedGrams;
    
    // 2. Recalcular proporciones si la base es mayor a 0
    if (current._base_grams > 0) {
      const ratio = newGrams / current._base_grams;
      const kcalEl = document.getElementById('ai-edit-kcal');
      const protEl = document.getElementById('ai-edit-protein');
      const carbsEl = document.getElementById('ai-edit-carbs');
      const fatEl = document.getElementById('ai-edit-fat');

      if (kcalEl) kcalEl.value = Number.isFinite(current._base_kcal) ? Math.max(0, Math.round(current._base_kcal * ratio)) : '';
      if (protEl) protEl.value = Number.isFinite(current._base_prot) ? Utils.round1(current._base_prot * ratio) : '';
      if (carbsEl) carbsEl.value = Number.isFinite(current._base_carbs) ? Utils.round1(current._base_carbs * ratio) : '';
      if (fatEl) fatEl.value = Number.isFinite(current._base_fat) ? Utils.round1(current._base_fat * ratio) : '';
    }

    // 3. Persistir en el estado global (debounced: el recálculo de campos es inmediato,
    //    pero re-renderizar nav/resumen solo tras una pausa de escritura)
    clearTimeout(_gramsPersistTimer);
    _gramsPersistTimer = setTimeout(() => persistCurrentAIFoodFromForm(), 150);
  });

  // Escuchar cambios manuales en los macros para reiniciar la "base"
  ['ai-edit-kcal', 'ai-edit-protein', 'ai-edit-carbs', 'ai-edit-fat'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      persistCurrentAIFoodFromForm();
      
      // Si el usuario edita un macro manualmente, actualizamos la base para
      // que futuros cambios de gramos partan de esta nueva configuración
      const current = App._pendingAIFoods?.[App.aiEditorIndex];
      if (current) {
        current._base_grams = current.gramos_estimados || 1;
        current._base_kcal = current.kcal;
        current._base_prot = current.proteinas;
        current._base_carbs = current.carbohidratos;
        current._base_fat = current.grasas;
      }
    });
  });

  // Escuchar cambios en el nombre del alimento
  document.getElementById('ai-edit-name')?.addEventListener('input', () => {
    persistCurrentAIFoodFromForm();
  });
}
export function renderAIResults(alimentos) {
  if (!alimentos?.length) {
    showToast('La IA no detectó alimentos. Puedes registrarlos manualmente.', 'info');
    openManualFoodRegistration(document.getElementById('ai-food-input')?.value || '');
    return;
  }

  App._pendingAIFoods = alimentos.map(Utils.sanitizeAIFoodItem);
  App.aiEditorIndex = 0;
  updateAIResultsSummary();
  openAIFoodEditModal(true);
}
export function confirmAIFoods() {
  if (!App._pendingAIFoods?.length) return;
  openAIFoodEditModal();
}
export function clearAIResults() {
  const el = document.getElementById('ai-results');
  if (el) el.style.display = 'none';
  document.getElementById('ai-edit-modal')?.classList.remove('open');
  App._pendingAIFoods = null;
  App.aiEditorIndex = 0;
}
/* P0 Optimización: el insight IA se cachea por (día + totales) para no
   disparar una llamada de red a Gemini en CADA visita al Home con los mismos
   datos. El botón de refresh llama con force=true para forzar la reconsulta. */
let _aiInsightSig = '';
let _aiInsightText = null;
export async function refreshAIInsight(force = false) {
  if (!App.user) return;
  const bodyEl = document.getElementById('ai-insight-body');
  const textEl = document.getElementById('ai-insight-text');
  const thinkEl = document.getElementById('ai-thinking');
  if (!bodyEl || !textEl) return;

  const todayStr = Utils.toDateStr(new Date());
  const logs = readSecondary('food_logs_' + todayStr, []);
  const totals = logs.reduce(
    (acc, l) => ({
      cal: acc.cal + (finiteHistoricalNumber(l.calories) ?? 0),
      prot: acc.prot + (finiteHistoricalNumber(l.protein) ?? 0),
      carbs: acc.carbs + (finiteHistoricalNumber(l.carbs) ?? 0),
      fat: acc.fat + (finiteHistoricalNumber(l.fat) ?? 0),
    }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 }
  );
  const sig = todayStr + '|' + totals.cal + '|' + totals.prot + '|' + totals.carbs + '|' + totals.fat;

  /* Sin cambios → reusar el texto ya renderizado (evita re-llamar a Gemini) */
  if (!force && sig === _aiInsightSig && _aiInsightText !== null) {
    textEl.textContent = _aiInsightText;
    return;
  }
  _aiInsightSig = sig;

  const { daily_calories: goal, protein_goal: pGoal, carbs_goal: cGoal, fat_goal: fGoal } = App.user;
  const cfg = API.getAIConfig();

  if (!cfg) {
    _aiInsightText = generateLocalInsight(totals, { cal: goal, prot: pGoal, carbs: cGoal, fat: fGoal });
    textEl.textContent = _aiInsightText;
    return;
  }

  if (thinkEl) thinkEl.style.display = 'flex';
  if (textEl) textEl.style.display = 'none';

  try {
    const prompt = `Eres un coach nutricional. El usuario lleva hoy:
- Calorías: ${Math.round(totals.cal)} / ${goal} kcal
- Proteínas: ${Math.round(totals.prot)}g / ${pGoal}g
- Carbos: ${Math.round(totals.carbs)}g / ${cGoal}g
- Grasas: ${Math.round(totals.fat)}g / ${fGoal}g
- Objetivo: ${Utils.goalLabel(App.user.goal)}
Responde en español, 1-2 frases cortas y motivadoras. Da UNA recomendación específica. Sin emojis excesivos.`;

    const result = await API.callGeminiPlainText(cfg, prompt);
    _aiInsightText = result;
    if (textEl) { textEl.textContent = result; textEl.style.display = 'block'; }
  } catch (e) {
    _aiInsightText = generateLocalInsight(totals, { cal: goal, prot: pGoal, carbs: cGoal, fat: fGoal });
    if (textEl) {
      textEl.textContent = _aiInsightText;
      textEl.style.display = 'block';
    }
  } finally {
    if (thinkEl) thinkEl.style.display = 'none';
    if (textEl) textEl.style.display = 'block';
  }
}
export function generateLocalInsight(totals, goals) {
  if (totals.cal === 0) return 'Registra tus comidas para recibir un consejo personalizado.';
  const pctCal = totals.cal / goals.cal;
  const pctProt = totals.prot / goals.prot;
  const pctCarbs = totals.carbs / goals.carbs;
  const pctFat = totals.fat / goals.fat;
  if (pctProt < 0.5 && pctCal < 0.8) return `Hoy vas bajo en proteínas (${Math.round(pctProt * 100)}%). Considera añadir pollo, huevos o legumbres a tu próxima comida.`;
  if (pctCal > 1.1) return `Ya superaste tu meta calórica. Opta por verduras o infusiones para el resto del día.`;
  if (pctCarbs < 0.4) return `Llevas pocos carbohidratos. Un plátano o avena te darán energía sostenida.`;
  if (pctFat > 0.9 && pctProt < 0.6) return `Las grasas están altas. Refuerza proteínas con pechuga o claras de huevo.`;
  if (pctCal < 0.5) return `Llevas menos del 50% de tus calorías. ¡No te saltes comidas!`;
  return `¡Vas bien! Llevas ${Math.round(pctCal * 100)}% de tus calorías diarias. Mantén el equilibrio.`;
}
export function toggleVoiceInput() {
  const btn = document.getElementById('ai-mic-btn');
  const ta = document.getElementById('ai-food-input');

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Tu navegador no soporta dictado de voz', 'error');
    return;
  }

  if (App.recognition) {
    App.recognition.stop();
    App.recognition = null;
    btn?.classList.remove('recording');
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  App.recognition = new SR();
  App.recognition.lang = 'es-ES';
  App.recognition.continuous = false;
  App.recognition.interimResults = true;

  App.recognition.onstart = () => { btn?.classList.add('recording'); showToast('Dictando... habla ahora', 'info'); };
  App.recognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    if (ta) { ta.value = transcript; const c = document.getElementById('ai-char-count'); if (c) c.textContent = `${transcript.length}/500`; }
  };
  App.recognition.onend = () => { btn?.classList.remove('recording'); App.recognition = null; };
  App.recognition.onerror = (e) => { btn?.classList.remove('recording'); App.recognition = null; if (e.error !== 'aborted') showToast('Error en dictado: ' + e.error, 'error'); };
  App.recognition.start();
}
export function selectAIMeal(btn) {
  document.querySelectorAll('.ai-meal-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  App.selectedAIMeal = btn.dataset.meal;
}
export function getSelectedAIMeal() { return App.selectedAIMeal || 'breakfast'; }

/* ══════════════════════════════════════════════════════════════
   OPEN FOOD FACTS + BASE LOCAL (SISTEMA HÍBRIDO)
   Timeout: 4s → si no responde, usa base local.
   AbortController global para cancelar búsquedas anteriores.
   ══════════════════════════════════════════════════════════════ */

/* P1: Controlador global para cancelar la búsqueda activa */
// ─── FAVORITOS: Lectura con migración automática de clave legacy ───
export function getFavorites({ strict = false } = {}) {
  try {
    const current = LS.get('favorites', null);
    if (current !== null) return Array.isArray(current) ? current : [];

    // Alias histórico real: LS añade nt_, por lo que este nombre lógico lee
    // nt_nt_favorites. La migración escribe canonical y elimina el alias en
    // una sola transacción verificada.
    const legacy = LS.get('nt_favorites', null);
    if (!Array.isArray(legacy)) return [];
    LS.setMany({ favorites: legacy }, { remove: ['nt_favorites'] });
    return legacy;
  } catch (error) {
    if (strict) throw error;
    console.error('[Persistencia] No se pudieron leer/migrar los favoritos:', error);
    return [];
  }
}
// Recibe el id del log Y la referencia al botón para actualizar su texto en tiempo real
export function addLogToFavorites(logId, btnEl) {
  const log = App.diaryLogs.find(l => l.id === logId);
  if (!log) return;
  return toggleFavorite(log, (nextFavorites) => {
    if (!btnEl) return;
    const isNowFav = nextFavorites.some(f => getFoodIdentity(f) === getFoodIdentity(log));
    btnEl.textContent = isNowFav ? '★ En favoritos' : '☆ Favorito';
  });
}
export function removeFavorite(favId) {
  let favs;
  try {
    favs = getFavorites({ strict: true });
  } catch (error) {
    showPersistenceFailure(error, 'leer los favoritos');
    return false;
  }
  // Eliminar por nombre normalizado (consistente con la lógica de toggleFavorite)
  // con fallback a id para compatibilidad con datos anteriores
  const target = favs.find(f => f.id === favId);
  if (target) {
    const targetName = getFoodIdentity(target);
    favs = favs.filter(f => getFoodIdentity(f) !== targetName);
  } else {
    favs = favs.filter(f => f.id !== favId);
  }
  try {
    LS.setMany({ favorites: favs }, { remove: ['nt_favorites'] });
  } catch (error) {
    showPersistenceFailure(error, 'eliminar el favorito');
    return false;
  }
  renderFavorites();
  /* Refrescar el diario para que la estrella no quede obsoleta al quitar un
     favorito desde el modal. */
  if (App.diaryLogs?.length) refreshDiary();
  showToast('Eliminado de favoritos', 'info');
  return true;
}
export function renderFavorites() {
  const container = document.getElementById('favorites-list');
  if (!container) return;
  const favs = getFavorites();

  if (favs.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:32px 20px;text-align:center">
        <div class="empty-icon" style="font-size:2.5rem;margin-bottom:12px"><i data-lucide="star"></i></div>
        <p style="font-weight:700;margin-bottom:4px">Aún no tienes favoritos</p>
        <small style="color:var(--gray-500)">Abre un alimento del diario y pulsa
          <strong>☆ Favorito</strong> para guardarlo aquí.</small>
      </div>`;
    return;
  }

  container.innerHTML = '';
  favs.forEach(fav => {
    const item = document.createElement('div');
    item.className = 'fav-quick-item';
    item.innerHTML = `
      <div class="fav-quick-info">
        <div class="fav-quick-name">${escapeHtml(fav.food_name)}</div>
        <div class="fav-quick-cal">
          ${fav.quantity ? fav.quantity + 'g · ' : ''}${Math.round(fav.calories)} kcal
          ${fav.protein ? ' · ' + Math.round(fav.protein) + 'g prot' : ''}
        </div>
      </div>
      <div class="fav-quick-actions">
        <button class="btn-fav-quick-add" title="Añadir al diario" aria-label="Añadir al diario">+ Añadir</button>
        <button class="btn-quick-rem" title="Quitar de favoritos" aria-label="Quitar de favoritos"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
      </div>`;

    item.querySelector('.btn-fav-quick-add').addEventListener('click', (e) => {
      e.stopPropagation();
      prepareFavAdd(fav);
    });

    // Eliminar sin confirm() bloqueante — el toast confirma la acción
    item.querySelector('.btn-quick-rem').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavorite(fav.id);
    });

    container.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
export function toggleFavoritesModal(show, event) {
  if (event && event.target !== document.getElementById('favorites-modal') && !show) return;
  const modal = document.getElementById('favorites-modal');
  if (!modal) return;
  if (show) {
    pendingFavToAdd = null;  // limpiar estado previo al abrir
    document.getElementById('meal-selector-ui')?.classList.add('hidden');
    renderFavorites();
    modal.classList.add('open');
  } else {
    pendingFavToAdd = null;  // limpiar estado al cerrar para evitar datos obsoletos
    document.getElementById('meal-selector-ui')?.classList.add('hidden');
    modal.classList.remove('open');
  }
}
export let pendingFavToAdd = null;

export function prepareFavAdd(fav) {
  pendingFavToAdd = fav;
  const ui = document.getElementById('meal-selector-ui');
  if (ui) ui.classList.remove('hidden');
}
export let searchDebounceTimer = null;

export function openAddFood(event, mealType) {
  if (event) event.stopPropagation();
  App.currentMealType = mealType;
  App.selectedFood = null;

  const mealNames = { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snacks' };
  const titleEl = document.getElementById('modal-meal-title');
  if (titleEl) titleEl.textContent = `Añadir a ${mealNames[mealType] || 'Comida'}`;

  const searchInput = document.getElementById('food-search-input');
  if (searchInput) searchInput.value = '';
  document.getElementById('qty-picker-section')?.classList.add('hidden');
  const qi = document.getElementById('quick-cal-input');
  if (qi) qi.value = '';

  const body = document.getElementById('food-search-results');
  if (body) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="search"></i></div><p>Escribe para buscar alimentos<br><small>Base local (104) + Open Food Facts ES</small></p></div>`;
    API.updateSearchSourceBadge([]);
  }

  const modal = document.getElementById('food-modal');
  if (modal) { modal.classList.add('open'); setTimeout(() => searchInput?.focus(), 300); }
}
export function closeFoodModal(event) {
  if (event && event.target !== document.getElementById('food-modal')) return;
  document.getElementById('food-modal')?.classList.remove('open');
  App.selectedFood = null;
}
export function closeModal() {
  document.getElementById('food-modal')?.classList.remove('open');
  App.selectedFood = null;
}
export async function searchFood(query) {
  const q = query.trim();
  clearTimeout(searchDebounceTimer);

  if (q.length < 2) {
    const body = document.getElementById('food-search-results');
    if (body) body.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="search"></i></div><p>Escribe al menos 2 caracteres</p></div>`;
    API.updateSearchSourceBadge([]);
    document.getElementById('qty-picker-section')?.classList.add('hidden');
    return;
  }

  renderSearchSkeleton();
  searchDebounceTimer = setTimeout(() => {
    /* P0 Optimización: híbrido en 2 fases — resultados LOCALES al instante
       (base local, ~3ms) y los de Open Food Facts se suman cuando llegan.
       Antes la UI esperaba la petición remota (hasta 4s) para mostrar TODO. */
    API.searchFoodHybrid(
      q,
      (locals) => {
        renderFoodSearchResults(locals);
        API.updateSearchSourceBadge(locals);
        document.getElementById('qty-picker-section')?.classList.add('hidden');
        App.selectedFood = null;
      },
      (merged) => {
        renderFoodSearchResults(merged);
        API.updateSearchSourceBadge(merged);
      }
    );
  }, 350);
}
export function renderSearchSkeleton() {
  const body = document.getElementById('food-search-results');
  if (!body) return;
  body.innerHTML = Array(4).fill(`
    <div style="padding:12px 0;border-bottom:1px solid var(--gray-100)">
      <div class="skeleton" style="height:14px;width:60%;margin-bottom:8px"></div>
      <div class="skeleton" style="height:12px;width:40%"></div>
    </div>`).join('');
}
export function renderFoodSearchResults(foods) {
  const container = document.getElementById('food-search-results');
  if (!container) return;

  if (!foods?.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="search"></i></div><p>No se encontraron resultados<br><small>Prueba con otro nombre o sinónimo</small></p></div>`;
    API.updateSearchSourceBadge([]);
    return;
  }

  API.updateSearchSourceBadge(foods);
  container.innerHTML = '';

  const favs = getFavorites();

  foods.forEach(food => {
    const item = document.createElement('div');
    const sourceLabel = food.source === 'local' ? 'Base local' : (food.category || 'Open Food Facts ES');
    const sourceBadge = food.source === 'local'
      ? '<span style="font-size:.68rem;font-weight:800;color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:999px">LOCAL</span>'
      : '<span style="font-size:.68rem;font-weight:800;color:#047857;background:#d1fae5;padding:2px 6px;border-radius:999px">OFF</span>';

    const isFav = favs.some(f => getFoodIdentity(f) === getFoodIdentity(food));

    item.className = 'search-result-item item-enter';
    item.innerHTML = `
      <div>
        <div class="sri-name">${escapeHtml(food.name)}</div>
        <div class="sri-cal">${food.calories_per_100g} kcal/100g · ${food.protein_per_100g}g prot · <span style="font-size:.7rem;color:var(--emerald-600)">${escapeHtml(sourceLabel)}</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${sourceBadge}
        <button class="sri-fav-btn" title="Favorito" aria-label="Añadir a favoritos">${isFav ? '★' : '☆'}</button>
      </div>`;

    const favBtn = item.querySelector('.sri-fav-btn');
    favBtn.onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(food, (nextFavorites) => {
        const isNowFav = nextFavorites.some(f => getFoodIdentity(f) === getFoodIdentity(food));
        favBtn.textContent = isNowFav ? '★' : '☆';
        // Micro-animación de pop al tocar la estrella
        favBtn.classList.remove('just-toggled');
        void favBtn.offsetWidth; // fuerza reflow para reiniciar la animación
        favBtn.classList.add('just-toggled');
      });
    };

    item.onclick = () => selectFoodFromSearch(food);
    container.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
export function selectFoodFromSearch(food) {
  App.selectedFood = food;
  const nameEl = document.getElementById('selected-food-name');
  if (nameEl) nameEl.textContent = food.name;
  const qtyInput = document.getElementById('qty-input');
  if (qtyInput) qtyInput.value = food.defaultServingGrams || 100;
  document.getElementById('qty-picker-section')?.classList.remove('hidden');
}

function scaledCandidateValue(rawValue, ratio, field, { integer = false } = {}) {
  const parsed = parseExternalNumber(rawValue, field);
  if (parsed.error) throw new ValidationError(`Valor nutricional inválido: ${field}.`, [parsed.error]);
  if (parsed.value === null) return null;
  const scaled = parsed.value * ratio;
  return integer ? Math.round(scaled) : Math.round(scaled * 10) / 10;
}

export async function confirmAddFood() {
  const food = App.selectedFood;
  if (!food) return;

  const qty = parseUserNumber(document.getElementById('qty-input')?.value);
  if (qty === null || qty <= 0) {
    showToast('Ingresa una cantidad válida', 'error');
    return false;
  }
  const ratio = qty / 100;

  try {
    const source = FOOD_SOURCES.includes(food.source) ? food.source : 'local';
    const logData = {
      id: crypto.randomUUID(),
      user_id: App.user?.id || 'local',
      date: Utils.toDateStr(App.currentDiaryDate),
      meal_type: App.currentMealType,
      food_name: food.name,
      quantity: qty,
      calories: scaledCandidateValue(food.calories_per_100g, ratio, 'calories', { integer: true }),
      protein: scaledCandidateValue(food.protein_per_100g, ratio, 'protein'),
      carbs: scaledCandidateValue(food.carbs_per_100g, ratio, 'carbs'),
      fat: scaledCandidateValue(food.fat_per_100g, ratio, 'fat'),
      fiber: scaledCandidateValue(food.fiber_per_100g, ratio, 'fiber'),
      sugar: scaledCandidateValue(food.sugar_per_100g, ratio, 'sugar'),
      source,
      ...((source === 'ai' || source === 'hybrid') ? { ai_input_mode: 'text' } : {}),
      ...(source === 'ai_label' ? { ai_input_mode: 'image' } : {}),
    };
    saveFoodLogLocal(logData);
  } catch (error) {
    showPersistenceFailure(error, 'guardar el alimento');
    return false;
  }
  closeModal();
  await refreshDiary();
  if (App.currentPage === 'home') await refreshDashboard();
  showToast(`${food.name} añadido ✓`, 'success');
  return true;
}
export async function quickAddCalories() {
  const input = document.getElementById('quick-cal-input');
  const cal = parseUserNumber(input?.value);
  if (cal === null || cal <= 0 || cal > 9999) { showToast('Ingresa una cantidad válida', 'error'); return false; }

  try {
    saveFoodLogLocal({
      id: crypto.randomUUID(),
      user_id: App.user?.id || 'local',
      date: Utils.toDateStr(App.currentDiaryDate),
      meal_type: App.currentMealType,
      food_name: 'Entrada rápida',
      quantity: null,
      calories: cal,
      protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0,
      source: 'manual',
    });
  } catch (error) {
    showPersistenceFailure(error, 'guardar la entrada rápida');
    return false;
  }

  closeModal();
  await refreshDiary();
  if (App.currentPage === 'home') await refreshDashboard();
  showToast(`${cal} kcal añadidas`, 'success');
  return true;
}
export function saveFoodLogLocal(logData) {
  validateFoodLog(logData);
  const key = 'food_logs_' + logData.date;
  const existing = LS.get(key, []);
  const next = [...existing.filter(log => log?.id !== logData.id), logData];
  return LS.set(key, next);
}

export function saveFoodLogsLocal(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    throw new ValidationError('El lote debe contener al menos un FoodLog.', [
      { field: '$', code: 'TYPE', message: 'Se esperaba un array no vacío.' },
    ]);
  }
  logs.forEach(log => validateFoodLog(log));
  const date = logs[0].date;
  if (!logs.every(log => log.date === date)) {
    throw new ValidationError('Un lote debe pertenecer a una única fecha.', [
      { field: 'date', code: 'BATCH_DATE', message: 'El lote contiene fechas distintas.' },
    ]);
  }
  const ids = new Set();
  for (const log of logs) {
    if (ids.has(log.id)) {
      throw new ValidationError('El lote contiene IDs duplicados.', [
        { field: 'id', code: 'BATCH_DUPLICATE', message: `ID duplicado: ${log.id}.` },
      ]);
    }
    ids.add(log.id);
  }
  const key = 'food_logs_' + date;
  const existing = LS.get(key, []);
  const next = [...existing.filter(log => !ids.has(log?.id)), ...logs];
  return LS.set(key, next);
}
export function deleteFoodLogLocal(logId, dateStr) {
  const key = 'food_logs_' + dateStr;
  return LS.set(key, LS.get(key, []).filter(l => l.id !== logId));
}
export async function deleteFoodLog(logId) {
  if (!confirm('¿Eliminar este alimento?')) return;
  const dateStr = Utils.toDateStr(App.currentDiaryDate);
  try {
    deleteFoodLogLocal(logId, dateStr);
  } catch (error) {
    showPersistenceFailure(error, 'eliminar el alimento');
    return false;
  }
  await refreshDiary();
  if (App.currentPage === 'home') await refreshDashboard();
  showToast('Alimento eliminado', 'info');
  return true;
}

/* ══════════════════════════════════════════════════════════════
   EDITAR ALIMENTO YA REGISTRADO (modal de edición)
   Tocar un food-item no-IA abre este modal: permite ajustar
   gramos (con reescalado proporcional de macros), nombre y macros.
   ══════════════════════════════════════════════════════════════ */
let _editFoodLogId = null;
let _editFoodBase = null; // valores originales para el reescalado por gramos

export function openEditFoodModal(logId) {
  const log = App.diaryLogs.find(l => l.id === logId);
  if (!log) return;
  _editFoodLogId = logId;
  const quickAdd = isQuickAdd(log) || isLegacyQuickAdd(log);
  _editFoodBase = {
    quickAdd,
    grams: quickAdd ? null : finiteHistoricalNumber(log.quantity),
    kcal: finiteHistoricalNumber(log.calories),
    protein: finiteHistoricalNumber(log.protein),
    carbs: finiteHistoricalNumber(log.carbs),
    fat: finiteHistoricalNumber(log.fat),
  };

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  setVal('edit-food-name', log.food_name || '');
  setVal('edit-food-grams', _editFoodBase.grams);
  setVal('edit-food-kcal', _editFoodBase.kcal);
  setVal('edit-food-protein', _editFoodBase.protein);
  setVal('edit-food-carbs', _editFoodBase.carbs);
  setVal('edit-food-fat', _editFoodBase.fat);
  const gramsInput = document.getElementById('edit-food-grams');
  if (gramsInput) {
    gramsInput.disabled = quickAdd;
    if (quickAdd) gramsInput.value = '';
  }

  /* Fibra/azúcar: solo informativo (no editables), se conservan al guardar */
  const fiberEl = document.getElementById('edit-food-fiber');
  const sugarEl = document.getElementById('edit-food-sugar');
  const extraEl = document.getElementById('edit-food-extra');
  if (fiberEl) fiberEl.textContent = Math.round(log.fiber || 0);
  if (sugarEl) sugarEl.textContent = Math.round(log.sugar || 0);
  if (extraEl) extraEl.style.display = (log.fiber || log.sugar) ? 'block' : 'none';

  /* La nota de escalado proporcional solo aplica si hay gramos base > 0
     (las entradas rápidas guardan quantity=0 y no escalan macros) */
  const scaleNote = document.getElementById('edit-food-scale-note');
  if (scaleNote) scaleNote.style.display = !quickAdd && _editFoodBase.grams > 0 ? 'block' : 'none';

  updateEditFoodFavBtn(log);
  document.getElementById('edit-food-modal')?.classList.add('open');
}

function updateEditFoodFavBtn(log) {
  const btn = document.getElementById('edit-food-fav-btn');
  if (!btn) return;
  const isFav = getFavorites().some(f => getFoodIdentity(f) === getFoodIdentity(log));
  btn.textContent = isFav ? '★' : '☆';
}

export function closeEditFoodModal(event) {
  if (event && event.target !== document.getElementById('edit-food-modal')) return;
  document.getElementById('edit-food-modal')?.classList.remove('open');
  _editFoodLogId = null;
  _editFoodBase = null;
}

export async function saveEditedFoodLog() {
  if (!_editFoodLogId) return;
  const log = App.diaryLogs.find(l => l.id === _editFoodLogId);
  if (!log) {
    /* El log ya no existe (p. ej. se cambió de fecha con el modal abierto) */
    closeEditFoodModal();
    showToast('Este alimento ya no existe en el diario', 'error');
    return;
  }

  const name = document.getElementById('edit-food-name')?.value.trim();
  if (!name) { showToast('El nombre no puede estar vacío', 'error'); return; }
  const quickAdd = _editFoodBase?.quickAdd === true;
  const grams = quickAdd ? null : parseUserNumber(document.getElementById('edit-food-grams')?.value);
  const kcal = parseUserNumber(document.getElementById('edit-food-kcal')?.value);
  const protein = Utils.round1(document.getElementById('edit-food-protein')?.value);
  const carbs = Utils.round1(document.getElementById('edit-food-carbs')?.value);
  const fat = Utils.round1(document.getElementById('edit-food-fat')?.value);

  const updated = {
    id: log.id,
    user_id: log.user_id,
    date: log.date,
    meal_type: log.meal_type,
    food_name: name,
    quantity: grams,
    calories: kcal,
    protein: quickAdd ? 0 : protein,
    carbs: quickAdd ? 0 : carbs,
    fat: quickAdd ? 0 : fat,
    fiber: quickAdd ? 0 : (finiteHistoricalNumber(log.fiber) ?? null),
    sugar: quickAdd ? 0 : (finiteHistoricalNumber(log.sugar) ?? null),
    source: log.source,
    ...(Object.hasOwn(log, 'ai_input_mode') ? { ai_input_mode: log.ai_input_mode } : {}),
  };
  try {
    saveFoodLogLocal(updated);
  } catch (error) {
    showPersistenceFailure(error, 'actualizar el alimento');
    return false;
  }
  closeEditFoodModal();
  await refreshDiary();
  if (App.currentPage === 'home') await refreshDashboard();
  showToast('Alimento actualizado ✓', 'success');
  return true;
}

export function setupEditFoodListeners() {
  const gramsInput = document.getElementById('edit-food-grams');
  gramsInput?.addEventListener('input', (e) => {
    if (!_editFoodBase || _editFoodBase.quickAdd) return;
    const newGrams = parseUserNumber(e.target.value);
    if (newGrams === null || newGrams < 0) return;
    if (_editFoodBase.grams > 0) {
      const ratio = newGrams / _editFoodBase.grams;
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = Utils.round1(v); };
      setVal('edit-food-kcal', Math.max(0, Math.round(_editFoodBase.kcal * ratio)));
      setVal('edit-food-protein', _editFoodBase.protein * ratio);
      setVal('edit-food-carbs', _editFoodBase.carbs * ratio);
      setVal('edit-food-fat', _editFoodBase.fat * ratio);
    }
  });

  /* Si el usuario edita un macro manualmente, actualizar la base para
     que los siguientes cambios de gramos partan de la nueva configuración */
  ['edit-food-kcal', 'edit-food-protein', 'edit-food-carbs', 'edit-food-fat'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (!_editFoodBase) return;
      _editFoodBase.grams = parseUserNumber(document.getElementById('edit-food-grams')?.value);
      _editFoodBase.kcal = parseUserNumber(document.getElementById('edit-food-kcal')?.value);
      _editFoodBase.protein = parseUserNumber(document.getElementById('edit-food-protein')?.value);
      _editFoodBase.carbs = parseUserNumber(document.getElementById('edit-food-carbs')?.value);
      _editFoodBase.fat = parseUserNumber(document.getElementById('edit-food-fat')?.value);
    });
  });

  document.getElementById('edit-food-fav-btn')?.addEventListener('click', () => {
    const log = App.diaryLogs.find(l => l.id === _editFoodLogId);
    if (!log) return;
    toggleFavorite(log, () => updateEditFoodFavBtn(log));
  });

  document.getElementById('evt_edit_del')?.addEventListener('click', async () => {
    if (!_editFoodLogId) return;
    const logId = _editFoodLogId;
    if (await deleteFoodLog(logId)) closeEditFoodModal();
  });

  document.getElementById('evt_edit_save')?.addEventListener('click', () => saveEditedFoodLog());

  /* Cerrar al tocar el overlay (fuera de la hoja) */
  document.getElementById('edit-food-modal')?.addEventListener('click', (event) => closeEditFoodModal(event));

  /* ── Deslizar la hoja hacia abajo para cerrar con animación suave ── */
  const sheet = document.querySelector('#edit-food-modal .modal-sheet');
  if (sheet) {
    const body = sheet.querySelector('.modal-body');
    let startY = 0;
    let dragging = false;
    sheet.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      /* No secuestrar el gesto si el contenido interno está scrolleado */
      if (body && body.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      dragging = true;
      sheet.classList.add('dragging');
    }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      /* La hoja sigue al dedo; resistencia al deslizar hacia arriba */
      const shift = dy > 0 ? dy : Math.round(dy * 0.2);
      sheet.style.transform = `translateY(${shift}px)`;
      if (dy > 0) {
        const overlay = document.getElementById('edit-food-modal');
        if (overlay) overlay.style.opacity = Math.max(0, 1 - dy / 420);
      }
    }, { passive: true });
    const overlayEl = () => document.getElementById('edit-food-modal');
    const resetDragStyles = () => {
      sheet.classList.remove('dragging');
      sheet.style.transform = '';
      const overlay = overlayEl();
      if (overlay) { overlay.style.opacity = ''; overlay.style.transition = ''; }
    };
    sheet.addEventListener('touchend', (e) => {
      if (!dragging) return;
      dragging = false;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 110) {
        /* Cerrar: la hoja se desliza HACIA ABAJO con la transición suave y
           después de la animación se cierra el modal (antes se reseteaba el
           transform y la hoja volvía hacia arriba — anti-natural al gesto). */
        const overlay = overlayEl();
        sheet.classList.remove('dragging');
        sheet.style.transform = `translateY(${Math.max(dy, 120)}px)`; // quedarse donde está
        if (overlay) {
          overlay.style.transition = 'opacity .3s ease';
          overlay.style.opacity = '0';
        }
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          sheet.style.transform = '';
          sheet.removeEventListener('transitionend', onEnd);
          closeEditFoodModal();
        };
        const onEnd = (ev) => {
          if (ev.propertyName === 'transform') finish();
        };
        sheet.addEventListener('transitionend', onEnd);
        /* Arrancar la animación de deslizamiento desde la posición actual */
        void sheet.offsetHeight;
        sheet.style.transform = 'translateY(105vh)';
        /* Fallback por si transitionend no se dispara */
        setTimeout(finish, 400);
      } else {
        /* Arrastre corto → vuelve a su lugar */
        resetDragStyles();
      }
    }, { passive: true });
    /* Gesto interrumpido por el sistema (llamada, notificación…): limpiar sin cerrar */
    sheet.addEventListener('touchcancel', () => {
      if (!dragging) return;
      dragging = false;
      resetDragStyles();
    }, { passive: true });
  }
}
export async function refreshDashboard() {
  if (!App.user) return;
  const todayStr = Utils.toDateStr(new Date());
  let nextTodayLogs;
  let nextTodayWater;
  try {
    nextTodayLogs = LS.get('food_logs_' + todayStr, []);
    nextTodayWater = LS.get('water_' + todayStr, 0);
  } catch (error) {
    showPersistenceFailure(error, 'leer los datos de hoy');
    return false;
  }
  App.todayLogs = nextTodayLogs;
  App.todayWater = nextTodayWater;
  const totals = computeTotals(nextTodayLogs);

  updateCaloriesRing(totals.calories, App.user.daily_calories);
  updateMacroBars(totals);

  /* P0 Optimización: una sola pasada sobre los logs (antes 4 filter+reduce) */
  const mealCal = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (let i = 0; i < App.todayLogs.length; i++) {
    const m = App.todayLogs[i].meal_type;
    if (mealCal[m] !== undefined) mealCal[m] += (finiteHistoricalNumber(App.todayLogs[i].calories) ?? 0);
  }
  for (const m in mealCal) {
    const el = document.getElementById(`mini-${m}`);
    if (el) el.textContent = Math.round(mealCal[m]) + ' kcal';
  }

  renderDashboardWater();

  /* P2: Estado del Dashboard — mostrar mensaje neutral si el día está vacío */
  if (App.todayLogs.length > 0) {
    refreshAIInsight();
  } else {
    const textEl = document.getElementById('ai-insight-text');
    if (textEl) {
      textEl.textContent = '¡Hola, ' + (App.user.name || 'Usuario').split(' ')[0] +
        '! Registra tus primeras comidas del día para recibir consejos personalizados de tu Coach IA.';
    }
  }
  return true;
}
/* Los datos locales de versiones anteriores pueden contener números como
   strings. Sólo se aceptan conversiones completas y finitas para presentar y
   sumar; los demás valores se omiten sin modificar el registro persistido. */
export function finiteHistoricalNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = parseUserNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}
function roundedHistoricalValue(value) {
  const parsed = finiteHistoricalNumber(value);
  return parsed === null ? null : Math.round(parsed);
}
export function computeTotals(logs) {
  /* P0: Corrección de typo — acc.prot → acc.protein (evita NaN en dashboard) */
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (finiteHistoricalNumber(l.calories) ?? 0),
      protein: acc.protein + (finiteHistoricalNumber(l.protein) ?? 0),
      carbs: acc.carbs + (finiteHistoricalNumber(l.carbs) ?? 0),
      fat: acc.fat + (finiteHistoricalNumber(l.fat) ?? 0),
      fiber: acc.fiber + (finiteHistoricalNumber(l.fiber) ?? 0),
      sugar: acc.sugar + (finiteHistoricalNumber(l.sugar) ?? 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
  );
}
let _ringData = null; /* P0: últimos datos del anillo mientras Chart.js carga (CDN async) */
export function updateCaloriesRing(consumed, goal) {
  const remaining = Math.max(0, goal - consumed);
  const over = consumed > goal;

  document.getElementById('ring-remaining').textContent = over ? 'Excedido' : Math.round(remaining);
  document.getElementById('dash-consumed').textContent = Math.round(consumed);
  document.getElementById('dash-goal').textContent = goal;

  const ctx = document.getElementById('calories-ring');
  if (!ctx) return;

  const displayConsumed = Math.round(consumed);
  const displayRemain = Math.max(0, goal - displayConsumed);
  const color = over ? '#ef4444' : 'rgba(255,255,255,.9)';

  if (App.caloriesRingChart) {
    App.caloriesRingChart.data.datasets[0].data = [displayConsumed, displayRemain];
    App.caloriesRingChart.data.datasets[0].backgroundColor = [color, 'rgba(255,255,255,.2)'];
    App.caloriesRingChart.update('none');
    return;
  }

  /* P0: creación resiliente — se ejecuta cuando Chart.js ya cargó (CDN async) */
  _ringData = { ctx, displayConsumed, displayRemain, color };
  ensureChartOnce('ring', () => {
    if (App.caloriesRingChart || !_ringData) return;
    App.caloriesRingChart = new Chart(_ringData.ctx.getContext('2d'), {
      type: 'doughnut',
      data: { datasets: [{ data: [_ringData.displayConsumed, _ringData.displayRemain], backgroundColor: [_ringData.color, 'rgba(255,255,255,.2)'], borderWidth: 0, hoverOffset: 0 }] },
      options: { cutout: '72%', responsive: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 700, easing: 'easeInOutQuart' } }
    });
  });
}
export function updateMacroBars(totals) {
  if (!App.user) return;
  [
    { key: 'protein', goal: App.user.protein_goal, el: 'dash-protein', bar: 'bar-protein', goalEl: 'dash-protein-goal' },
    { key: 'carbs', goal: App.user.carbs_goal, el: 'dash-carbs', bar: 'bar-carbs', goalEl: 'dash-carbs-goal' },
    { key: 'fat', goal: App.user.fat_goal, el: 'dash-fat', bar: 'bar-fat', goalEl: 'dash-fat-goal' }
  ].forEach(m => {
    const val = Math.round(totals[m.key]);
    const pct = Math.min(100, Math.round((val / m.goal) * 100));
    const el = document.getElementById(m.el);
    const bar = document.getElementById(m.bar);
    const goalEl = document.getElementById(m.goalEl);
    if (el) el.textContent = val;
    if (goalEl) goalEl.textContent = m.goal;
    if (bar) bar.style.width = pct + '%';
  });
}
export function loadTodayWater() {
  const todayStr = Utils.toDateStr(new Date());
  App.todayWater = LS.get('water_' + todayStr, 0);
}
/* Pop táctil del vaso — reinicia la animación en re-toques rápidos */
function popGlass(btn) {
  btn.classList.remove('tapped');
  void btn.offsetWidth; /* reflow: reinicia la animación aunque ya estuviera activa */
  btn.classList.add('tapped');
  setTimeout(() => btn.classList.remove('tapped'), 500);
}
export function renderDashboardWater(forceRebuild = false) {
  const goal = App.user?.water_goal || 8;
  const current = App.todayWater || 0;
  const countEl = document.getElementById('dash-water');
  const goalEl = document.getElementById('dash-water-goal');
  if (countEl) countEl.textContent = current;
  if (goalEl) goalEl.textContent = goal;
  const bar = document.getElementById('dash-water-bar');
  if (bar) bar.style.width = Math.min(100, (current / goal) * 100) + '%';
  const container = document.getElementById('dash-water-glasses');
  if (!container) return;
  const needsRebuild = forceRebuild || container.children.length !== goal;
  if (needsRebuild) {
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < goal; i++) {
      const btn = document.createElement('button');
      btn.className = 'glass-btn';
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', 'droplets');
      btn.appendChild(icon);
      btn.title = `Vaso ${i + 1}`;
      btn.onclick = () => { popGlass(btn); quickSetWater(i + 1); };
      fragment.appendChild(btn);
    }
    container.appendChild(fragment);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  [...container.children].forEach((btn, i) => {
    btn.classList.toggle('filled', i < current);
  });
}
export async function quickSetWater(glasses) {
  const goal = App.user?.water_goal || 8;
  try {
    validateWater(glasses);
    LS.set('water_' + Utils.toDateStr(new Date()), glasses);
  } catch (error) {
    showPersistenceFailure(error, 'guardar el agua');
    return false;
  }
  App.todayWater = glasses;
  renderDashboardWater();
  if (glasses >= goal) showToast('¡Meta de hidratación alcanzada! 🎉', 'success');
  else showToast(`${glasses} vasos registrados`, 'info');
  return true;
}
export async function refreshDiary() {
  const dateStr = Utils.toDateStr(App.currentDiaryDate);
  const label = document.getElementById('diary-date-label');
  if (label) label.textContent = Utils.formatDateLabel(App.currentDiaryDate);
  try {
    App.diaryLogs = LS.get('food_logs_' + dateStr, []);
  } catch (error) {
    showPersistenceFailure(error, 'leer el diario');
    return false;
  }
  renderDiaryMeals(App.diaryLogs);
  return true;
}
export function changeDate(delta) {
  const d = new Date(App.currentDiaryDate);
  d.setDate(d.getDate() + delta);
  App.currentDiaryDate = d;
  refreshDiary();
}
/* P2: Solo anima los ítems nuevos (evita re-disparar cascadeFadeIn sobre toda la lista) */
let _renderedDiaryIds = new Set();
let _renderedDiaryDate = '';
export function renderDiaryMeals(logs) {
  const dateStr = Utils.toDateStr(App.currentDiaryDate);
  if (dateStr !== _renderedDiaryDate) {
    _renderedDiaryDate = dateStr;
    _renderedDiaryIds = new Set();
  }
  const favIdentitySet = new Set(getFavorites().map(getFoodIdentity));
  const newIds = new Set(logs.map(l => l.id));
  const animateOnlyNew = _renderedDiaryIds.size > 0;
  ['breakfast', 'lunch', 'dinner', 'snack'].forEach(meal => {
    const mealLogs = logs.filter(l => l.meal_type === meal);
    const list = document.getElementById(`food-list-${meal}`);
    if (!list) return;
    const calEl = list.parentElement?.querySelector('.meal-cal-display');
    if (calEl) {
      calEl.textContent = Math.round(mealLogs.reduce(
        (sum, log) => sum + (finiteHistoricalNumber(log.calories) ?? 0),
        0,
      ));
    }
    if (!mealLogs.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="utensils"></i></div><p>Sin alimentos registrados<br><small>Usa IA o búsqueda manual ↑</small></p></div>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    mealLogs.forEach(log => {
      const wrapper = createFoodItem(log, favIdentitySet);
      // No re-animar ítems que ya estaban renderizados en el DOM
      if (animateOnlyNew && _renderedDiaryIds.has(log.id)) {
        wrapper.querySelector('.food-item')?.classList.remove('item-enter');
      }
      fragment.appendChild(wrapper);
    });
    list.innerHTML = '';
    list.appendChild(fragment);
  });
  _renderedDiaryIds = newIds;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
export function createFoodItem(log, favIdentitySet) {
  const favoriteEligible = (() => {
    try { validateFoodLog(log); return log.quantity !== null; } catch (_) { return false; }
  })();
  const isFav = favoriteEligible && (favIdentitySet ? favIdentitySet.has(getFoodIdentity(log)) : getFavorites().some(f => getFoodIdentity(f) === getFoodIdentity(log)));
  const source = log.source;
  const wrapper = document.createElement('div');
  wrapper.dataset.logId = log.id;
  const item = document.createElement('div');
  item.className = 'food-item item-enter';
  const sourceBadges = {
    ai: ['ai', 'IA'],
    hybrid: ['ai', 'Híbrido'],
    ai_label: ['ai', 'Etiqueta IA'],
    local: ['off', 'LOCAL'],
    off: ['off', 'OFF'],
    manual: ['manual', 'Manual'],
  };
  const [badgeClass, badgeLabel] = sourceBadges[source] || ['manual', 'Origen inválido'];
  const badgeHtml = `<span class="food-source-badge ${badgeClass}">${badgeLabel}</span>`;
  const dotClass = ['ai', 'hybrid', 'ai_label'].includes(source) ? 'food-item-dot ai-source' : 'food-item-dot';
  const quantity = finiteHistoricalNumber(log.quantity);
  const calories = roundedHistoricalValue(log.calories);
  const protein = roundedHistoricalValue(log.protein);
  const carbs = roundedHistoricalValue(log.carbs);
  const fat = roundedHistoricalValue(log.fat);
  const fiber = roundedHistoricalValue(log.fiber);
  const quickAdd = isQuickAdd(log) || isLegacyQuickAdd(log);
  let quantityLabel;
  if (quickAdd) quantityLabel = 'Calorías manuales';
  else if (!Object.hasOwn(log, 'quantity')) quantityLabel = '—';
  else if (log.quantity === null) quantityLabel = 'Sin dato';
  else if (typeof log.quantity === 'string' && quantity !== null) quantityLabel = `${escapeHtml(quantity)}g ⚠`;
  else if (quantity === null || quantity <= 0) quantityLabel = '— ⚠';
  else quantityLabel = `${escapeHtml(quantity)}g`;
  item.innerHTML = `<div class="food-item-left"> <div class="${dotClass}"></div> <div class="food-item-info"> <div class="food-item-name">${escapeHtml(log.food_name)}</div> <div class="food-item-qty">${quantityLabel}</div> </div> ${badgeHtml} </div> <div class="food-item-cal">${calories === null ? '—' : calories + ' kcal'}</div>`;
  /* Bloque expandible: macros + acciones (favorito / editar / eliminar).
     Se inserta DESPUÉS del ítem en el DOM para que se despliegue hacia abajo
     (antes iba antes en el orden de hijos y la info aparecía arriba del alimento). */
  const expanded = document.createElement('div');
  expanded.className = 'food-item-expanded';
  expanded.innerHTML = `
    <div class="food-expanded-inner">
      <div class="food-micro-grid">
        <div class="micro-item"><div class="micro-val" style="color:var(--protein-color)">${protein ?? '—'}${protein === null ? '' : 'g'}</div><div class="micro-lbl">Prot</div></div>
        <div class="micro-item"><div class="micro-val" style="color:var(--carbs-color)">${carbs ?? '—'}${carbs === null ? '' : 'g'}</div><div class="micro-lbl">Carbs</div></div>
        <div class="micro-item"><div class="micro-val" style="color:var(--fat-color)">${fat ?? '—'}${fat === null ? '' : 'g'}</div><div class="micro-lbl">Grasas</div></div>
        <div class="micro-item"><div class="micro-val">${fiber ?? '—'}${fiber === null ? '' : 'g'}</div><div class="micro-lbl">Fibra</div></div>
      </div>
      <div class="food-expanded-actions">
        <button class="btn-fav-food" aria-label="Favorito" ${favoriteEligible ? '' : 'disabled title="Registro no válido para favoritos"'}>${isFav ? '★ En favoritos' : '☆ Favorito'}</button>
        <button class="btn-edit-food" aria-label="Editar alimento"><i data-lucide="pencil" style="width:14px;height:14px;vertical-align:-2px"></i> Editar</button>
        <button class="btn-delete-food" aria-label="Eliminar alimento"><i data-lucide="trash-2" style="width:14px;height:14px;vertical-align:-2px"></i> Eliminar</button>
      </div>
    </div>`;
  expanded.querySelector('.btn-fav-food').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!favoriteEligible) return;
    addLogToFavorites(log.id, expanded.querySelector('.btn-fav-food'));
  });
  expanded.querySelector('.btn-edit-food').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditFoodModal(log.id);
  });
  expanded.querySelector('.btn-delete-food').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteFoodLog(log.id);
  });

  /* Tocar el ítem despliega/contrae su info con animación suave */
  item.onclick = () => toggleFoodExpanded(wrapper);
  wrapper.appendChild(item);
  wrapper.appendChild(expanded);
  return wrapper;
}

/* Abre/cierra la info nutricional de un ítem del diario. Al abrir uno se
   cierran los demás de todo el diario (solo un bloque desplegado a la vez). */
function toggleFoodExpanded(wrapper) {
  const expanded = wrapper.querySelector('.food-item-expanded');
  if (!expanded) return;
  const willOpen = !expanded.classList.contains('open');
  if (willOpen) {
    document.querySelectorAll('.food-item-expanded.open').forEach(el => {
      if (el !== expanded) el.classList.remove('open');
    });
  }
  expanded.classList.toggle('open');
}
export function toggleMealSection() { /* secciones siempre expandidas */ }

/* P0 Optimización: escape de texto con tabla de caracteres (antes creaba un
   elemento DOM por llamada — cientos de nodos por cada renderizado de listas). */
const _ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(str) {
  /* P0: paridad con el comportamiento anterior (str || '') para falsy */
  return String(str || '').replace(/[&<>"']/g, c => _ESC_MAP[c]);
}
export async function refreshWaterPage(reloadFromStorage = true) {
  if (reloadFromStorage) {
    try {
      loadTodayWater();
    } catch (error) {
      showPersistenceFailure(error, 'leer el agua de hoy');
      return false;
    }
  }
  const goal = App.user?.water_goal || 8;
  const current = App.todayWater || 0;

  updateWaterProgressArc(current, goal);
  const pctEl = document.getElementById('wp-pct');
  if (pctEl) pctEl.textContent = Math.round((current / goal) * 100) + '%';
  const hero = document.querySelector('.water-hero');
  if (hero) hero.classList.toggle('goal-reached', current >= goal && current > 0);
  const wpGlasses = document.getElementById('wp-glasses');
  if (wpGlasses) wpGlasses.textContent = current;
  const wpTitle = document.getElementById('wp-title');
  if (wpTitle) {
    if (current === 0) wpTitle.textContent = '¡Hidrátate!';
    else if (current < goal) wpTitle.textContent = '¡Sigue hidrátándote!';
    else wpTitle.textContent = '¡Meta alcanzada!';
  }
  const wpSub = document.getElementById('wp-sub');
  if (wpSub) wpSub.textContent = `Meta: ${goal} vasos diarios · ${current}/${goal}`;

  renderBigGlassGrid(current, goal);
  renderWaterChart();
  return true;
}
export function updateWaterProgressArc(current, goal) {
  const arc = document.getElementById('water-progress-arc');
  if (!arc) return;
  const circ = 2 * Math.PI * 58;
  const pct = Math.min(current / goal, 1);
  arc.style.strokeDasharray = circ.toFixed(1);
  arc.style.strokeDashoffset = (circ - pct * circ).toFixed(1);
}
export function renderBigGlassGrid(current, goal) {
  const grid = document.getElementById('water-big-grid');
  if (!grid) return;
  const needsRebuild = grid.children.length !== goal;
  if (needsRebuild) {
    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < goal; i++) {
      const btn = document.createElement('button');
      btn.className = 'big-glass-btn';
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', 'droplets');
      btn.appendChild(icon);
      btn.title = `Vaso ${i + 1}`;
      btn.onclick = () => { popGlass(btn); setWaterTo(i + 1); };
      fragment.appendChild(btn);
    }
    grid.appendChild(fragment);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  [...grid.children].forEach((btn, i) => {
    btn.classList.toggle('filled', i < current);
  });
}
export async function addWater() {
  const goal = App.user?.water_goal || 8;
  if (App.todayWater >= goal) { showToast('¡Meta de hidratación alcanzada!', 'info'); return; }
  const next = App.todayWater + 1;
  try {
    validateWater(next);
    LS.set('water_' + Utils.toDateStr(new Date()), next);
  } catch (error) {
    showPersistenceFailure(error, 'guardar el agua');
    return false;
  }
  App.todayWater = next;
  await refreshWaterPage(false);
  renderDashboardWater();
  if (App.todayWater === goal) showToast('¡Meta de hidratación alcanzada!', 'success');
  else showToast(`+1 vaso → ${App.todayWater}/${goal}`, 'info');
  return true;
}
export async function removeWater() {
  if (App.todayWater <= 0) return;
  const next = App.todayWater - 1;
  try {
    validateWater(next);
    LS.set('water_' + Utils.toDateStr(new Date()), next);
  } catch (error) {
    showPersistenceFailure(error, 'guardar el agua');
    return false;
  }
  App.todayWater = next;
  await refreshWaterPage(false);
  renderDashboardWater();
  showToast(`Vaso removido → ${App.todayWater}`, 'info');
  return true;
}
export async function setWaterTo(count) {
  const goal = App.user?.water_goal || 8;
  try {
    validateWater(count);
    LS.set('water_' + Utils.toDateStr(new Date()), count);
  } catch (error) {
    showPersistenceFailure(error, 'guardar el agua');
    return false;
  }
  App.todayWater = count;
  await refreshWaterPage(false);
  renderDashboardWater();
  if (count >= goal) showToast('¡Meta de hidratación alcanzada! 🎉', 'success');
  else showToast(`${count} vasos registrados`, 'info');
  return true;
}
export function renderWaterChart() {
  const canvas = document.getElementById('water-chart');
  if (!canvas) return;
  const goal = App.user?.water_goal || 8;
  const labels = [], values = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('es-ES', { weekday: 'short' }));
    values.push(readSecondary('water_' + Utils.toDateStr(d), 0));
  }
  if (App.waterChartInst) {
    App.waterChartInst.data.labels = labels;
    App.waterChartInst.data.datasets[0].data = values;
    App.waterChartInst.data.datasets[0].backgroundColor = values.map(v => v >= goal ? '#3b82f6' : 'rgba(59,130,246,.4)');
    App.waterChartInst.update('none');
    return;
  }
  /* P0: creación resiliente (CDN async) */
  const cfg = { labels, values, goal };
  ensureChartOnce('water', () => {
    if (App.waterChartInst) return;
    App.waterChartInst = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: cfg.labels, datasets: [{ label: 'Vasos', data: cfg.values, backgroundColor: cfg.values.map(v => v >= cfg.goal ? '#3b82f6' : 'rgba(59,130,246,.4)'), borderRadius: 8, borderSkipped: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} vasos` } } }, scales: { y: { beginAtZero: true, max: cfg.goal + 2, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { stepSize: 2, font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } } }
    });
  });
}
export async function refreshProgress() {
  if (!App.user) return;
  loadAndRenderWeightChart();
  loadAndRenderCaloriesChart();
}
export function loadAndRenderWeightChart() {
  const canvas = document.getElementById('weight-chart');
  if (!canvas) return;
  let weightLogs = readSecondary('weight_logs', []).sort((a, b) => a.date.localeCompare(b.date));
  if (!weightLogs.length && App.user.weight) weightLogs = [{ date: Utils.toDateStr(new Date()), weight: App.user.weight }];

  const labels = weightLogs.map(l => { const d = new Date(l.date + 'T12:00:00'); return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); });
  const data = weightLogs.map(l => l.weight);
  const first = Number(App.user.initial_weight) || data[0] || App.user.weight;
  const last = data[data.length - 1] || App.user.weight;
  const change = last - first;

  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setEl('stat-current-weight', last + ' kg');
  setEl('stat-initial-weight', first + ' kg');
  const changeEl = document.getElementById('stat-change');
  if (changeEl) {
    changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(1) + ' kg';
    changeEl.style.color = change > 0
      ? (App.user.goal === 'gain_muscle' ? 'var(--emerald-600)' : 'var(--danger)')
      : change < 0
        ? (App.user.goal === 'lose_weight' ? 'var(--emerald-600)' : 'var(--danger)')
        : 'var(--gray-600)';
  }

  if (App.weightChartInst) { App.weightChartInst.data.labels = labels; App.weightChartInst.data.datasets[0].data = data; App.weightChartInst.update('none'); return; }
  /* P0: creación resiliente (CDN async) */
  const wcfg = { labels, data, canvas };
  ensureChartOnce('weight', () => {
    if (App.weightChartInst) return;
    App.weightChartInst = new Chart(wcfg.canvas.getContext('2d'), {
      type: 'line',
      data: { labels: wcfg.labels, datasets: [{ label: 'Peso (kg)', data: wcfg.data, borderColor: 'var(--emerald-500)', backgroundColor: 'rgba(16,185,129,.1)', borderWidth: 2.5, pointBackgroundColor: 'var(--emerald-500)', pointBorderColor: 'white', pointBorderWidth: 2, pointRadius: 5, fill: true, tension: .4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} kg` } } }, scales: { y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } } }
    });
  });
}
export function loadAndRenderCaloriesChart() {
  const canvas = document.getElementById('calories-chart');
  if (!canvas) return;
  const dailyGoal = App.user?.daily_calories || 2000;
  const labels = [], consumed = [], goalLine = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('es-ES', { weekday: 'short' }));
    const dayLogs = readSecondary('food_logs_' + Utils.toDateStr(d), []);
    consumed.push(Math.round(dayLogs.reduce(
      (sum, log) => sum + (finiteHistoricalNumber(log.calories) ?? 0),
      0,
    )));
    goalLine.push(dailyGoal);
  }

  if (App.caloriesChartInst) {
    App.caloriesChartInst.data.labels = labels;
    App.caloriesChartInst.data.datasets[0].data = consumed;
    App.caloriesChartInst.data.datasets[0].backgroundColor = consumed.map(v => v > dailyGoal ? 'rgba(239,68,68,.7)' : 'rgba(16,185,129,.7)');
    App.caloriesChartInst.data.datasets[1].data = goalLine;
    App.caloriesChartInst.update('none');
    return;
  }
  /* P0: creación resiliente (CDN async) */
  const ccfg = { labels, consumed, goalLine, dailyGoal, canvas };
  ensureChartOnce('calories', () => {
    if (App.caloriesChartInst) return;
    App.caloriesChartInst = new Chart(ccfg.canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ccfg.labels, datasets: [
          { label: 'Consumido', data: ccfg.consumed, backgroundColor: ccfg.consumed.map(v => v > ccfg.dailyGoal ? 'rgba(239,68,68,.7)' : 'rgba(16,185,129,.7)'), borderRadius: 8, borderSkipped: false },
          { label: 'Meta', data: ccfg.goalLine, type: 'line', borderColor: 'rgba(245,158,11,.8)', borderWidth: 2, borderDash: [6, 4], pointRadius: 0, fill: false }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, usePointStyle: true } }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} kcal` } } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } } }
    });
  });
}
export async function logWeight() {
  const input = document.getElementById('log-weight-input');
  const weight = parseUserNumber(input?.value);
  try { validateWeight(weight); } catch (_) { showToast('Ingresa un peso válido (20-300 kg)', 'error'); return false; }

  const todayStr = Utils.toDateStr(new Date());
  let currentLogs;
  try {
    currentLogs = LS.get('weight_logs', []);
  } catch (error) {
    showPersistenceFailure(error, 'leer el historial de peso');
    return false;
  }
  const hasToday = currentLogs.some((log) => log.date === todayStr);
  const nextWeightLogs = hasToday
    ? currentLogs.map((log) => log.date === todayStr ? { ...log, weight } : log)
    : [...currentLogs, { date: todayStr, weight }];
  const nextUser = { ...App.user, weight };

  try {
    LS.setMany({ weight_logs: nextWeightLogs, user: nextUser });
  } catch (error) {
    showPersistenceFailure(error, 'registrar el peso');
    return false;
  }

  App.user = nextUser;
  if (input) input.value = '';

  [App.weightChartInst, App.caloriesChartInst].forEach(c => { if (c) { c.destroy(); } });
  App.weightChartInst = App.caloriesChartInst = null;
  await refreshProgress();
  showToast(`Peso registrado: ${weight} kg`, 'success');
  return true;
}
export function refreshProfile() {
  const u = App.user;
  if (!u) return;

  const avatar = document.getElementById('profile-avatar');
  if (avatar) {
    avatar.innerHTML = u.gender === 'female'
      ? '<i data-lucide="user-round" role="img" aria-label="Avatar femenino"></i>'
      : '<i data-lucide="user" role="img" aria-label="Avatar masculino"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.textContent = u.name || 'Usuario';
  const badgeEl = document.getElementById('profile-goal-badge');
  if (badgeEl) badgeEl.textContent = Utils.goalLabel(u.goal);

  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setEl('prof-bmr', u.bmr || 0);
  setEl('prof-daily', u.daily_calories || 0);
  setEl('prof-weight', u.weight || 0);
  setEl('prof-height', u.height || 0);

  const fields = { 'edit-name': u.name, 'edit-age': u.age, 'edit-height': u.height, 'edit-weight': u.weight, 'edit-activity': u.activity_level, 'edit-goal': u.goal };
  Object.entries(fields).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
  API.loadAIConfig();
}
export async function saveProfile() {
  const name = document.getElementById('edit-name')?.value.trim();
  const age = parseUserNumber(document.getElementById('edit-age')?.value);
  const height = parseUserNumber(document.getElementById('edit-height')?.value);
  const weight = parseUserNumber(document.getElementById('edit-weight')?.value);
  const activity = document.getElementById('edit-activity')?.value;
  const goal = document.getElementById('edit-goal')?.value;

  if (!name) { showToast('El nombre no puede estar vacío', 'error'); return; }
  try {
    validateProfile({ name, gender: App.user.gender, age, height, weight, activity_level: activity, goal });
  } catch (_) {
    showToast('Revisa edad, altura, peso, actividad y objetivo', 'error');
    return false;
  }

  const bmr = Utils.calculateBMR(App.user.gender, age, weight, height);
  const tdee = Utils.calculateTDEE(bmr, activity);
  const dailyCal = Utils.calculateDailyCalories(tdee, goal);
  const macros = Utils.calculateMacros(dailyCal, goal);

  const nextUser = {
    ...App.user,
    name, age, height, weight, activity_level: activity, goal,
    bmr: Math.round(bmr), daily_calories: dailyCal, protein_goal: macros.protein, carbs_goal: macros.carbs, fat_goal: macros.fat
  };
  try {
    LS.setUser(nextUser);
  } catch (error) {
    showPersistenceFailure(error, 'actualizar el perfil');
    return false;
  }
  App.user = nextUser;

  setGreeting();
  refreshProfile();
  document.getElementById('edit-profile-form')?.classList.remove('open');
  await refreshDashboard();
  showToast('Perfil actualizado ✓', 'success');
  return true;
}
export function clearDataConfirm() {
  if (!confirm('⚠️ Esto eliminará TODOS tus datos y reiniciará la aplicación. ¿Estás seguro?')) return;
  try {
    LS.clearManaged({ includeSensitive: true });
  } catch (error) {
    showPersistenceFailure(error, 'eliminar los datos');
    return false;
  }

  void _stopBarcodeScanner();
  if (App.aiImage?.previewUrl) URL.revokeObjectURL(App.aiImage.previewUrl);
  if (App.recognition) {
    try { App.recognition.stop(); } catch (_) {}
  }
  App.user = null;
  App.todayLogs = [];
  App.diaryLogs = [];
  App.todayWater = 0;
  App.selectedFood = null;
  App.aiImage = null;
  App._pendingAIFoods = null;
  App.aiEditorIndex = 0;
  App.selectedAIMeal = 'breakfast';
  App.currentMealType = 'breakfast';
  App.currentDiaryDate = new Date();
  App.lastAIInputMode = 'text';
  App.lastAISourceMode = null;
  App.allFoods = [];
  App.recognition = null;
  pendingFavToAdd = null;
  _editFoodLogId = null;
  _editFoodBase = null;
  _aiInsightSig = '';
  _aiInsightText = null;
  _renderedDiaryIds = new Set();
  _renderedDiaryDate = '';
  _ringData = null;
  ScannerState.pendingFood = null;
  ScannerState.pendingFoodSource = null;
  ScannerState.processed = false;
  ScannerState.selectedMeal = 'breakfast';
  ScannerState.scanning = false;
  [App.caloriesRingChart, App.weightChartInst, App.caloriesChartInst, App.waterChartInst].forEach(c => { if (c) { c.destroy(); } });
  App.caloriesRingChart = App.weightChartInst = App.caloriesChartInst = App.waterChartInst = null;

  ['food-modal', 'edit-food-modal', 'ai-edit-modal', 'favorites-modal', 'scanner-container']
    .forEach((id) => document.getElementById(id)?.classList.remove('open'));
  ['food-search-input', 'qty-input', 'quick-cal-input', 'ai-food-input', 'scanner-manual-code', 'scanner-conf-grams']
    .forEach((id) => { const input = document.getElementById(id); if (input) input.value = ''; });
  ['food-search-results', 'favorites-list', 'ai-results-list']
    .forEach((id) => { const container = document.getElementById(id); if (container) container.innerHTML = ''; });
  const aiResults = document.getElementById('ai-results');
  if (aiResults) aiResults.style.display = 'none';
  const scannerConfirmation = document.getElementById('scanner-confirmation');
  if (scannerConfirmation) scannerConfirmation.style.display = 'none';

  currentStep = 0;
  Object.keys(ob).forEach(k => ob[k] = '');
  updateStepUI();
  document.querySelectorAll('.gender-btn, .activity-card, .goal-card').forEach(el => el.classList.remove('selected'));
  ['ob-name', 'ob-age', 'ob-height', 'ob-weight'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('results-preview')?.classList.add('hidden');

  document.getElementById('onboarding-screen').classList.remove('hidden');
  document.getElementById('onboarding-screen').style.opacity = '1';
  document.getElementById('app').classList.add('hidden');
  showToast('Datos eliminados', 'info');
  return true;
}
export let currentStep = 0;
export const totalSteps = 4;
export const ob = { name: '', gender: '', age: 0, height: 0, weight: 0, activity: '', goal: '' };

export function nextStep() { if (!validateStep(currentStep)) return; if (currentStep < totalSteps - 1) { currentStep++; updateStepUI(); } }
export function prevStep() { if (currentStep > 0) { currentStep--; updateStepUI(); } }

export function updateStepUI() {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`step-${currentStep}`)?.classList.add('active');
  document.querySelectorAll('.step-dot').forEach((d, i) => d.classList.toggle('active', i === currentStep));
}
export function validateStep(step) {
  switch (step) {
    case 0:
      ob.name = document.getElementById('ob-name').value.trim();
      if (!ob.name) { showToast('Por favor ingresa tu nombre', 'error'); return false; }
      if (!ob.gender) { showToast('Selecciona tu género', 'error'); return false; }
      return true;
    case 1:
      ob.age = parseUserNumber(document.getElementById('ob-age').value);
      ob.height = parseUserNumber(document.getElementById('ob-height').value);
      ob.weight = parseUserNumber(document.getElementById('ob-weight').value);
      if (isNaN(ob.age) || ob.age < 12 || ob.age > 100) { showToast('Ingresa una edad válida (12-100)', 'error'); return false; }
      if (isNaN(ob.height) || ob.height < 100 || ob.height > 250) { showToast('Ingresa una altura válida (100-250 cm)', 'error'); return false; }
      if (isNaN(ob.weight) || ob.weight < 30 || ob.weight > 300) { showToast('Ingresa un peso válido (30-300 kg)', 'error'); return false; }
      return true;
    case 2:
      if (!ob.activity) { showToast('Selecciona tu nivel de actividad', 'error'); return false; }
      return true;
    default: return true;
  }
}
export function selectGender(btn) {
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  ob.gender = btn.dataset.gender;
}
export function selectActivity(card) {
  document.querySelectorAll('.activity-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  ob.activity = card.dataset.activity;
}
export function selectGoal(card) {
  document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  ob.goal = card.dataset.goal;

  if (ob.age && ob.weight && ob.height && ob.gender && ob.activity) {
    const bmr = Utils.calculateBMR(ob.gender, ob.age, ob.weight, ob.height);
    const tdee = Utils.calculateTDEE(bmr, ob.activity);
    const dailyCal = Utils.calculateDailyCalories(tdee, ob.goal);
    const macros = Utils.calculateMacros(dailyCal, ob.goal);

    document.getElementById('res-calories').textContent = dailyCal;
    document.getElementById('res-protein').textContent = macros.protein;
    document.getElementById('res-carbs').textContent = macros.carbs;
    document.getElementById('res-fat').textContent = macros.fat;
    document.getElementById('results-preview')?.classList.remove('hidden');
  }
}
export async function finishOnboarding() {
  if (!ob.goal) { showToast('Selecciona tu objetivo', 'error'); return; }

  ob.age = parseUserNumber(document.getElementById('ob-age').value);
  ob.height = parseUserNumber(document.getElementById('ob-height').value);
  ob.weight = parseUserNumber(document.getElementById('ob-weight').value);

  const bmr = Utils.calculateBMR(ob.gender, ob.age, ob.weight, ob.height);
  const tdee = Utils.calculateTDEE(bmr, ob.activity);
  const dailyCal = Utils.calculateDailyCalories(tdee, ob.goal);
  const macros = Utils.calculateMacros(dailyCal, ob.goal);

  const userData = {
    id: crypto.randomUUID(),
    name: ob.name,
    gender: ob.gender,
    age: ob.age,
    weight: ob.weight,
    initial_weight: ob.weight,
    height: ob.height,
    activity_level: ob.activity,
    goal: ob.goal,
    bmr: Math.round(bmr),
    daily_calories: dailyCal,
    protein_goal: macros.protein,
    carbs_goal: macros.carbs,
    fat_goal: macros.fat,
    water_goal: 8
  };

  const nextWeightLogs = [{ date: Utils.toDateStr(new Date()), weight: ob.weight }];
  try {
    LS.setMany({ user: userData, weight_logs: nextWeightLogs });
  } catch (error) {
    showPersistenceFailure(error, 'completar el onboarding');
    return false;
  }
  App.user = userData;

  const screen = document.getElementById('onboarding-screen');
  screen.style.transition = 'opacity .4s ease';
  screen.style.opacity = '0';
  setTimeout(() => {
    screen.classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    setGreeting();
    refreshDashboard();
    showToast(`¡Bienvenido, ${ob.name.split(' ')[0]}!`, 'success');
  }, 400);
  return true;
}
export const ScannerState = {
  html5Qr: null,
  scanning: false,
  selectedMeal: 'breakfast',
  processed: false,
  pendingFood: null,
  pendingFoodSource: null,
};
export function _scannerSetPhase(active) {
  [1, 2, 3].forEach(n => {
    const el = document.getElementById('phase-' + n);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (n < active) el.classList.add('done');
    if (n === active) el.classList.add('active');
  });
}
export function _scannerSetStatus(text, spinning) {
  spinning = spinning || false;
  const spinner = document.getElementById('scanner-spinner');
  const statusText = document.getElementById('scanner-status-text');
  const subtitle = document.getElementById('scanner-subtitle');
  if (spinner) spinner.style.display = spinning ? 'flex' : 'none';
  if (statusText) statusText.textContent = text;
  if (subtitle) subtitle.textContent = text;
}
export function _scannerShowBarcodeResult(text) {
  const el = document.getElementById('scanner-barcode-result');
  if (!el) return;
  el.textContent = '\uD83D\uDCE6 Codigo detectado: ' + text;
  el.style.display = 'block';
}
export function _scannerHideBarcodeResult() {
  const el = document.getElementById('scanner-barcode-result');
  if (el) el.style.display = 'none';
}
export async function openScannerModal() {
  await loadHtml5Qrcode();
  const modal = document.getElementById('scanner-container');
  if (!modal) return;
  ScannerState.processed = false;
  ScannerState.pendingFood = null;
  _scannerHideBarcodeResult();
  _scannerSetPhase(1);
  _scannerSetStatus('Apunta al código de barras del producto', false);
  const notFound = document.getElementById('scanner-not-found');
  if (notFound) notFound.style.display = 'none';
  const confScreen = document.getElementById('scanner-confirmation');
  if (confScreen) confScreen.style.display = 'none';
  const camWrap = document.getElementById('scanner-camera-wrap');
  if (camWrap) camWrap.style.display = 'block';
  const greeting = Utils.greetingByHour();
  if (greeting.includes('días')) ScannerState.selectedMeal = 'breakfast';
  else if (greeting.includes('tardes')) ScannerState.selectedMeal = 'lunch';
  else ScannerState.selectedMeal = 'dinner';
  document.querySelectorAll('#scanner-container .scanner-meal-pill').forEach(function (btn) {
    const isActive = btn.dataset.meal === ScannerState.selectedMeal;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('open'), 10);
  _startBarcodeScanner();
}
export async function closeScannerModal() {
  await _stopBarcodeScanner();
  const modal = document.getElementById('scanner-container');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
  }
  _scannerHideBarcodeResult();
}
export async function _startBarcodeScanner() {
  _scannerSetStatus('Inicializando cámara...', true);
  const btnRetryCam = document.getElementById('btn-scanner-retry-cam');
  if (btnRetryCam) btnRetryCam.classList.add('hidden');

  if (typeof Html5Qrcode === 'undefined') {
    showToast('Librería de escaneo no disponible. Verifica tu conexión a Internet.', 'error');
    _scannerSetStatus('Librería no disponible', false);
    return;
  }
  try {
    if (!ScannerState.html5Qr) ScannerState.html5Qr = new Html5Qrcode('interactive-scanner');
    ScannerState.scanning = true;
    await ScannerState.html5Qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 160 }, aspectRatio: 1.0, disableFlip: false },
      _onBarcodeDetected,
      function () { }
    );
    _scannerSetStatus('Apunta al código de barras del producto', false);
    
    // Ensure camera is shown
    const camWrap = document.getElementById('scanner-camera-wrap');
    if (camWrap) camWrap.style.display = 'block';
    const statusEl = document.getElementById('scanner-status');
    if (statusEl) statusEl.style.display = 'flex';
  } catch (err) {
    ScannerState.scanning = false;
    console.error('[Scanner] Error cámara:', err);
    const msg = (err.name === 'NotAllowedError' || String(err).includes('Permission'))
      ? 'Permiso de cámara denegado. Actívalo en la configuración.'
      : 'No se pudo acceder a la cámara. ¿Está siendo usada por otra app?';
    showToast(msg, 'error');
    _scannerSetStatus(msg, false);
    if (btnRetryCam) btnRetryCam.classList.remove('hidden');
  }
}
export async function _stopBarcodeScanner() {
  if (ScannerState.html5Qr && ScannerState.scanning) {
    try { await ScannerState.html5Qr.stop(); } catch (_e) { /* silencioso */ }
    ScannerState.scanning = false;
  }
  ScannerState.html5Qr = null;
}
export async function _onBarcodeDetected(decodedText) {
  if (ScannerState.processed) return;
  ScannerState.processed = true;
  if (navigator.vibrate) navigator.vibrate(200); // Vibrate on success
  await _stopBarcodeScanner();
  _scannerShowBarcodeResult(decodedText);
  _scannerSetPhase(2);
  _scannerSetStatus('Buscando en Open Food Facts...', true);
  await API._queryOpenFoodFactsByBarcode(decodedText);
}
export function _triggerLabelPhotoFallback() {
  showToast('Producto no encontrado en base de datos. Analizando etiqueta con IA...', 'warning', '🤖');
  _scannerSetPhase(2);
  _scannerSetStatus('Toma una foto de la Tabla Nutricional del empaque', false);
  var labelInput = document.getElementById('scanner-label-input');
  if (labelInput) { labelInput.value = ''; labelInput.click(); }
}

export function _showLabelPhotoFallbackUI() {
  _stopBarcodeScanner();
  const camWrap = document.getElementById('scanner-camera-wrap');
  if (camWrap) camWrap.style.display = 'none';
  const statusEl = document.getElementById('scanner-status');
  if (statusEl) statusEl.style.display = 'none';
  
  const notFound = document.getElementById('scanner-not-found');
  if (notFound) notFound.style.display = 'block';
  _scannerSetPhase(2);
  
  if (navigator.vibrate) navigator.vibrate([100, 100, 100]); // Error vibration
}

export function _registerScannedProduct(food, qty, sourceOverride) {
  ScannerState.pendingFood = food;
  ScannerState.pendingFoodSource = sourceOverride || 'off';
  
  // Stop camera before showing confirmation
  _stopBarcodeScanner();

  // Hide camera and error screens
  const camWrap = document.getElementById('scanner-camera-wrap');
  if (camWrap) camWrap.style.display = 'none';
  const notFound = document.getElementById('scanner-not-found');
  if (notFound) notFound.style.display = 'none';
  const statusEl = document.getElementById('scanner-status');
  if (statusEl) statusEl.style.display = 'none';

  // Show confirmation screen
  const confScreen = document.getElementById('scanner-confirmation');
  if (confScreen) {
    confScreen.style.display = 'block';
    document.getElementById('scanner-conf-name').textContent = food.name || food.food_name || 'Producto';
    const confGrams = document.getElementById('scanner-conf-grams');
    if (confGrams) {
      confGrams.value = qty || 100;
      // Trigger input event to calculate macros
      confGrams.dispatchEvent(new Event('input'));
      setTimeout(() => confGrams.focus(), 100);
    }
  }
  
  _scannerSetPhase(3);
  _scannerSetStatus('Confirmar registro', false);
}

export async function _executeRegisterScannedProduct(food, qty, sourceOverride) {
  qty = parseUserNumber(qty);
  if (qty === null || qty <= 0) {
    showToast('Confirma una cantidad válida en gramos', 'error');
    return false;
  }
  if (!FOOD_SOURCES.includes(sourceOverride)) {
    showToast('La procedencia del producto no es válida', 'error');
    return false;
  }
  var ratio = qty / 100;
  var dateStr = Utils.toDateStr(new Date());
  var mealType = ScannerState.selectedMeal || 'breakfast';
  var logData = {
    id: crypto.randomUUID(),
    user_id: (App.user && App.user.id) ? App.user.id : 'local',
    date: dateStr,
    meal_type: mealType,
    food_name: food.name || food.food_name,
    quantity: qty,
    calories: scaledCandidateValue(food.calories_per_100g, ratio, 'calories', { integer: true }),
    protein: scaledCandidateValue(food.protein_per_100g, ratio, 'protein'),
    carbs: scaledCandidateValue(food.carbs_per_100g, ratio, 'carbs'),
    fat: scaledCandidateValue(food.fat_per_100g, ratio, 'fat'),
    fiber: scaledCandidateValue(food.fiber_per_100g, ratio, 'fiber'),
    sugar: scaledCandidateValue(food.sugar_per_100g, ratio, 'sugar'),
    source: sourceOverride,
    ...(sourceOverride === 'ai_label' ? { ai_input_mode: 'image' } : {}),
  };
  try {
    saveFoodLogLocal(logData);
  } catch (error) {
    showPersistenceFailure(error, 'guardar el producto escaneado');
    return false;
  }
  var mealNames = { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack' };
  await closeScannerModal();
  if (App.currentPage === 'home') await refreshDashboard();
  if (App.currentPage === 'diary') await refreshDiary();
  showToast('📦 "' + (food.name || food.food_name) + '" añadido a ' + (mealNames[mealType] || 'Comida') + ' ✓', 'success', '📦');
  return true;
}
export async function exportData() {
    try {
        const dataStr = serializeFilteredBackup(localStorage);
        const fileName = 'NutriTrack_Backup.json';

        // Verificar si estamos en la app nativa (Android) o en el navegador web
        const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

        if (isNative) {
            // ✅ SOLUCIÓN: Usar los plugins expuestos globalmente por Capacitor (sin bundler)
            const { Filesystem, Share } = window.Capacitor.Plugins;

            // 1. Guardar el archivo en la carpeta Cache (evita problemas de permisos en Android 10+)
            const result = await Filesystem.writeFile({
                path: fileName,
                data: dataStr,
                directory: 'CACHE',      // Equivalente a Directory.Cache (sin import)
                encoding: 'utf8'         // ✅ CRUCIAL: indica que data es texto plano, no base64
            });

            // 2. Abrir el menú de compartir de Android
            await Share.share({
                title: 'Respaldo NutriTracks',
                text: 'Aquí está tu respaldo de datos.',
                url: result.uri,
                dialogTitle: 'Compartir respaldo'
            });
            
            showToast("Respaldo creado y listo para compartir.", "success");
        } else {
            // FALLBACK PARA NAVEGADOR WEB (Chrome en PC)
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("Respaldo descargado exitosamente.", "success");
        }
    } catch (error) {
        console.error("Error exportando datos:", error);
        showToast("Hubo un error al exportar: " + error.message, "error");
    }
}
export function importData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      // El módulo valida y migra el archivo completo antes de la confirmación
      // y, por tanto, antes de la primera escritura en localStorage.
      const prepared = parseAndPrepareBackup(String(e.target.result || ''));

      if (!confirm('¿Estás seguro de reemplazar todos tus datos actuales con este respaldo?')) {
        event.target.value = '';
        return;
      }

      commitPreparedBackup(localStorage, prepared);

      showToast("Datos importados exitosamente. Recargando...", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error("Error importando datos:", error);
      if (error instanceof BackupError && error.code === 'BACKUP_ROLLBACK_FAILED') {
        showToast("Error crítico: la restauración falló y no se pudo verificar la recuperación de los datos anteriores.", "error");
      } else if (error instanceof BackupError && error.code === 'BACKUP_COMMIT_FAILED') {
        showToast("La restauración falló. Los datos anteriores fueron recuperados y no se recargará la aplicación.", "error");
      } else {
        showToast(error.message || "El archivo no contiene un respaldo válido.", "error");
      }
    }
    event.target.value = '';
  };

  reader.onerror = function () {
    showToast("No se pudo leer el archivo de respaldo.", "error");
    event.target.value = '';
  };

  reader.readAsText(file);
}

export function initScannerEvents() {
  var btnOpen = document.getElementById('btn-scan-product');
  if (btnOpen) btnOpen.addEventListener('click', openScannerModal);

  var btnClose = document.getElementById('scanner-close-btn');
  if (btnClose) btnClose.addEventListener('click', closeScannerModal);

  var overlay = document.getElementById('scanner-container');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeScannerModal();
    });
  }
  
  // ESCAPE KEY TO CLOSE MODAL
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const scanner = document.getElementById('scanner-container');
      const aiEdit = document.getElementById('ai-edit-modal');
      const foodModal = document.getElementById('food-modal');
      const favModal = document.getElementById('favorites-modal');
      
      if (scanner && scanner.classList.contains('open')) closeScannerModal();
      else if (aiEdit && aiEdit.style.display !== 'none' && !aiEdit.classList.contains('hidden')) closeAIFoodEditModal();
      else if (foodModal && foodModal.style.display !== 'none' && !foodModal.classList.contains('hidden')) closeFoodModal();
      else if (favModal && favModal.style.display !== 'none' && !favModal.classList.contains('hidden')) toggleFavoritesModal(false);
    }
  });

  // FOCUS TRAP FOR SCANNER MODAL
  document.addEventListener('keydown', function(e) {
    const scanner = document.getElementById('scanner-container');
    if (!scanner || !scanner.classList.contains('open')) return;
    if (e.key === 'Tab') {
      const focusable = scanner.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
  });

  var btnLabel = document.getElementById('btn-photo-label');
  if (btnLabel) {
    btnLabel.addEventListener('click', function () {
      var inp = document.getElementById('scanner-label-input');
      if (inp) { inp.value = ''; inp.click(); }
    });
  }

  var labelInput = document.getElementById('scanner-label-input');
  if (labelInput) {
    labelInput.addEventListener('change', async function (e) {
      var file = e.target && e.target.files && e.target.files[0];
      if (!file) return;
      ScannerState.processed = true;
      // We assume _analyzeLabelWithGemini exists
      await API._analyzeLabelWithGemini(file);
    });
  }

  document.querySelectorAll('#scanner-container .scanner-meal-pill').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#scanner-container .scanner-meal-pill')
        .forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      ScannerState.selectedMeal = btn.dataset.meal;
    });
  });

  // Torch / Flashlight toggle
  const btnTorch = document.getElementById('btn-scanner-torch');
  if (btnTorch) {
    btnTorch.addEventListener('click', async function() {
      if (ScannerState.html5Qr && ScannerState.scanning) {
        const isTorchOn = btnTorch.classList.contains('active');
        try {
          await ScannerState.html5Qr.applyVideoConstraints({
            advanced: [{ torch: !isTorchOn }]
          });
          btnTorch.classList.toggle('active', !isTorchOn);
          btnTorch.setAttribute('aria-pressed', !isTorchOn ? 'true' : 'false');
        } catch(e) {
          console.warn("Torch not supported", e);
          showToast('Linterna no soportada en este dispositivo', 'warning');
        }
      }
    });
  }

  // Quick Retry Cam
  const btnRetryCam = document.getElementById('btn-scanner-retry-cam');
  if (btnRetryCam) {
    btnRetryCam.addEventListener('click', function() {
      _startBarcodeScanner();
    });
  }

  // Fallback buttons
  const btnFallbackPhoto = document.getElementById('btn-fallback-photo');
  if (btnFallbackPhoto) {
    btnFallbackPhoto.addEventListener('click', function() {
      var inp = document.getElementById('scanner-label-input');
      if (inp) { inp.value = ''; inp.click(); }
    });
  }
  const btnFallbackManual = document.getElementById('btn-fallback-manual');
  if (btnFallbackManual) {
    btnFallbackManual.addEventListener('click', function() {
      closeScannerModal();
      window.openAddFood(null, ScannerState.selectedMeal);
    });
  }
  const btnFallbackRetry = document.getElementById('btn-fallback-retry');
  if (btnFallbackRetry) {
    btnFallbackRetry.addEventListener('click', function() {
      document.getElementById('scanner-not-found').style.display = 'none';
      _scannerSetPhase(1);
      _startBarcodeScanner();
    });
  }
  const btnManualCodeSearch = document.getElementById('btn-manual-code-search');
  if (btnManualCodeSearch) {
    btnManualCodeSearch.addEventListener('click', async function() {
      const code = document.getElementById('scanner-manual-code')?.value.trim();
      if (code) {
        document.getElementById('scanner-not-found').style.display = 'none';
        _scannerSetPhase(2);
        _scannerSetStatus('Buscando código manual...', true);
        await API._queryOpenFoodFactsByBarcode(code);
      }
    });
  }

  // Confirmation screen listeners
  const confGrams = document.getElementById('scanner-conf-grams');
  if (confGrams) {
    confGrams.addEventListener('input', function() {
      if (!ScannerState.pendingFood) return;
      const g = parseUserNumber(this.value);
      const ratio = g !== null && g > 0 ? g / 100 : null;
      const food = ScannerState.pendingFood;
      const preview = (rawValue, field, integer = false) => {
        const parsed = parseExternalNumber(rawValue, field);
        if (ratio === null || parsed.error || parsed.value === null) return '—';
        const scaled = parsed.value * ratio;
        return integer ? String(Math.round(scaled)) : `${Utils.round1(scaled).toFixed(1)}g`;
      };
      document.getElementById('scanner-conf-kcal').textContent = preview(food.calories_per_100g, 'calories', true);
      document.getElementById('scanner-conf-prot').textContent = preview(food.protein_per_100g, 'protein');
      document.getElementById('scanner-conf-carb').textContent = preview(food.carbs_per_100g, 'carbs');
      document.getElementById('scanner-conf-fat').textContent = preview(food.fat_per_100g, 'fat');
    });
  }

  const btnConfirmAdd = document.getElementById('btn-scanner-confirm');
  if (btnConfirmAdd) {
    btnConfirmAdd.addEventListener('click', function() {
      if (!ScannerState.pendingFood) return;
      const g = parseUserNumber(document.getElementById('scanner-conf-grams')?.value);
      _executeRegisterScannedProduct(ScannerState.pendingFood, g, ScannerState.pendingFoodSource);
    });
  }
}
export function getFoodIdentity(food) {
  return Utils.normalizeSearchText(food?.food_name || food?.name || '');
}

export function toggleFavorite(food, updateUI) {
  if (!food) return;
  const nameToMatch = food.food_name || food.name;
  if (!nameToMatch) return;

  let favs;
  try {
    favs = getFavorites({ strict: true });
  } catch (error) {
    showPersistenceFailure(error, 'leer los favoritos');
    return false;
  }
  const normalizedName = getFoodIdentity(food);
  const existingIdx = favs.findIndex(f => getFoodIdentity(f) === normalizedName);
  let nextFavorites;
  let successMessage;
  let successType;

  if (existingIdx !== -1) {
    // Ya existe → eliminar por nombre normalizado (consistente en toda la app)
    nextFavorites = favs.filter((_, index) => index !== existingIdx);
    successMessage = 'Eliminado de favoritos';
    successType = 'info';
  } else {
    let nextFavorite;
    try {
      const isLog = Object.hasOwn(food, 'meal_type') && Object.hasOwn(food, 'date');
      let canonical;
      if (isLog) {
        validateFoodLog(food);
        if (food.quantity === null) throw new ValidationError('Quick Add no admite favoritos.', [{ field: 'quantity', code: 'QUICK_ADD_FAVORITE', message: 'Quick Add no puede ser favorito.' }]);
        canonical = food;
      } else {
        const quantity = parseExternalNumber(food.defaultServingGrams ?? food.quantity, 'quantity');
        if (quantity.error || quantity.value === null || quantity.value <= 0) {
          throw new ValidationError('Cantidad inválida para favorito.', [quantity.error || { field: 'quantity', code: 'REQUIRED', message: 'Falta cantidad.' }]);
        }
        const ratio = quantity.value / 100;
        const source = Object.hasOwn(food, 'source') ? food.source : 'manual';
        canonical = {
          id: 'favorite-candidate', user_id: 'local', date: '2000-01-01', meal_type: 'snack',
          food_name: nameToMatch, quantity: quantity.value,
          calories: food.calories !== undefined ? food.calories : scaledCandidateValue(food.calories_per_100g, ratio, 'calories', { integer: true }),
          protein: food.protein !== undefined ? food.protein : scaledCandidateValue(food.protein_per_100g, ratio, 'protein'),
          carbs: food.carbs !== undefined ? food.carbs : scaledCandidateValue(food.carbs_per_100g, ratio, 'carbs'),
          fat: food.fat !== undefined ? food.fat : scaledCandidateValue(food.fat_per_100g, ratio, 'fat'),
          fiber: food.fiber !== undefined ? food.fiber : scaledCandidateValue(food.fiber_per_100g, ratio, 'fiber'),
          sugar: food.sugar !== undefined ? food.sugar : scaledCandidateValue(food.sugar_per_100g, ratio, 'sugar'),
          source,
          ...((source === 'ai' || source === 'hybrid') ? { ai_input_mode: food.ai_input_mode } : {}),
          ...(source === 'ai_label' ? { ai_input_mode: 'image' } : {}),
        };
        validateFoodLog(canonical);
      }
      nextFavorite = {
        id: crypto.randomUUID(),
        food_name: canonical.food_name,
        quantity: canonical.quantity,
        calories: canonical.calories,
        protein: canonical.protein,
        carbs: canonical.carbs,
        fat: canonical.fat,
        fiber: canonical.fiber,
        sugar: canonical.sugar,
        source: canonical.source,
        ...(Object.hasOwn(canonical, 'ai_input_mode') ? { ai_input_mode: canonical.ai_input_mode } : {}),
        savedAt: Date.now(),
      };
    } catch (error) {
      showToast('Este registro debe corregirse antes de guardarlo como favorito', 'error');
      return false;
    }
    nextFavorites = [...favs, nextFavorite];
    successMessage = '¡Guardado en favoritos!';
    successType = 'success';
  }

  try {
    LS.setMany({ favorites: nextFavorites }, { remove: ['nt_favorites'] });
  } catch (error) {
    showPersistenceFailure(error, existingIdx !== -1 ? 'eliminar el favorito' : 'guardar el favorito');
    return false;
  }

  renderFavorites();
  if (App.diaryLogs?.length) refreshDiary();
  if (typeof updateUI === 'function') updateUI(nextFavorites);
  showToast(successMessage, successType);
  return true;
}

export async function addToMealFromFav(targetMeal) {
  if (!pendingFavToAdd) return;
  const fav = pendingFavToAdd;
  try {
    saveFoodLogLocal({
      id: crypto.randomUUID(),
      user_id: App.user?.id || 'local',
      date: Utils.toDateStr(App.currentDiaryDate),
      meal_type: targetMeal,
      food_name: fav.food_name,
      quantity: fav.quantity,
      calories: fav.calories,
      protein: fav.protein,
      carbs: fav.carbs,
      fat: fav.fat,
      fiber: fav.fiber,
      sugar: fav.sugar,
      source: fav.source,
      ...(Object.hasOwn(fav, 'ai_input_mode') ? { ai_input_mode: fav.ai_input_mode } : {})
    });
  } catch (error) {
    showPersistenceFailure(error, 'añadir el favorito al diario');
    return false;
  }
  document.getElementById('meal-selector-ui')?.classList.add('hidden');
  toggleFavoritesModal(false);
  pendingFavToAdd = null;
  await refreshDiary();
  if (App.currentPage === 'home') await refreshDashboard();
  showToast(`${fav.food_name} añadido ✓`, 'success');
  return true;
}

export function toggleEditProfile() {
  const form = document.getElementById('edit-profile-form');
  if (!form) return;
  form.classList.toggle('open');
  if (form.classList.contains('open')) {
    setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }
}

export function applySavedDarkMode() {
  const isDark = readSecondary('dark_mode', false);
  document.body.classList.toggle('dark-theme', !!isDark);
}

export function toggleDarkMode() {
  const isDark = !document.body.classList.contains('dark-theme');
  try {
    LS.set('dark_mode', isDark);
  } catch (error) {
    showPersistenceFailure(error, 'cambiar el tema');
    return false;
  }
  document.body.classList.toggle('dark-theme', isDark);
  return true;
}

/* ══════════════════════════════════════════════
   GESTOS: deslizar izq/der para cambiar de sección
   ══════════════════════════════════════════════ */
const SWIPE_PAGE_ORDER = ['home', 'diary', 'water', 'progress', 'profile'];

let _swipe = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  dx: 0,
  page: null,
  navLocked: false,
  suppressClickUntil: 0,
};

function swipeBlocked(target) {
  // No interferir con modales, scanner, onboarding ni la barra de navegación
  if (_swipe.navLocked) return true;
  if (document.querySelector('.modal-overlay.open')) return true;
  const scanner = document.getElementById('scanner-container');
  if (scanner && getComputedStyle(scanner).display !== 'none') return true;
  const onboarding = document.getElementById('onboarding-screen');
  if (onboarding && !onboarding.classList.contains('hidden')) return true;
  if (target) {
    const t = target.closest('.bottom-nav, .modal-overlay, .modal-sheet, input, textarea, select, .nav-item');
    if (t) return true;
  }
  return false;
}

export function initSwipeNavigation() {
  const app = document.getElementById('app');
  if (!app || app.dataset.swipeReady) return;
  app.dataset.swipeReady = '1';

  app.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (swipeBlocked(e.target)) return;
    if (_swipe.active) return; /* ignora segundos dedos */
    _swipe.active = true;
    _swipe.pointerId = e.pointerId;
    _swipe.startX = e.clientX;
    _swipe.startY = e.clientY;
    _swipe.dx = 0;
    _swipe.page = document.querySelector('.page.active');
  }, { passive: true });

  app.addEventListener('pointermove', (e) => {
    if (!_swipe.active || !_swipe.page || e.pointerId !== _swipe.pointerId) return;
    const dx = e.clientX - _swipe.startX;
    const dy = e.clientY - _swipe.startY;
    // Solo gesto horizontal claro (no romper el scroll vertical)
    if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) {
      if (Math.abs(dy) > 12) _swipe.active = false; /* scroll vertical: cancela */
      return;
    }
    _swipe.dx = dx;
    _swipe.page.style.transition = 'none';
    _swipe.page.style.transform = `translateX(${dx}px)`;
    _swipe.page.style.opacity = String(Math.max(0.45, 1 - Math.abs(dx) / 600));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  const finish = (e) => {
    if (!_swipe.active || e.pointerId !== _swipe.pointerId) return;
    _swipe.active = false;
    const dx = _swipe.dx;
    const page = _swipe.page;
    if (!page) return;

    const width = window.innerWidth || 400;
    const threshold = Math.max(70, width * 0.18);
    const idx = SWIPE_PAGE_ORDER.indexOf(App.currentPage);
    const navigated = Math.abs(dx) >= threshold && idx !== -1;
    const dir = dx < 0 ? 1 : -1;
    const nextPage = navigated ? SWIPE_PAGE_ORDER[idx + dir] : null;

    if (navigated && nextPage) {
      // La página sale volando en la dirección del gesto, la nueva entra al lado
      page.style.transition = 'transform .28s cubic-bezier(.22, 1, .36, 1), opacity .28s ease';
      page.style.transform = `translateX(${dir * -1 * width * 0.9}px)`;
      page.style.opacity = '0';
      _swipe.suppressClickUntil = Date.now() + 400;
      _swipe.navLocked = true;
      setTimeout(() => { _swipe.navLocked = false; }, 500);
      navigateTo(nextPage, dir);
      // Limpiar estilos inline residuales tras la transición
      setTimeout(() => {
        page.style.transition = '';
        page.style.transform = '';
        page.style.opacity = '';
      }, 450);
    } else {
      // No llegó al umbral: rebote elástico a la posición original
      page.style.transition = 'transform .3s cubic-bezier(.22, 1, .36, 1), opacity .3s ease';
      page.style.transform = '';
      page.style.opacity = '';
      setTimeout(() => {
        page.style.transition = '';
      }, 350);
    }
    _swipe.page = null;
  };

  app.addEventListener('pointerup', finish);
  app.addEventListener('pointercancel', finish);
  app.addEventListener('pointerleave', finish);

  /* Suprime el click fantasma que sigue a un swipe completado (evita expandir un alimento sin querer) */
  app.addEventListener('click', (e) => {
    if (Date.now() < _swipe.suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* Atajos de teclado: flechas izquierda/derecha */
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (swipeBlocked(null)) return;
    const idx = SWIPE_PAGE_ORDER.indexOf(App.currentPage);
    if (idx === -1) return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const nextPage = SWIPE_PAGE_ORDER[idx + dir];
    if (nextPage) navigateTo(nextPage, dir);
  });
}
