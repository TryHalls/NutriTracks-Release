import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add roles and aria-labels to buttons
def modify_button(match):
    tag = match.group(0)
    if 'aria-label' not in tag and 'aria-pressed' not in tag:
        # Check text content? It's hard with regex, let's just add generic aria-labels for icon buttons
        if 'btn-photo-label' in tag:
            tag = tag.replace('<button', '<button aria-label="Tomar foto a etiqueta"')
        elif 'btn-ai-analyze' in tag:
            tag = tag.replace('<button', '<button aria-label="Analizar con IA"')
        elif 'btn-manual-search' in tag:
            tag = tag.replace('<button', '<button aria-label="Buscar manual"')
        elif 'btn-log-weight' in tag:
            tag = tag.replace('<button', '<button aria-label="Guardar peso"')
        elif 'btn-save-ai-config' in tag:
            tag = tag.replace('<button', '<button aria-label="Guardar configuración de IA"')
        elif 'btn-confirm-add' in tag:
            tag = tag.replace('<button', '<button aria-label="Confirmar añadir alimento"')
        elif 'btn-quick-add' in tag:
            tag = tag.replace('<button', '<button aria-label="Añadir rápido"')
        elif 'btn-scan-product' in tag:
            tag = tag.replace('<button', '<button aria-label="Abrir escáner inteligente"')
        elif 'nav-item' in tag:
            if 'nav-home' in tag: tag = tag.replace('<button', '<button aria-label="Inicio"')
            if 'nav-diary' in tag: tag = tag.replace('<button', '<button aria-label="Diario"')
            if 'nav-water' in tag: tag = tag.replace('<button', '<button aria-label="Agua"')
            if 'nav-progress' in tag: tag = tag.replace('<button', '<button aria-label="Progreso"')
            if 'nav-profile' in tag: tag = tag.replace('<button', '<button aria-label="Perfil"')
        elif 'ai-meal-pill' in tag or 'scanner-meal-pill' in tag:
            if 'breakfast' in tag: tag = tag.replace('<button', '<button aria-pressed="false" aria-label="Seleccionar Desayuno"')
            if 'lunch' in tag: tag = tag.replace('<button', '<button aria-pressed="false" aria-label="Seleccionar Almuerzo"')
            if 'dinner' in tag: tag = tag.replace('<button', '<button aria-pressed="false" aria-label="Seleccionar Cena"')
            if 'snack' in tag: tag = tag.replace('<button', '<button aria-pressed="false" aria-label="Seleccionar Snack"')
        elif 'gender-btn' in tag:
            if 'male' in tag: tag = tag.replace('<button', '<button aria-pressed="false" aria-label="Género masculino"')
            if 'female' in tag: tag = tag.replace('<button', '<button aria-pressed="false" aria-label="Género femenino"')
        elif 'addToMealFromFav' in tag:
            tag = tag.replace('<button', '<button aria-label="Añadir de favoritos a comida"')
        elif 'closeAIFoodEditModal' in tag:
            tag = tag.replace('<button', '<button aria-label="Cancelar edición IA"')
        elif 'ai-edit-save-btn' in tag:
            tag = tag.replace('<button', '<button aria-label="Guardar edición IA"')
        elif 'confirmAIFoods' in tag:
            tag = tag.replace('<button', '<button aria-label="Revisar alimentos IA"')
        elif 'nextStep' in tag:
            tag = tag.replace('<button', '<button aria-label="Siguiente paso"')
        elif 'prevStep' in tag:
            tag = tag.replace('<button', '<button aria-label="Paso anterior"')
        elif 'finishOnboarding' in tag:
            tag = tag.replace('<button', '<button aria-label="Finalizar registro"')
        elif 'section-link' in tag:
            tag = tag.replace('<button', '<button aria-label="Ver diario"')
        elif 'saveProfile' in tag:
            tag = tag.replace('<button', '<button aria-label="Guardar perfil"')
        else:
            tag = tag.replace('<button', '<button aria-label="Botón de acción"')
    
    # Add role="button" to anything with onclick that is not a button
    # Wait, we are only matching <button> here.
    return tag

html = re.sub(r'<button[^>]*>', modify_button, html)

# Fix images alt
html = re.sub(r'<img(?![^>]*alt=)[^>]*>', lambda m: m.group(0).replace('<img', '<img alt="Imagen ilustrativa"'), html)

# Make sure toast container has role="alert" aria-live="assertive"
html = html.replace('id="toast-container"', 'id="toast-container" role="alert" aria-live="assertive"')

# Scanner modal: role="dialog" aria-modal="true" is already there. Add aria-label to video
html = html.replace('<div id="interactive-scanner" class="scanner-viewport"></div>', '<div id="interactive-scanner" class="scanner-viewport" aria-label="Cámara para escanear" role="region"></div>')

