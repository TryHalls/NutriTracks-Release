// js/modules/state.js

const _memCache = new Map();

export const App = {
  user: null,
  currentPage: 'home',
  todayLogs: [],
  todayWater: 0,
  diaryLogs: [],
  currentDiaryDate: new Date(),
  currentMealType: 'breakfast',
  selectedFood: null,
  caloriesRingChart: null,
  weightChartInst: null,
  caloriesChartInst: null,
  waterChartInst: null,
  aiImage: null,
  _pendingAIFoods: null,
  aiEditorIndex: 0,
  selectedAIMeal: 'breakfast',
  lastAIInputMode: 'text',
  recognition: null,
};

export const LS = {
  set(key, value) {
    try {
      localStorage.setItem('nt_' + key, JSON.stringify(value));
      _memCache.set(key, value);
    } catch (e) {
      console.warn('[LS] Error guardando:', e);
    }
  },

  get(key, fallback = null) {
    if (_memCache.has(key)) return _memCache.get(key);
    try {
      const v = localStorage.getItem('nt_' + key);
      const parsed = v !== null ? JSON.parse(v) : fallback;
      _memCache.set(key, parsed);
      return parsed;
    } catch (e) {
      return fallback;
    }
  },

  remove(key) {
    localStorage.removeItem('nt_' + key);
    _memCache.delete(key);
  },

  setUser(user) {
    this.set('user', user);
  },

  getUser() {
    return this.get('user', null);
  },

  normalizeUser(user) {
    return {
      ...user,
      daily_calories: user.daily_calories || 2000,
      protein_goal: user.protein_goal || 120,
      carbs_goal: user.carbs_goal || 250,
      fat_goal: user.fat_goal || 70,
      water_goal: user.water_goal || 8,
    };
  },
};