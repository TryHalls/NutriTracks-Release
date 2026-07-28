import re

with open('js/modules/api.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace _safeTriggerLabelPhotoFallback to call UI._showLabelPhotoFallbackUI
safe_fallback = """function _safeTriggerLabelPhotoFallback() {
  try {
    if (typeof UI._showLabelPhotoFallbackUI === 'function') {
      UI._showLabelPhotoFallbackUI();
      return;
    }
  } catch (err) {
    console.warn('[Scanner] No se pudo activar UI de fallback:', err?.message || err);
  }
  UI.showToast('Producto no encontrado. Registra manualmente.', 'warning');
}"""

content = re.sub(r'function _safeTriggerLabelPhotoFallback\(\) \{[\s\S]*?(?=\/\* ══════════════════════════════════════════════════════════════ \*\/)', safe_fallback + '\n\n', content)

with open('js/modules/api.js', 'w', encoding='utf-8') as f:
    f.write(content)
