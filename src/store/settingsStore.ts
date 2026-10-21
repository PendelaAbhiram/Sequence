// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Settings & Local Player Statistics Store
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { storage } from '../utils/storage';
import { soundManager } from '../utils/audio';

export const SETTINGS_STORAGE_KEY = '@sequence_app_settings';
export const STATS_STORAGE_KEY = '@sequence_player_stats';

export type AppTheme = 'dark' | 'light';
export type CardSizePreference = 'compact' | 'normal' | 'large';
export type AppLanguage = 'en' | 'es' | 'fr' | 'de';

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  botGamesPlayed: number;
  botWins: number;
  localGamesPlayed: number;
  chipsPlaced: number;
  jacksUsed: number;
  sequencesFormed: number;
}

export interface SettingsStore {
  // ── Settings State ─────────────────────────────────────────────────────────
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  theme: AppTheme;
  cardSize: CardSizePreference;
  colorBlindMode: boolean;
  language: AppLanguage;

  // ── Stats State ────────────────────────────────────────────────────────────
  stats: PlayerStats;

  // ── Actions ────────────────────────────────────────────────────────────────
  setSoundEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setTheme: (theme: AppTheme) => void;
  setCardSize: (size: CardSizePreference) => void;
  setColorBlindMode: (enabled: boolean) => void;
  setLanguage: (lang: AppLanguage) => void;

  recordMatchResult: (result: {
    won: boolean;
    isBotMode: boolean;
    chipsPlacedCount: number;
    jacksCount: number;
    sequencesCount: number;
  }) => void;

  resetStats: () => void;
  loadSettingsAndStats: () => Promise<void>;
}

const defaultStats: PlayerStats = {
  gamesPlayed: 0,
  wins: 0,
  botGamesPlayed: 0,
  botWins: 0,
  localGamesPlayed: 0,
  chipsPlaced: 0,
  jacksUsed: 0,
  sequencesFormed: 0,
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  soundEnabled: true,
  musicEnabled: false,
  hapticsEnabled: true,
  theme: 'dark',
  cardSize: 'normal',
  colorBlindMode: false,
  language: 'en',
  stats: defaultStats,

  setSoundEnabled(enabled: boolean) {
    soundManager.setSoundEnabled(enabled);
    set({ soundEnabled: enabled });
    saveSettings(get());
  },

  setMusicEnabled(enabled: boolean) {
    soundManager.setMusicEnabled(enabled);
    set({ musicEnabled: enabled });
    saveSettings(get());
  },

  setHapticsEnabled(enabled: boolean) {
    set({ hapticsEnabled: enabled });
    saveSettings(get());
  },

  setTheme(theme: AppTheme) {
    set({ theme });
    saveSettings(get());
  },

  setCardSize(size: CardSizePreference) {
    set({ cardSize: size });
    saveSettings(get());
  },

  setColorBlindMode(enabled: boolean) {
    set({ colorBlindMode: enabled });
    saveSettings(get());
  },

  setLanguage(lang: AppLanguage) {
    set({ language: lang });
    saveSettings(get());
  },

  recordMatchResult({ won, isBotMode, chipsPlacedCount, jacksCount, sequencesCount }) {
    const prev = get().stats;
    const next: PlayerStats = {
      gamesPlayed: prev.gamesPlayed + 1,
      wins: prev.wins + (won ? 1 : 0),
      botGamesPlayed: prev.botGamesPlayed + (isBotMode ? 1 : 0),
      botWins: prev.botWins + (isBotMode && won ? 1 : 0),
      localGamesPlayed: prev.localGamesPlayed + (!isBotMode ? 1 : 0),
      chipsPlaced: prev.chipsPlaced + chipsPlacedCount,
      jacksUsed: prev.jacksUsed + jacksCount,
      sequencesFormed: prev.sequencesFormed + sequencesCount,
    };

    set({ stats: next });
    storage.setItem(STATS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  resetStats() {
    set({ stats: defaultStats });
    storage.setItem(STATS_STORAGE_KEY, JSON.stringify(defaultStats)).catch(() => {});
  },

  async loadSettingsAndStats() {
    try {
      const rawSettings = await storage.getItem(SETTINGS_STORAGE_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed.soundEnabled !== undefined) soundManager.setSoundEnabled(parsed.soundEnabled);
        if (parsed.musicEnabled !== undefined) soundManager.setMusicEnabled(parsed.musicEnabled);
        set({
          soundEnabled: parsed.soundEnabled ?? true,
          musicEnabled: parsed.musicEnabled ?? false,
          hapticsEnabled: parsed.hapticsEnabled ?? true,
          theme: parsed.theme ?? 'dark',
          cardSize: parsed.cardSize ?? 'normal',
          colorBlindMode: parsed.colorBlindMode ?? false,
          language: parsed.language ?? 'en',
        });
      }

      const rawStats = await storage.getItem(STATS_STORAGE_KEY);
      if (rawStats) {
        const parsedStats = JSON.parse(rawStats);
        set({ stats: { ...defaultStats, ...parsedStats } });
      }
    } catch {}
  },
}));

function saveSettings(state: SettingsStore) {
  const data = {
    soundEnabled: state.soundEnabled,
    musicEnabled: state.musicEnabled,
    hapticsEnabled: state.hapticsEnabled,
    theme: state.theme,
    cardSize: state.cardSize,
    colorBlindMode: state.colorBlindMode,
    language: state.language,
  };
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data)).catch(() => {});
}
