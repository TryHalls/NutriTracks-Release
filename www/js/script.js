/* ============================================================
   NutriTrack Pro v3 — script.js  ·  REFACTORIZADO A MÓDULOS ES6
   ============================================================ */

import { App, LS } from './modules/state.js';
import { LOCAL_FOOD_DB, SYNONYMS_MAP } from './modules/db.js';
import * as Utils from './modules/utils.js';
import * as API from './modules/api.js';
import * as UI from './modules/ui.js';

/* ──────────────────────────────────────────────────────────────
   INICIALIZACIÓN
   ────────────────────────────────────────────────────────────── */
async function initApp() {
  UI.injectWaterPage();
  UI.applySavedDarkMode();
  Utils.checkAndResetForNewDay();
  App.user = LS.getUser();

  if (!App.user) {
    document.getElementById('onboarding-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  } else {
    document.getElementById('onboarding-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    UI.setGreeting();
    UI.refreshDashboard();
    API.loadAIConfig();
  }
}

function handleURLParams() {
  const p = new URLSearchParams(window.location.search).get('page');
  if (p && ['diary', 'water', 'progress', 'profile'].includes(p)) {
    setTimeout(() => UI.navigateTo(p), 100);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
  handleURLParams();

  /* ── Renderizar iconos Lucide ── */
  if (typeof lucide !== 'undefined') lucide.createIcons();

  /* ── Contador de caracteres del textarea ── */
  const ta = document.getElementById('ai-food-input');
  if (ta) {
    ta.addEventListener('input', () => {
      const count = document.getElementById('ai-char-count');
      if (count) count.textContent = `${ta.value.length}/500`;
    });
  }

  /* ── P2/P9: Migración de onclick inline → addEventListener ── */

  /* Bottom navigation */
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => UI.navigateTo(btn.dataset.page));
  });

  /* Botón de refresh del AI Coach Insight */
  const aiRefreshBtn = document.querySelector('.ai-insight-refresh');
  /* force=true: el botón manual siempre reconsulta (el insight automático se cachea por día+totales) */
  if (aiRefreshBtn) aiRefreshBtn.addEventListener('click', () => UI.refreshAIInsight(true));

  /* Botón principal "Analizar con IA" */
  const analyzeBtn = document.getElementById('btn-ai-analyze');
  if (analyzeBtn) analyzeBtn.addEventListener('click', () => API.analyzeWithAI());

  /* Botón guardar configuración de IA */
  const saveAIBtn = document.querySelector('.ai-config-card .btn-primary');
  if (saveAIBtn) saveAIBtn.addEventListener('click', () => API.saveAIConfig());

  UI.setupAIEditorListeners();
  UI.setupEditFoodListeners();
  UI.renderAIImagePreview();
  UI.initScannerEvents();
  UI.initSwipeNavigation();

  /* ── Resize event listener for charts ── */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (App.waterChartInst) App.waterChartInst.resize();
      if (App.weightChartInst) App.weightChartInst.resize();
      if (App.caloriesChartInst) App.caloriesChartInst.resize();
      if (App.caloriesRingChart) App.caloriesRingChart.resize();
    }, 250);
  });
});

/* ── Registro del SW ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { });
  });
}

/* ──────────────────────────────────────────────────────────────
   EXPOSICIÓN AL SCOPE GLOBAL (WINDOW)
   Mapea los eventos inline del HTML a sus respectivos módulos
   NOTA DE ARQUITECTURA: Se mantiene un enfoque mixto (onclick inline en HTML
   vs addEventListener) debido a la transición gradual del refactor original.
   Exponer estas funciones en 'window' permite que los onclick sigan funcionando
   sin tener que añadir IDs y listeners a los 64+ elementos interactivos de la UI.
   ────────────────────────────────────────────────────────────── */

// State
window.App = App;
window.LS = LS;

// Database
window.LOCAL_FOOD_DB = LOCAL_FOOD_DB;
window.SYNONYMS_MAP = SYNONYMS_MAP;

