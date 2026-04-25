// Auto-extracted state.js
export const App = {
  user: null,
  todayLogs: [],
  diaryLogs: [],
  todayWater: 0,
  currentDiaryDate: new Date(),
  currentPage: 'home',
  caloriesRingChart: null,
  weightChartInst: null,
  caloriesChartInst: null,
  waterChartInst: null,
  allFoods: [],
  selectedFood: null,
  currentMealType: null,
  selectedAIMeal: 'breakfast',
  aiSearchDebounce: null,
  recognition: null,
  lastAISourceMode: 'ai',
  lastAIInputMode: 'text',
  aiImage: null,
  aiEditorIndex: 0,
  _pendingAIFoods: null,
  activeModal: null,
  aiProcessing: false,
  lastAIError: null,
  aiFallbackMode: false,
  isDictationActive: false,
  searchQuery: '',
};
export const LS = {
  set(key, value) { try { localStorage.setItem('nt_' + key, JSON.stringify(value)); } catch (e) { } },
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem('nt_' + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  },
  remove(key) { localStorage.removeItem('nt_' + key); },
  normalizeUser(user) {
    if (!user || typeof user !== 'object') return user;
    if (user.initial_weight == null && user.weight != null) {
      return { ...user, initial_weight: user.weight };
    }
    return user;
  },
  getUser() {
    return this.normalizeUser(this.get('user'));
  },
  setUser(user) {
    this.set('user', this.normalizeUser(user));
  }
};
