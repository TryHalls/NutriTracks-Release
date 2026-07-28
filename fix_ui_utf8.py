import re

with open('js/modules/ui.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Focus Trap and Escape Key
focus_trap_code = """
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
      const g = parseInt(this.value) || 0;
      const r = g / 100;
      const food = ScannerState.pendingFood;
      document.getElementById('scanner-conf-kcal').textContent = Math.round((food.calories_per_100g || 0) * r);
      document.getElementById('scanner-conf-prot').textContent = ((food.protein_per_100g || 0) * r).toFixed(1) + 'g';
      document.getElementById('scanner-conf-carb').textContent = ((food.carbs_per_100g || 0) * r).toFixed(1) + 'g';
      document.getElementById('scanner-conf-fat').textContent = ((food.fat_per_100g || 0) * r).toFixed(1) + 'g';
    });
  }

  const btnConfirmAdd = document.getElementById('btn-scanner-confirm');
  if (btnConfirmAdd) {
    btnConfirmAdd.addEventListener('click', function() {
      if (!ScannerState.pendingFood) return;
      const g = parseInt(document.getElementById('scanner-conf-grams')?.value) || 100;
      _executeRegisterScannedProduct(ScannerState.pendingFood, g, ScannerState.pendingFoodSource);
    });
  }
}
"""

content = re.sub(r'export function initScannerEvents\(\) \{[\s\S]*?(?=export function getFoodIdentity)', focus_trap_code, content)

# Auto select meal by greetingByHour
open_scanner_mod = """export function openScannerModal() {
  const modal = document.getElementById('scanner-container');
  if (!modal) return;
  ScannerState.processed = false;
  ScannerState.pendingFood = null;
  _scannerHideBarcodeResult();
  _scannerSetPhase(1);
  _scannerSetStatus('Apunta al código de barras del producto', false);
  
  // Hide fallback and confirmation screens
  const notFound = document.getElementById('scanner-not-found');
  if (notFound) notFound.style.display = 'none';
  const confScreen = document.getElementById('scanner-confirmation');
  if (confScreen) confScreen.style.display = 'none';
  const camWrap = document.getElementById('scanner-camera-wrap');
  if (camWrap) camWrap.style.display = 'block';

  // Select meal based on hour
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
"""
content = re.sub(r'export function openScannerModal\(\) \{[\s\S]*?(?=export async function closeScannerModal)', open_scanner_mod, content)


# _onBarcodeDetected vibration
on_barcode = """export async function _onBarcodeDetected(decodedText) {
  if (ScannerState.processed) return;
  ScannerState.processed = true;
  if (navigator.vibrate) navigator.vibrate(200); // Vibrate on success
  await _stopBarcodeScanner();
  _scannerShowBarcodeResult(decodedText);
  _scannerSetPhase(2);
  _scannerSetStatus('Buscando en Open Food Facts...', true);
  await API._queryOpenFoodFactsByBarcode(decodedText);
}
"""
content = re.sub(r'export async function _onBarcodeDetected\(decodedText\) \{[\s\S]*?(?=export function _triggerLabelPhotoFallback)', on_barcode, content)


# Update _registerScannedProduct to be the confirmation shower
register_scanned = """export function _triggerLabelPhotoFallback() {
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

export function _executeRegisterScannedProduct(food, qty, sourceOverride) {
  qty = qty || 100;
  sourceOverride = sourceOverride || 'off';
  var ratio = qty / 100;
  var dateStr = new Date().toLocaleDateString('en-CA');
  var mealType = ScannerState.selectedMeal || 'breakfast';
  var logData = {
    id: crypto.randomUUID(),
    user_id: (App.user && App.user.id) ? App.user.id : 'local',
    date: dateStr,
    meal_type: mealType,
    food_name: food.name || food.food_name,
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
  showToast('📦 "' + (food.name || food.food_name) + '" añadido a ' + (mealNames[mealType] || 'Comida') + ' ✓', 'success', '📦');
  closeScannerModal();
  if (App.currentPage === 'home') refreshDashboard();
  if (App.currentPage === 'diary') refreshDiary();
}
"""
content = re.sub(r'export function _triggerLabelPhotoFallback\(\) \{[\s\S]*?(?=export function exportData)', register_scanned, content)

start_cam = """export async function _startBarcodeScanner() {
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
}"""
content = re.sub(r'export async function _startBarcodeScanner\(\) \{[\s\S]*?(?=export async function _stopBarcodeScanner)', start_cam + '\n', content)

with open('js/modules/ui.js', 'w', encoding='utf-8') as f:
    f.write(content)