// Funciones mapeadas desde UI, API, y Utils
const exposedFunctions = [
  'addToMealFromFav', 'changeDate', 'clearAIImageSelection', 
  'clearAIResults', 'clearDataConfirm', 'closeAIFoodEditModal', 
  'closeFoodModal', 'closeModal', 'confirmAIFoods', 'confirmAddFood', 'exportData', 'finishOnboarding', 
  'handleAIImageSelection', 'importData', 'logWeight', 'navigateTo', 'nextStep', 
  'openAddFood', 'prevStep', 'quickAddCalories', 'saveEditedAIFoods', 
  'saveProfile', 'searchFood', 'selectAIMeal', 'selectActivity', 'selectGender', 
  'selectGoal', 'toggleDarkMode', 'toggleEditProfile', 'toggleFavoritesModal', 
  'toggleMealSection', 'toggleVoiceInput', 'triggerAIImagePicker', 'addWater', 'removeWater',
  'setWaterTo', 'updateStepUI', 'renderFavorites', 'removeFavorite', 'quickSetWater', 'deleteFoodLog',
  'addLogToFavorites'
];

const moduleChain = [UI, API, Utils];
exposedFunctions.forEach((func) => {
  try {
    let resolved = null;
    for (const mod of moduleChain) {
      if (typeof mod?.[func] === 'function') {
        resolved = mod[func];
        break;
      }
    }

    if (resolved) {
      window[func] = resolved;
    } else {
      console.warn(`[Modules] No se pudo exponer "${func}" en window (función no encontrada).`);
    }
  } catch (err) {
    console.error(`[Modules] Error exponiendo "${func}" en window:`, err);
  }
});

// Algunas funciones adicionales utilizadas en HTML inline u otras partes
window.closeScannerModal = UI.closeScannerModal;
window.openScannerModal = UI.openScannerModal;
window.saveAIConfig = API.saveAIConfig;
window.analyzeWithAI = API.analyzeWithAI;

