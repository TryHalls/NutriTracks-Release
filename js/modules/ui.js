import { App, LS } from './state.js';
import * as Utils from './utils.js';
import * as API from './api.js';
import { LOCAL_FOOD_DB } from './db.js';

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
export function setGreeting() {
  if (!App.user) return;
  const firstName = (App.user.name || 'Usuario').split(' ')[0];
  const el = document.getElementById('greeting-text');
  const elDate = document.getElementById('greeting-date');
  if (el) el.textContent = `${Utils.greetingByHour()}, ${firstName}`;
  if (elDate) elDate.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
export function navigateTo(page) {
  if (typeof closeScannerModal === 'function') closeScannerModal();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  App.currentPage = page;

  const actionBtn = document.getElementById('topbar-action-btn');
  const iconPlus = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  if (page === 'diary') {
    actionBtn.innerHTML = iconPlus;
    actionBtn.onclick = () => openAddFood(null, App.selectedAIMeal || 'breakfast');
  } else if (page === 'progress') {
    actionBtn.innerHTML = '<i data-lucide="clipboard-pen"></i>';
    actionBtn.onclick = () => document.getElementById('log-weight-input')?.focus();
  } else {
    actionBtn.innerHTML = iconPlus;
    actionBtn.onclick = () => navigateTo('diary');
  }

  if (page === 'home') refreshDashboard();
  if (page === 'diary') refreshDiary();
  if (page === 'progress') refreshProgress();
  if (page === 'water') refreshWaterPage();
  if (page === 'profile') refreshProfile();

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

  const totals = alimentos.reduce(
    (acc, a) => ({ kcal: acc.kcal + (Number(a.kcal) || 0), prot: acc.prot + (Number(a.proteinas) || 0), carbs: acc.carbs + (Number(a.carbohidratos) || 0), fat: acc.fat + (Number(a.grasas) || 0) }),
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
      kcal: acc.kcal + (Number(food.kcal) || 0),
      prot: acc.prot + (Number(food.proteinas) || 0),
      carbs: acc.carbs + (Number(food.carbohidratos) || 0),
      fat: acc.fat + (Number(food.grasas) || 0),
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
  const grams = Math.max(0, Math.round(Number(document.getElementById('ai-edit-grams')?.value) || 0));
  const kcal = Math.max(0, Math.round(Number(document.getElementById('ai-edit-kcal')?.value) || 0));
  const prot = Utils.round1(document.getElementById('ai-edit-protein')?.value);
  const carbs = Utils.round1(document.getElementById('ai-edit-carbs')?.value);
  const fat = Utils.round1(document.getElementById('ai-edit-fat')?.value);

  const updated = {
    ...current,
    alimento: name || current.alimento,
    gramos_estimados: grams,
    cantidad_estimada: grams > 0 ? `${grams}g` : 'Cantidad por confirmar',
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

  for (const a of foods) {
    saveFoodLogLocal({
      id: 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      user_id: App.user?.id || 'local',
      date: dateStr,
      meal_type: mealType,
      food_name: a.alimento,
      quantity: a.gramos_estimados,
      calories: a.kcal,
      protein: a.proteinas,
      carbs: a.carbohidratos,
      fat: a.grasas,
      fiber: 0,
      sugar: 0,
      source: 'ai',
      ai_input_mode: App.lastAIInputMode,
    });
  }

  closeAIFoodEditModal();
  clearAIResults();
  clearAIImageSelection(true);

  const ta = document.getElementById('ai-food-input');
  if (ta) ta.value = '';
  const count = document.getElementById('ai-char-count');
  if (count) count.textContent = '0/500';

  showToast(`✦ ${foods.length} alimento(s) guardado(s) en ${API.getSelectedAIMealLabel()}`, 'ai', '✦');

  await refreshDiary();
  if (App.currentPage === 'home') refreshDashboard();
}
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
      current._base_kcal = current.kcal || 0;
      current._base_prot = current.proteinas || 0;
      current._base_carbs = current.carbohidratos || 0;
      current._base_fat = current.grasas || 0;
    }

    const newGrams = Math.max(0, Math.round(Number(e.target.value) || 0));
    
    // 2. Recalcular proporciones si la base es mayor a 0
    if (current._base_grams > 0) {
      const ratio = newGrams / current._base_grams;
      const kcalEl = document.getElementById('ai-edit-kcal');
      const protEl = document.getElementById('ai-edit-protein');
      const carbsEl = document.getElementById('ai-edit-carbs');
      const fatEl = document.getElementById('ai-edit-fat');

      if (kcalEl) kcalEl.value = Math.max(0, Math.round(current._base_kcal * ratio));
      if (protEl) protEl.value = Utils.round1(current._base_prot * ratio);
      if (carbsEl) carbsEl.value = Utils.round1(current._base_carbs * ratio);
      if (fatEl) fatEl.value = Utils.round1(current._base_fat * ratio);
    }

    // 3. Persistir en el estado global
    persistCurrentAIFoodFromForm();
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
        current._base_kcal = current.kcal || 0;
        current._base_prot = current.proteinas || 0;
        current._base_carbs = current.carbohidratos || 0;
        current._base_fat = current.grasas || 0;
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
export async function refreshAIInsight() {
  if (!App.user) return;
  const bodyEl = document.getElementById('ai-insight-body');
  const textEl = document.getElementById('ai-insight-text');
  const thinkEl = document.getElementById('ai-thinking');
  if (!bodyEl || !textEl) return;

  const todayStr = Utils.toDateStr(new Date());
  const logs = LS.get('food_logs_' + todayStr, []);
  const totals = logs.reduce(
    (acc, l) => ({ cal: acc.cal + (l.calories || 0), prot: acc.prot + (l.protein || 0), carbs: acc.carbs + (l.carbs || 0), fat: acc.fat + (l.fat || 0) }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 }
  );

  const { daily_calories: goal, protein_goal: pGoal, carbs_goal: cGoal, fat_goal: fGoal } = App.user;
  const cfg = API.getAIConfig();

  if (!cfg) {
    textEl.textContent = generateLocalInsight(totals, { cal: goal, prot: pGoal, carbs: cGoal, fat: fGoal });
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
    if (textEl) { textEl.textContent = result; textEl.style.display = 'block'; }
  } catch (e) {
    if (textEl) {
      textEl.textContent = generateLocalInsight(totals, { cal: goal, prot: pGoal, carbs: cGoal, fat: fGoal });
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
export function getFavorites() {
  // LS ya agrega 'nt_' automáticamente → clave real = 'nt_favorites'
  const current = LS.get('favorites', null);
  if (current !== null) return current;

  // Migración única: 'nt_favorites' en rawLS era la clave antigua del script monolítico.
  // LS.get('nt_favorites') leería 'nt_nt_favorites' (doble prefijo → siempre vacío).
  // Por eso lo leemos directamente desde localStorage para migrar correctamente.
  try {
    const raw = localStorage.getItem('nt_favorites');
    if (raw) {
      const migrated = JSON.parse(raw);
      if (Array.isArray(migrated) && migrated.length > 0) {
        LS.set('favorites', migrated);           // guardar en clave correcta (nt_favorites)
        localStorage.removeItem('nt_favorites'); // limpiar copia legacy
        return migrated;
      }
    }
  } catch (_) {}
  return [];
}
// Recibe el id del log Y la referencia al botón para actualizar su texto en tiempo real
export function addLogToFavorites(logId, btnEl) {
  const log = App.diaryLogs.find(l => l.id === logId);
  if (!log) return;
  toggleFavorite(log);
  // Actualizar el botón inmediatamente sin re-renderizar todo el diario
  if (btnEl) {
    const isNowFav = getFavorites().some(f => getFoodIdentity(f) === getFoodIdentity(log));
    btnEl.textContent = isNowFav ? '★ En favoritos' : '☆ Favorito';
  }
}
export function removeFavorite(favId) {
  let favs = getFavorites();
  // Eliminar por nombre normalizado (consistente con la lógica de toggleFavorite)
  // con fallback a id para compatibilidad con datos anteriores
  const target = favs.find(f => f.id === favId);
  if (target) {
    const targetName = getFoodIdentity(target);
    favs = favs.filter(f => getFoodIdentity(f) !== targetName);
  } else {
    favs = favs.filter(f => f.id !== favId);
  }
  LS.set('favorites', favs);
  renderFavorites();
  showToast('Eliminado de favoritos', 'info');
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
    if (typeof lucide !== 'undefined') lucide.createIcons();
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
        <button class="btn-quick-add" title="Añadir al diario">+ Añadir</button>
        <button class="btn-quick-rem" title="Quitar de favoritos"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
      </div>`;

    item.querySelector('.btn-quick-add').addEventListener('click', (e) => {
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
  searchDebounceTimer = setTimeout(async () => {
    const results = await API.searchOpenFoodFacts(q);
    renderFoodSearchResults(results);
    API.updateSearchSourceBadge(results);
    document.getElementById('qty-picker-section')?.classList.add('hidden');
    App.selectedFood = null;
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

    item.className = 'search-result-item';
    item.innerHTML = `
      <div>
        <div class="sri-name">${escapeHtml(food.name)}</div>
        <div class="sri-cal">${food.calories_per_100g} kcal/100g · ${food.protein_per_100g}g prot · <span style="font-size:.7rem;color:var(--emerald-600)">${escapeHtml(sourceLabel)}</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${sourceBadge}
        <button class="sri-fav-btn" title="Favorito">${isFav ? '★' : '☆'}</button>
      </div>`;

    const favBtn = item.querySelector('.sri-fav-btn');
    favBtn.onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(food);
      const isNowFav = getFavorites().some(f => getFoodIdentity(f) === getFoodIdentity(food));
      favBtn.textContent = isNowFav ? '★' : '☆';
      // Micro-animación de pop al tocar la estrella
      favBtn.classList.remove('just-toggled');
      void favBtn.offsetWidth; // fuerza reflow para reiniciar la animación
      favBtn.classList.add('just-toggled');
      renderFavorites();
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
export async function confirmAddFood() {
  const food = App.selectedFood;
  if (!food) return;

  const qty = parseFloat(document.getElementById('qty-input')?.value) || 100;
  const ratio = qty / 100;
  const source = food.source || 'local';

  const logData = {
    id: `${source}_${Date.now()}`,
    user_id: App.user?.id || 'local',
    date: Utils.toDateStr(App.currentDiaryDate),
    meal_type: App.currentMealType,
    food_name: food.name,
    quantity: qty,
    calories: Math.round(food.calories_per_100g * ratio),
    protein: parseFloat((food.protein_per_100g * ratio).toFixed(1)),
    carbs: parseFloat((food.carbs_per_100g * ratio).toFixed(1)),
    fat: parseFloat((food.fat_per_100g * ratio).toFixed(1)),
    fiber: parseFloat(((food.fiber_per_100g || 0) * ratio).toFixed(1)),
    sugar: parseFloat(((food.sugar_per_100g || 0) * ratio).toFixed(1)),
    source,
  };

  saveFoodLogLocal(logData);
  closeModal();
  showToast(`${food.name} añadido ✓`, 'success');
  await refreshDiary();
  if (App.currentPage === 'home') refreshDashboard();
}
export async function quickAddCalories() {
  const input = document.getElementById('quick-cal-input');
  const cal = parseFloat(input?.value);
  if (!cal || cal <= 0 || cal > 9999) { showToast('Ingresa una cantidad válida', 'error'); return; }

  saveFoodLogLocal({
    id: 'quick_' + Date.now(),
    user_id: App.user?.id || 'local',
    date: Utils.toDateStr(App.currentDiaryDate),
    meal_type: App.currentMealType,
    food_name: 'Entrada rápida',
    quantity: 0,
    calories: cal,
    protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0,
    source: 'manual',
  });

  closeModal();
  showToast(`${cal} kcal añadidas`, 'success');
  await refreshDiary();
  if (App.currentPage === 'home') refreshDashboard();
}
export function saveFoodLogLocal(logData) {
  const key = 'food_logs_' + logData.date;
  const existing = LS.get(key, []);
  LS.set(key, [...existing.filter(l => l.id !== logData.id), logData]);
}
export function deleteFoodLogLocal(logId, dateStr) {
  const key = 'food_logs_' + dateStr;
  LS.set(key, LS.get(key, []).filter(l => l.id !== logId));
}
export async function deleteFoodLog(logId) {
  if (!confirm('¿Eliminar este alimento?')) return;
  const dateStr = Utils.toDateStr(App.currentDiaryDate);
  deleteFoodLogLocal(logId, dateStr);
  showToast('Alimento eliminado', 'info');
  await refreshDiary();
  if (App.currentPage === 'home') refreshDashboard();
}
export async function refreshDashboard() {
  if (!App.user) return;
  const todayStr = Utils.toDateStr(new Date());
  App.todayLogs = LS.get('food_logs_' + todayStr, []);
  const totals = computeTotals(App.todayLogs);

  updateCaloriesRing(totals.calories, App.user.daily_calories);
  updateMacroBars(totals);

  ['breakfast', 'lunch', 'dinner', 'snack'].forEach(m => {
    const mCal = App.todayLogs.filter(l => l.meal_type === m).reduce((s, l) => s + (l.calories || 0), 0);
    const el = document.getElementById(`mini-${m}`);
    if (el) el.textContent = Math.round(mCal) + ' kcal';
  });

  loadTodayWater();
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
}
export function computeTotals(logs) {
  /* P0: Corrección de typo — acc.prot → acc.protein (evita NaN en dashboard) */
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein: acc.protein + (l.protein || 0),
      carbs: acc.carbs + (l.carbs || 0),
      fat: acc.fat + (l.fat || 0),
      fiber: acc.fiber + (l.fiber || 0),
      sugar: acc.sugar + (l.sugar || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
  );
}
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

  App.caloriesRingChart = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: { datasets: [{ data: [displayConsumed, displayRemain], backgroundColor: [color, 'rgba(255,255,255,.2)'], borderWidth: 0, hoverOffset: 0 }] },
    options: { cutout: '72%', responsive: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 700, easing: 'easeInOutQuart' } }
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
export function renderDashboardWater() {
  const goal = App.user?.water_goal || 8;
  const current = App.todayWater || 0;
  const countEl = document.getElementById('dash-water');
  const goalEl = document.getElementById('dash-water-goal');
  if (countEl) countEl.textContent = current;
  if (goalEl) goalEl.textContent = goal;

  const container = document.getElementById('dash-water-glasses');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < goal; i++) {
    const btn = document.createElement('button');
    btn.className = 'glass-btn' + (i < current ? ' filled' : '');
    btn.textContent = '';  // Will be replaced by Lucide icon
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'droplets');
    btn.appendChild(icon);
    btn.title = `Vaso ${i + 1}`;
    btn.onclick = () => quickSetWater(i + 1);
    container.appendChild(btn);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
export async function quickSetWater(glasses) {
  App.todayWater = glasses;
  LS.set('water_' + Utils.toDateStr(new Date()), glasses);
  renderDashboardWater();
  showToast(`${glasses} vasos registrados`, 'info');
}
export async function refreshDiary() {
  const dateStr = Utils.toDateStr(App.currentDiaryDate);
  const label = document.getElementById('diary-date-label');
  if (label) label.textContent = Utils.formatDateLabel(App.currentDiaryDate);
  App.diaryLogs = LS.get('food_logs_' + dateStr, []);
  renderDiaryMeals(App.diaryLogs);
}
export function changeDate(delta) {
  const d = new Date(App.currentDiaryDate);
  d.setDate(d.getDate() + delta);
  App.currentDiaryDate = d;
  refreshDiary();
}
export function renderDiaryMeals(logs) {
  ['breakfast', 'lunch', 'dinner', 'snack'].forEach(meal => {
    const mealLogs = logs.filter(l => l.meal_type === meal);
    const list = document.getElementById(`food-list-${meal}`);
    if (!list) return;

    const calEl = list.parentElement?.querySelector('.meal-cal-display');
    if (calEl) calEl.textContent = Math.round(mealLogs.reduce((s, l) => s + (l.calories || 0), 0));

    if (!mealLogs.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="utensils"></i></div><p>Sin alimentos registrados<br><small>Usa IA o búsqueda manual ↑</small></p></div>`;
      return;
    }
    list.innerHTML = '';
    mealLogs.forEach(log => list.appendChild(createFoodItem(log)));
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
export function createFoodItem(log) {
  const isFav = getFavorites().some(f => getFoodIdentity(f) === getFoodIdentity(log));
  const source = log.source || 'manual';
  const wrapper = document.createElement('div');
  wrapper.dataset.logId = log.id;

  const item = document.createElement('div');
  item.className = 'food-item';

  const badgeHtml = source === 'ai'
    ? `<span class="food-source-badge ai">IA</span>`
    : source === 'local'
      ? `<span class="food-source-badge off" style="background:#fef3c7;color:#92400e;border-color:#fcd34d">LOCAL</span>`
      : source === 'off'
        ? `<span class="food-source-badge off">OFF</span>`
        : `<span class="food-source-badge manual">Manual</span>`;

  const dotClass = source === 'ai' ? 'food-item-dot ai-source' : 'food-item-dot';

  item.innerHTML = `
    <div class="food-item-left">
      <div class="${dotClass}"></div>
      <div class="food-item-info">
        <div class="food-item-name">${escapeHtml(log.food_name)}</div>
        <div class="food-item-qty">${log.quantity ? log.quantity + 'g' : '—'}</div>
      </div>
      ${badgeHtml}
    </div>
    <div class="food-item-cal">${Math.round(log.calories)} kcal</div>`;

  const expanded = document.createElement('div');
  expanded.className = 'food-item-expanded';
  expanded.innerHTML = `
    <div class="food-micro-grid">
      <div class="micro-item"><div class="micro-val" style="color:var(--protein-color)">${Math.round(log.protein || 0)}g</div><div class="micro-lbl">Prot</div></div>
      <div class="micro-item"><div class="micro-val" style="color:var(--carbs-color)">${Math.round(log.carbs || 0)}g</div><div class="micro-lbl">Carbs</div></div>
      <div class="micro-item"><div class="micro-val" style="color:var(--fat-color)">${Math.round(log.fat || 0)}g</div><div class="micro-lbl">Grasas</div></div>
      <div class="micro-item"><div class="micro-val">${Math.round(log.fiber || 0)}g</div><div class="micro-lbl">Fibra</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="btn-fav-food" onclick="addLogToFavorites('${log.id}', this)">${isFav ? '★ En favoritos' : '☆ Favorito'}</button>
      <button class="btn-delete-food" style="margin-top:0;" onclick="deleteFoodLog('${log.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;vertical-align:-2px"></i> Eliminar</button>
    </div>`;

  item.onclick = () => expanded.classList.toggle('open');
  wrapper.appendChild(item);
  wrapper.appendChild(expanded);
  return wrapper;
}
export function toggleMealSection() { /* secciones siempre expandidas */ }

export function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
export async function refreshWaterPage() {
  loadTodayWater();
  const goal = App.user?.water_goal || 8;
  const current = App.todayWater || 0;

  updateWaterProgressArc(current, goal);
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
  grid.innerHTML = '';
  for (let i = 0; i < goal; i++) {
    const btn = document.createElement('button');
    btn.className = 'big-glass-btn' + (i < current ? ' filled' : '');
    btn.textContent = '';  // Will be replaced by Lucide icon
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'droplets');
    btn.appendChild(icon);
    btn.title = `Vaso ${i + 1}`;
    btn.onclick = () => setWaterTo(i + 1);
    grid.appendChild(btn);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
export async function addWater() {
  const goal = App.user?.water_goal || 8;
  if (App.todayWater >= goal) { showToast('¡Meta de hidratación alcanzada!', 'info'); return; }
  App.todayWater++;
  LS.set('water_' + Utils.toDateStr(new Date()), App.todayWater);
  refreshWaterPage();
  renderDashboardWater();
  if (App.todayWater === goal) showToast('¡Meta de hidratación alcanzada!', 'success');
  else showToast(`+1 vaso → ${App.todayWater}/${goal}`, 'info');
}
export async function removeWater() {
  if (App.todayWater <= 0) return;
  App.todayWater--;
  LS.set('water_' + Utils.toDateStr(new Date()), App.todayWater);
  refreshWaterPage();
  renderDashboardWater();
  showToast(`Vaso removido → ${App.todayWater}`, 'info');
}
export async function setWaterTo(count) {
  App.todayWater = count;
  LS.set('water_' + Utils.toDateStr(new Date()), count);
  refreshWaterPage();
  renderDashboardWater();
  showToast(`${count} vasos registrados`, 'info');
}
export function renderWaterChart() {
  const canvas = document.getElementById('water-chart');
  if (!canvas) return;
  const goal = App.user?.water_goal || 8;
  const labels = [], values = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('es-ES', { weekday: 'short' }));
    values.push(LS.get('water_' + Utils.toDateStr(d), 0));
  }
  if (App.waterChartInst) {
    App.waterChartInst.data.labels = labels;
    App.waterChartInst.data.datasets[0].data = values;
    App.waterChartInst.data.datasets[0].backgroundColor = values.map(v => v >= goal ? '#3b82f6' : 'rgba(59,130,246,.4)');
    App.waterChartInst.update();
    return;
  }
  App.waterChartInst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Vasos', data: values, backgroundColor: values.map(v => v >= goal ? '#3b82f6' : 'rgba(59,130,246,.4)'), borderRadius: 8, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} vasos` } } }, scales: { y: { beginAtZero: true, max: goal + 2, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { stepSize: 2, font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } } }
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
  let weightLogs = LS.get('weight_logs', []).sort((a, b) => a.date.localeCompare(b.date));
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

  if (App.weightChartInst) { App.weightChartInst.data.labels = labels; App.weightChartInst.data.datasets[0].data = data; App.weightChartInst.update(); return; }
  App.weightChartInst = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Peso (kg)', data, borderColor: 'var(--emerald-500)', backgroundColor: 'rgba(16,185,129,.1)', borderWidth: 2.5, pointBackgroundColor: 'var(--emerald-500)', pointBorderColor: 'white', pointBorderWidth: 2, pointRadius: 5, fill: true, tension: .4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} kg` } } }, scales: { y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } } }
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
    const dayLogs = LS.get('food_logs_' + Utils.toDateStr(d), []);
    consumed.push(Math.round(dayLogs.reduce((s, l) => s + (l.calories || 0), 0)));
    goalLine.push(dailyGoal);
  }

  if (App.caloriesChartInst) {
    App.caloriesChartInst.data.labels = labels;
    App.caloriesChartInst.data.datasets[0].data = consumed;
    App.caloriesChartInst.data.datasets[0].backgroundColor = consumed.map(v => v > dailyGoal ? 'rgba(239,68,68,.7)' : 'rgba(16,185,129,.7)');
    App.caloriesChartInst.data.datasets[1].data = goalLine;
    App.caloriesChartInst.update();
    return;
  }
  App.caloriesChartInst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels, datasets: [
        { label: 'Consumido', data: consumed, backgroundColor: consumed.map(v => v > dailyGoal ? 'rgba(239,68,68,.7)' : 'rgba(16,185,129,.7)'), borderRadius: 8, borderSkipped: false },
        { label: 'Meta', data: goalLine, type: 'line', borderColor: 'rgba(245,158,11,.8)', borderWidth: 2, borderDash: [6, 4], pointRadius: 0, fill: false }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, usePointStyle: true } }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} kcal` } } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } } }
  });
}
export async function logWeight() {
  const input = document.getElementById('log-weight-input');
  const weight = parseFloat(input?.value);
  if (!weight || weight < 20 || weight > 300) { showToast('Ingresa un peso válido (20-300 kg)', 'error'); return; }

  const todayStr = Utils.toDateStr(new Date());
  const lsLogs = LS.get('weight_logs', []);
  const idx = lsLogs.findIndex(l => l.date === todayStr);
  if (idx >= 0) lsLogs[idx].weight = weight;
  else lsLogs.push({ date: todayStr, weight });
  LS.set('weight_logs', lsLogs);

  App.user.weight = weight;
  LS.set('user', App.user);
  showToast(`Peso registrado: ${weight} kg`, 'success');
  if (input) input.value = '';

  [App.weightChartInst, App.caloriesChartInst].forEach(c => { if (c) { c.destroy(); } });
  App.weightChartInst = App.caloriesChartInst = null;
  refreshProgress();
}
export function refreshProfile() {
  const u = App.user;
  if (!u) return;

  const avatar = document.getElementById('profile-avatar');
  if (avatar) {
    avatar.innerHTML = u.gender === 'female'
      ? '<i data-lucide="user-round"></i>'
      : '<i data-lucide="user"></i>';
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
  const age = parseFloat(document.getElementById('edit-age')?.value);
  const height = parseFloat(document.getElementById('edit-height')?.value);
  const weight = parseFloat(document.getElementById('edit-weight')?.value);
  const activity = document.getElementById('edit-activity')?.value;
  const goal = document.getElementById('edit-goal')?.value;

  if (!name) { showToast('El nombre no puede estar vacío', 'error'); return; }
  if (isNaN(age) || age < 12) { showToast('Edad inválida', 'error'); return; }
  if (isNaN(height) || height < 100) { showToast('Altura inválida', 'error'); return; }
  if (isNaN(weight) || weight < 30) { showToast('Peso inválido', 'error'); return; }

  const bmr = Utils.calculateBMR(App.user.gender, age, weight, height);
  const tdee = Utils.calculateTDEE(bmr, activity);
  const dailyCal = Utils.calculateDailyCalories(tdee, goal);
  const macros = Utils.calculateMacros(dailyCal, goal);

  App.user = {
    ...App.user,
    name, age, height, weight, activity_level: activity, goal,
    bmr: Math.round(bmr), daily_calories: dailyCal, protein_goal: macros.protein, carbs_goal: macros.carbs, fat_goal: macros.fat
  };
  LS.setUser(App.user);

  setGreeting();
  refreshProfile();
  document.getElementById('edit-profile-form')?.classList.remove('open');
  showToast('Perfil actualizado ✓', 'success');
  await refreshDashboard();
}
export function clearDataConfirm() {
  if (!confirm('⚠️ Esto eliminará TODOS tus datos y reiniciará la aplicación. ¿Estás seguro?')) return;
  Object.keys(localStorage).filter(k => k.startsWith('nt_')).forEach(k => localStorage.removeItem(k));
  App.user = null; App.todayLogs = []; App.todayWater = 0;
  [App.caloriesRingChart, App.weightChartInst, App.caloriesChartInst, App.waterChartInst].forEach(c => { if (c) { c.destroy(); } });
  App.caloriesRingChart = App.weightChartInst = App.caloriesChartInst = App.waterChartInst = null;

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
      ob.age = parseFloat(document.getElementById('ob-age').value);
      ob.height = parseFloat(document.getElementById('ob-height').value);
      ob.weight = parseFloat(document.getElementById('ob-weight').value);
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

  ob.age = parseFloat(document.getElementById('ob-age').value);
  ob.height = parseFloat(document.getElementById('ob-height').value);
  ob.weight = parseFloat(document.getElementById('ob-weight').value);

  const bmr = Utils.calculateBMR(ob.gender, ob.age, ob.weight, ob.height);
  const tdee = Utils.calculateTDEE(bmr, ob.activity);
  const dailyCal = Utils.calculateDailyCalories(tdee, ob.goal);
  const macros = Utils.calculateMacros(dailyCal, ob.goal);

  const userData = {
    id: 'user_' + Date.now(),
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

  LS.setUser(userData);
  App.user = userData;

  const lsLogs = LS.get('weight_logs', []);
  lsLogs.push({ date: Utils.toDateStr(new Date()), weight: ob.weight });
  LS.set('weight_logs', lsLogs);

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
}
export const ScannerState = {
  html5Qr: null,
  scanning: false,
  selectedMeal: 'breakfast',
  processed: false,
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
export function openScannerModal() {
  const modal = document.getElementById('scanner-container');
  if (!modal) return;
  ScannerState.processed = false;
  _scannerHideBarcodeResult();
  _scannerSetPhase(1);
  _scannerSetStatus('Apunta al codigo de barras del producto', false);
  document.querySelectorAll('#scanner-container .scanner-meal-pill').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.meal === ScannerState.selectedMeal);
  });
  modal.style.display = 'flex';
  // Small delay to allow display:flex to apply before adding class for transition
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
  _scannerSetStatus('Inicializando camara...', true);
  if (typeof Html5Qrcode === 'undefined') {
    showToast('Libreria de escaneo no disponible. Verifica tu conexion a Internet.', 'error');
    _scannerSetStatus('Libreria no disponible', false);
    return;
  }
  try {
    ScannerState.html5Qr = new Html5Qrcode('interactive-scanner');
    ScannerState.scanning = true;
    await ScannerState.html5Qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 160 }, aspectRatio: 1.0, disableFlip: false },
      _onBarcodeDetected,
      function () { }
    );
    _scannerSetStatus('Apunta al codigo de barras del producto', false);
  } catch (err) {
    ScannerState.scanning = false;
    console.error('[Scanner] Error camara:', err);
    const msg = (err.name === 'NotAllowedError' || String(err).includes('Permission'))
      ? 'Permiso de camara denegado. Activalo en la configuracion.'
      : 'No se pudo acceder a la camara. Esta siendo usada por otra app?';
    showToast(msg, 'error');
    _scannerSetStatus(msg, false);
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
  await _stopBarcodeScanner();
  _scannerShowBarcodeResult(decodedText);
  _scannerSetPhase(2);
  _scannerSetStatus('Buscando en Open Food Facts...', true);
  await API._queryOpenFoodFactsByBarcode(decodedText);
}
export function _triggerLabelPhotoFallback() {
  showToast('Producto no encontrado en base de datos. Analizando etiqueta con IA...', 'warning', '\uD83E\uDD16');
  _scannerSetPhase(2);
  _scannerSetStatus('Toma una foto de la Tabla Nutricional del empaque', false);
  var labelInput = document.getElementById('scanner-label-input');
  if (labelInput) { labelInput.value = ''; labelInput.click(); }
}
export function _registerScannedProduct(food, qty, sourceOverride) {
  qty = qty || 100;
  sourceOverride = sourceOverride || 'off';
  var ratio = qty / 100;
  var dateStr = new Date().toLocaleDateString('en-CA');
  var mealType = ScannerState.selectedMeal || 'breakfast';
  var logData = {
    id: 'scan_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    user_id: (App.user && App.user.id) ? App.user.id : 'local',
    date: dateStr,
    meal_type: mealType,
    food_name: food.name,
    quantity: qty,
    calories: Math.round((food.calories_per_100g || 0) * ratio),
    protein: parseFloat(((food.protein_per_100g || 0) * ratio).toFixed(1)),
    carbs: parseFloat(((food.carbs_per_100g || 0) * ratio).toFixed(1)),
    fat: parseFloat(((food.fat_per_100g || 0) * ratio).toFixed(1)),
    fiber: parseFloat(((food.fiber_per_100g || 0) * ratio).toFixed(1)),
    sugar: parseFloat(((food.sugar_per_100g || 0) * ratio).toFixed(1)),
    source: sourceOverride,
  };
  saveFoodLogLocal(logData);
  var mealNames = { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', snack: 'Snack' };
  showToast('\uD83D\uDCE6 "' + food.name + '" anadido a ' + (mealNames[mealType] || 'Comida') + ' \u2713', 'success', '\uD83D\uDCE6');
  closeScannerModal();
  if (App.currentPage === 'home') refreshDashboard();
  if (App.currentPage === 'diary') refreshDiary();
}
export function exportData() {
  if (localStorage.length === 0) {
    showToast("Error: No hay datos para respaldar.", "error");
    return;
  }

  try {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      backup[key] = localStorage.getItem(key);
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'NutriTrack_Backup.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Respaldo exportado exitosamente.", "success");
  } catch (error) {
    console.error("Error exportando datos:", error);
    showToast("Hubo un error al exportar los datos.", "error");
  }
}
export function importData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const backup = JSON.parse(e.target.result);
      if (!confirm('¿Estás seguro de reemplazar todos tus datos actuales con este respaldo?')) {
        event.target.value = '';
        return;
      }

      localStorage.clear();
      for (const key in backup) {
        if (backup.hasOwnProperty(key)) {
          localStorage.setItem(key, backup[key]);
        }
      }

      showToast("Datos importados exitosamente. Recargando...", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error("Error importando datos:", error);
      showToast("Error al leer el archivo de respaldo. Verifica que sea un JSON válido.", "error");
    }
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
      await _analyzeLabelWithGemini(file);
    });
  }

  document.querySelectorAll('#scanner-container .scanner-meal-pill').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#scanner-container .scanner-meal-pill')
        .forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      ScannerState.selectedMeal = btn.dataset.meal;
    });
  });
}
export function getFoodIdentity(food) {
  return Utils.normalizeSearchText(food?.food_name || food?.name || '');
}

export function toggleFavorite(food) {
  if (!food) return;
  const nameToMatch = food.food_name || food.name;
  if (!nameToMatch) return;

  let favs = getFavorites();
  const normalizedName = getFoodIdentity(food);
  const existingIdx = favs.findIndex(f => getFoodIdentity(f) === normalizedName);

  if (existingIdx !== -1) {
    // Ya existe → eliminar por nombre normalizado (consistente en toda la app)
    favs.splice(existingIdx, 1);
    LS.set('favorites', favs);
    showToast('Eliminado de favoritos', 'info');
  } else {
    // No existe → agregar con datos completos
    const ratio = (food.defaultServingGrams || 100) / 100;
    favs.push({
      id:       'fav_' + Date.now(),
      food_name: nameToMatch,
      quantity:  food.quantity  ?? food.defaultServingGrams ?? 100,
      calories:  food.calories  !== undefined ? food.calories  : Math.round((food.calories_per_100g  || 0) * ratio),
      protein:   food.protein   !== undefined ? food.protein   : parseFloat(((food.protein_per_100g  || 0) * ratio).toFixed(1)),
      carbs:     food.carbs     !== undefined ? food.carbs     : parseFloat(((food.carbs_per_100g    || 0) * ratio).toFixed(1)),
      fat:       food.fat       !== undefined ? food.fat       : parseFloat(((food.fat_per_100g      || 0) * ratio).toFixed(1)),
      fiber:     food.fiber     !== undefined ? food.fiber     : parseFloat(((food.fiber_per_100g    || 0) * ratio).toFixed(1)),
      sugar:     food.sugar     !== undefined ? food.sugar     : parseFloat(((food.sugar_per_100g    || 0) * ratio).toFixed(1)),
      source:    food.source || 'manual',
      savedAt:   Date.now(),   // metadato para debug/ordenación futura
    });
    LS.set('favorites', favs);
    showToast('¡Guardado en favoritos!', 'success');
  }
}

export async function addToMealFromFav(targetMeal) {
  if (!pendingFavToAdd) return;
  const fav = pendingFavToAdd;
  saveFoodLogLocal({
    id: `manual_${Date.now()}`,
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
    source: fav.source || 'manual'
  });
  document.getElementById('meal-selector-ui')?.classList.add('hidden');
  toggleFavoritesModal(false);
  showToast(`${fav.food_name} añadido ✓`, 'success');
  pendingFavToAdd = null;
  await refreshDiary();
  if (App.currentPage === 'home') refreshDashboard();
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
  const isDark = LS.get('dark_mode', false);
  document.body.classList.toggle('dark-theme', !!isDark);
}

export function toggleDarkMode() {
  const isDark = !document.body.classList.contains('dark-theme');
  document.body.classList.toggle('dark-theme', isDark);
  LS.set('dark_mode', isDark);
}

