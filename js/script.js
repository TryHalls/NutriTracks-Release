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
  if (aiRefreshBtn) aiRefreshBtn.addEventListener('click', () => UI.refreshAIInsight());

  /* Botón principal "Analizar con IA" */
  const analyzeBtn = document.getElementById('btn-ai-analyze');
  if (analyzeBtn) analyzeBtn.addEventListener('click', () => API.analyzeWithAI());

  /* Botón guardar configuración de IA */
  const saveAIBtn = document.querySelector('.ai-config-card .btn-primary');
  if (saveAIBtn) saveAIBtn.addEventListener('click', () => API.saveAIConfig());

  UI.setupAIEditorListeners();
  UI.renderAIImagePreview();
  UI.initScannerEvents();
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