// --- Event Listeners Migrated from Inline Onclick ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("evt_850a26").addEventListener("click", function() { selectGender(document.getElementById("evt_850a26")); });
  document.getElementById("evt_9e4ad4").addEventListener("click", function() { selectGender(document.getElementById("evt_9e4ad4")); });
  document.getElementById("evt_54d4f3").addEventListener("click", function() { nextStep(); });
  document.getElementById("evt_899b05").addEventListener("click", function() { prevStep(); });
  document.getElementById("evt_a012d2").addEventListener("click", function() { nextStep(); });
  document.getElementById("evt_bc3d1e").addEventListener("click", function() { selectActivity(document.getElementById("evt_bc3d1e")); });
  document.getElementById("evt_347f39").addEventListener("click", function() { selectActivity(document.getElementById("evt_347f39")); });
  document.getElementById("evt_f21990").addEventListener("click", function() { selectActivity(document.getElementById("evt_f21990")); });
  document.getElementById("evt_da5e54").addEventListener("click", function() { selectActivity(document.getElementById("evt_da5e54")); });
  document.getElementById("evt_7018d3").addEventListener("click", function() { selectActivity(document.getElementById("evt_7018d3")); });
  document.getElementById("evt_b37c36").addEventListener("click", function() { prevStep(); });
  document.getElementById("evt_5c72ff").addEventListener("click", function() { nextStep(); });
  document.getElementById("evt_9c2166").addEventListener("click", function() { selectGoal(document.getElementById("evt_9c2166")); });
  document.getElementById("evt_3e9734").addEventListener("click", function() { selectGoal(document.getElementById("evt_3e9734")); });
  document.getElementById("evt_ecc55b").addEventListener("click", function() { selectGoal(document.getElementById("evt_ecc55b")); });
  document.getElementById("evt_cd1505").addEventListener("click", function() { prevStep(); });
  document.getElementById("btn-finish").addEventListener("click", function() { finishOnboarding(); });
  document.getElementById("evt_f500fb").addEventListener("click", function() { navigateTo('diary'); });
  document.getElementById("evt_ee630b").addEventListener("click", function() { navigateTo('diary'); });
  document.getElementById("evt_331cf3").addEventListener("click", function() { navigateTo('diary'); });
  document.getElementById("evt_de4bfe").addEventListener("click", function() { navigateTo('diary'); });
  document.getElementById("evt_6ed5a5").addEventListener("click", function() { navigateTo('diary'); });
  document.getElementById("evt_4c9905").addEventListener("click", function() { changeDate(-1); });
  document.getElementById("evt_90f31c").addEventListener("click", function() { changeDate(1); });
  document.getElementById("ai-mic-btn").addEventListener("click", function() { toggleVoiceInput(); });
  document.getElementById("ai-camera-btn").addEventListener("click", function() { triggerAIImagePicker(); });
  document.getElementById("evt_8e8dae").addEventListener("click", function() { clearAIImageSelection(); });
  document.getElementById("evt_8e578c").addEventListener("click", function() { selectAIMeal(document.getElementById("evt_8e578c")); });
  document.getElementById("evt_e6ee6f").addEventListener("click", function() { selectAIMeal(document.getElementById("evt_e6ee6f")); });
  document.getElementById("evt_bdd236").addEventListener("click", function() { selectAIMeal(document.getElementById("evt_bdd236")); });
  document.getElementById("evt_972e0e").addEventListener("click", function() { selectAIMeal(document.getElementById("evt_972e0e")); });
  document.getElementById("evt_2baaac").addEventListener("click", function() { clearAIResults(); });
  document.getElementById("evt_053219").addEventListener("click", function() { confirmAIFoods(); });
  document.getElementById("evt_6e9839").addEventListener("click", function() { openAddFood(null, getSelectedAIMeal()); });
  document.getElementById("evt_26d38b").addEventListener("click", function() { toggleMealSection(document.getElementById("evt_26d38b")); });
  document.getElementById("evt_4bb3a8").addEventListener("click", function(event) { openAddFood(event,'breakfast'); });
  document.getElementById("evt_72552e").addEventListener("click", function() { toggleMealSection(document.getElementById("evt_72552e")); });
  document.getElementById("evt_825850").addEventListener("click", function(event) { openAddFood(event,'lunch'); });
  document.getElementById("evt_97aa30").addEventListener("click", function() { toggleMealSection(document.getElementById("evt_97aa30")); });
  document.getElementById("evt_90d401").addEventListener("click", function(event) { openAddFood(event,'dinner'); });
  document.getElementById("evt_c0627f").addEventListener("click", function() { toggleMealSection(document.getElementById("evt_c0627f")); });
  document.getElementById("evt_ae588d").addEventListener("click", function(event) { openAddFood(event,'snack'); });
  document.getElementById("evt_e0277e").addEventListener("click", function() { logWeight(); });
  document.getElementById("btn-edit-profile").addEventListener("click", function() { toggleEditProfile(); });
  document.getElementById("evt_ae0ff8").addEventListener("click", function() { navigateTo('progress'); });
  document.getElementById("evt_e606f7").addEventListener("click", function() { toggleFavoritesModal(true); });
  document.getElementById("evt_0df47e").addEventListener("click", function() { toggleDarkMode(); });
  document.getElementById("evt_f4dce9").addEventListener("click", function() { exportData(); });
  document.getElementById("evt_02fad9").addEventListener("click", function() { document.getElementById('import-input').click(); });
  document.getElementById("evt_a089ba").addEventListener("click", function() { clearDataConfirm(); });
  document.getElementById("evt_a6c01b").addEventListener("click", function() { saveProfile(); });
  document.getElementById("food-modal").addEventListener("click", function(event) { closeFoodModal(event); });
  document.getElementById("evt_8a2f8d").addEventListener("click", function() { confirmAddFood(); });
  document.getElementById("evt_38b83e").addEventListener("click", function() { quickAddCalories(); });
  document.getElementById("ai-edit-modal").addEventListener("click", function(event) { closeAIFoodEditModal(event); });
  document.getElementById("evt_6c04ab").addEventListener("click", function(event) { event.stopPropagation(); });
  document.getElementById("evt_2d34ac").addEventListener("click", function() { closeAIFoodEditModal(); });
  document.getElementById("evt_a50096").addEventListener("click", function() { saveEditedAIFoods(); });
  document.getElementById("favorites-modal").addEventListener("click", function(event) { toggleFavoritesModal(false, event); });
  document.getElementById("evt_60b304").addEventListener("click", function(event) { event.stopPropagation(); });
  document.getElementById("evt_e054d2").addEventListener("click", function() { addToMealFromFav('breakfast'); });
  document.getElementById("evt_a9c306").addEventListener("click", function() { addToMealFromFav('lunch'); });
  document.getElementById("evt_13519b").addEventListener("click", function() { addToMealFromFav('dinner'); });
  document.getElementById("evt_767b57").addEventListener("click", function() { addToMealFromFav('snack'); });
});