# Add aria-live to scanner status text
html = html.replace('<span id="scanner-status-text">', '<span id="scanner-status-text" aria-live="polite" aria-atomic="true">')

# Inject new Confirmation screen & manual fallback & flashlight & retry button
conf_html = """
        <!-- Scanner Confirmation -->
        <div class="scanner-confirmation" id="scanner-confirmation" style="display:none">
          <div class="scanner-conf-card">
            <h3 id="scanner-conf-name" class="scanner-conf-name">Producto</h3>
            <div class="scanner-conf-macros">
              <div class="mac-item"><span>Kcal</span><strong id="scanner-conf-kcal">0</strong></div>
              <div class="mac-item"><span>Prot</span><strong id="scanner-conf-prot">0</strong></div>
              <div class="mac-item"><span>Carb</span><strong id="scanner-conf-carb">0</strong></div>
              <div class="mac-item"><span>Grasa</span><strong id="scanner-conf-fat">0</strong></div>
            </div>
            <div class="scanner-conf-input form-group">
              <label for="scanner-conf-grams" class="form-label">Cantidad (g):</label>
              <input type="number" id="scanner-conf-grams" class="form-input" value="100" min="1" step="1" aria-describedby="scanner-conf-grams-desc" />
              <span id="scanner-conf-grams-desc" class="sr-only">Ingrese la cantidad en gramos</span>
            </div>
            <button class="btn-confirm-add" id="btn-scanner-confirm" type="button" aria-label="Guardar alimento escaneado">Guardar alimento</button>
          </div>
        </div>

        <!-- Scanner Manual Entry Fallback -->
        <div class="scanner-not-found" id="scanner-not-found" style="display:none">
          <div class="empty-icon"><i data-lucide="search-x"></i></div>
          <p>Producto no encontrado en la base de datos.</p>
          <div class="scanner-not-found-actions">
            <button class="btn-primary" id="btn-fallback-photo" type="button" aria-label="Tomar foto de etiqueta">
              <i data-lucide="camera" class="lucide-pill"></i> Tomar foto de etiqueta
            </button>
            <div class="scanner-manual-code-entry" style="display:flex;gap:8px;margin:8px 0;">
               <input type="text" id="scanner-manual-code" class="form-input" placeholder="Código manual" aria-label="Ingresar código de barras manualmente" />
               <button class="btn-secondary" id="btn-manual-code-search" type="button" aria-label="Buscar código" style="padding:0 12px;"><i data-lucide="search"></i></button>
            </div>
            <button class="btn-secondary" id="btn-fallback-manual" type="button" aria-label="Registrar manualmente">
              <i data-lucide="pencil" class="lucide-pill"></i> Registrar manualmente
            </button>
            <button class="btn-secondary" id="btn-fallback-retry" type="button" aria-label="Buscar otro código">
              <i data-lucide="refresh-cw" class="lucide-pill"></i> Buscar otro código
            </button>
          </div>
        </div>
"""

camera_wrap = """        <!-- Camera / Scanner Area -->
        <div class="scanner-camera-wrap" id="scanner-camera-wrap">
          <button id="btn-scanner-torch" class="btn-scanner-torch" type="button" aria-label="Alternar linterna" aria-pressed="false" style="position:absolute;top:10px;right:10px;z-index:20;background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
            <i data-lucide="flashlight"></i>
          </button>
          <div id="interactive-scanner" class="scanner-viewport" aria-label="Cámara para escanear" role="region"></div>
          <div class="scanner-laser"></div>
        </div>"""

html = html.replace('<div class="scanner-camera-wrap">\n          <div id="interactive-scanner" class="scanner-viewport"></div>\n          <div class="scanner-laser"></div>\n        </div>', camera_wrap)
html = html.replace('<!-- Actions -->', conf_html + '\n        <!-- Actions -->')

# Retry button for camera
retry_cam = """          <div class="scanner-spinner" id="scanner-spinner" style="display:none">
            <div class="scan-orb"></div>
            <span id="scanner-status-text" aria-live="polite" aria-atomic="true">Inicializando cámara…</span>
            <button id="btn-scanner-retry-cam" type="button" class="btn-secondary hidden" style="margin-top:10px;" aria-label="Reintentar cámara">Reintentar cámara</button>
          </div>"""
html = html.replace('<div class="scanner-spinner" id="scanner-spinner" style="display:none">\n            <div class="scan-orb"></div>\n            <span id="scanner-status-text" aria-live="polite" aria-atomic="true">Inicializando cámara…</span>\n          </div>', retry_cam)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
