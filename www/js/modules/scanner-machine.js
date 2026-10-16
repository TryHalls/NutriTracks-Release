export const ScannerPhase = Object.freeze({
  CLOSED: 'CLOSED',
  STARTING: 'STARTING',
  SCANNING: 'SCANNING',
  LOOKUP: 'LOOKUP',
  NOT_FOUND: 'NOT_FOUND',
  LABEL_ANALYSIS: 'LABEL_ANALYSIS',
  CONFIRM: 'CONFIRM',
  SAVING: 'SAVING',
});

const TRANSITIONS = Object.freeze({
  [ScannerPhase.CLOSED]: [ScannerPhase.STARTING],
  [ScannerPhase.STARTING]: [ScannerPhase.SCANNING, ScannerPhase.NOT_FOUND, ScannerPhase.CLOSED],
  [ScannerPhase.SCANNING]: [ScannerPhase.LOOKUP, ScannerPhase.LABEL_ANALYSIS, ScannerPhase.NOT_FOUND, ScannerPhase.CLOSED],
  [ScannerPhase.LOOKUP]: [ScannerPhase.CONFIRM, ScannerPhase.NOT_FOUND, ScannerPhase.CLOSED],
  [ScannerPhase.NOT_FOUND]: [ScannerPhase.SCANNING, ScannerPhase.LOOKUP, ScannerPhase.LABEL_ANALYSIS, ScannerPhase.CLOSED],
  [ScannerPhase.LABEL_ANALYSIS]: [ScannerPhase.CONFIRM, ScannerPhase.NOT_FOUND, ScannerPhase.CLOSED],
  [ScannerPhase.CONFIRM]: [ScannerPhase.SAVING, ScannerPhase.CLOSED],
  [ScannerPhase.SAVING]: [ScannerPhase.CONFIRM, ScannerPhase.CLOSED],
});

export function createScannerMachine() {
  return {
    phase: ScannerPhase.CLOSED,
    code: null,
    pendingFood: null,
    pendingFoodSource: null,
    selectedMeal: 'breakfast',
  };
}

export function transitionScannerState(machine, nextPhase) {
  if (!TRANSITIONS[machine.phase]?.includes(nextPhase)) return false;
  machine.phase = nextPhase;
  return true;
}

export function retryScanner(machine) {
  if (machine.phase !== ScannerPhase.NOT_FOUND) return false;
  machine.code = null;
  machine.pendingFood = null;
  machine.pendingFoodSource = null;
  return transitionScannerState(machine, ScannerPhase.SCANNING);
}

export function beginScannerSave(machine) {
  return transitionScannerState(machine, ScannerPhase.SAVING);
}

export function finishScannerSave(machine, succeeded) {
  if (machine.phase !== ScannerPhase.SAVING) return false;
  if (!succeeded) return transitionScannerState(machine, ScannerPhase.CONFIRM);
  if (!transitionScannerState(machine, ScannerPhase.CLOSED)) return false;
  machine.code = null;
  machine.pendingFood = null;
  machine.pendingFoodSource = null;
  machine.selectedMeal = 'breakfast';
  return true;
}

export function resetScannerMachine(machine) {
  machine.phase = ScannerPhase.CLOSED;
  machine.code = null;
  machine.pendingFood = null;
  machine.pendingFoodSource = null;
  machine.selectedMeal = 'breakfast';
  return machine;
}
