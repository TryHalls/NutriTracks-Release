export const InitializationState = Object.freeze({
  READY: 'READY',
  ONBOARDING: 'ONBOARDING',
  RECOVERY_ERROR: 'RECOVERY_ERROR',
});

function setVisibility(documentRef, { onboarding = false, app = false, recovery = false }) {
  documentRef.getElementById('onboarding-screen')?.classList.toggle('hidden', !onboarding);
  documentRef.getElementById('app')?.classList.toggle('hidden', !app);
  documentRef.getElementById('storage-recovery-screen')?.classList.toggle('hidden', !recovery);
}

function enterRecoveryState(documentRef, logger, error) {
  logger.error('[Persistencia] No se pudo iniciar la aplicación:', error);
  setVisibility(documentRef, { recovery: true });
  const detail = documentRef.getElementById('storage-recovery-detail');
  if (detail) {
    detail.textContent = 'Tus datos locales siguen intactos. Puedes reintentar recargando o eliminarlos mediante el reset explícito.';
  }
  return InitializationState.RECOVERY_ERROR;
}

export async function initializeApp({
  app,
  ls,
  utils,
  api,
  ui,
  documentRef,
  logger = console,
}) {
  let user;
  try {
    // La persistencia principal se valida antes de inicializar UI secundaria
    // o ejecutar acciones como el cambio de fecha que pueden escribir storage.
    user = ls.getUser();
  } catch (error) {
    app.user = null;
    return enterRecoveryState(documentRef, logger, error);
  }

  if (!user) {
    app.user = null;
    ui.injectWaterPage();
    ui.applySavedDarkMode();
    setVisibility(documentRef, { onboarding: true });
    return InitializationState.ONBOARDING;
  }

  try {
    utils.checkAndResetForNewDay();
  } catch (error) {
    app.user = null;
    return enterRecoveryState(documentRef, logger, error);
  }

  app.user = user;
  ui.injectWaterPage();
  ui.applySavedDarkMode();
  setVisibility(documentRef, { app: true });
  ui.setGreeting();
  ui.refreshDashboard();
  api.loadAIConfig();
  return InitializationState.READY;
}

export function resetFromRecovery({ clearData, reload }) {
  const resetSucceeded = clearData();
  if (resetSucceeded) reload();
  return resetSucceeded;
}
