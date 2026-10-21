// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Zustand Game Store with Bot Automation, Auto-Save & Resume
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { Card } from '../engine/types';
import {
  GameEngineState,
  SetupOptions,
  setupGame,
  gameEngineReducer,
} from '../engine/gameReducer';
import { isDeadCard } from '../engine/board';
import { isTwoEyedJack, isOneEyedJack } from '../engine/deck';
import { chooseMove, BotDifficulty } from '../engine/bot';
import { storage } from '../utils/storage';

export const GAME_SAVE_STORAGE_KEY = '@sequence_game_saved_state';

let botTimer: NodeJS.Timeout | null = null;

export function clearBotTimer() {
  if (botTimer) {
    clearTimeout(botTimer);
    botTimer = null;
  }
}

export interface GameStore {
  // ── State ──────────────────────────────────────────────────────────────────
  game: GameEngineState | null;
  selectedCard: Card | null;
  validTargets: [number, number][];
  hasSavedGame: boolean;
  botDifficulty: BotDifficulty;
  isBotThinking: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────
  startNewGame: (options: SetupOptions) => void;
  setBotDifficulty: (difficulty: BotDifficulty) => void;
  selectCard: (cardId: string | null) => void;
  playMove: (cell: [number, number], cardId?: string) => void;
  discardDeadCard: (cardId: string) => void;
  endTurn: () => void;
  resumeGame: () => Promise<boolean>;
  checkSavedGame: () => Promise<boolean>;
  clearSavedGame: () => Promise<void>;
  triggerBotTurnIfNeeded: () => void;

  // ── Getters ────────────────────────────────────────────────────────────────
  getCurrentPlayer: () => GameEngineState['players'][0] | null;
  getDeadCardsInHand: () => Card[];
  isCurrentPlayerBot: () => boolean;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  selectedCard: null,
  validTargets: [],
  hasSavedGame: false,
  botDifficulty: 'medium',
  isBotThinking: false,

  setBotDifficulty(difficulty: BotDifficulty) {
    set({ botDifficulty: difficulty });
  },

  startNewGame(options: SetupOptions) {
    clearBotTimer();
    const freshGame = setupGame(options);
    set({
      game: freshGame,
      selectedCard: null,
      validTargets: [],
      hasSavedGame: true,
      isBotThinking: false,
    });
    storage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(freshGame)).catch(() => {});

    // Check if starting player is bot
    get().triggerBotTurnIfNeeded();
  },

  selectCard(cardId: string | null) {
    const { game } = get();
    if (!game || !cardId) {
      set({ selectedCard: null, validTargets: [] });
      return;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    const card = currentPlayer?.hand.find((c) => c.id === cardId) ?? null;
    if (!card) {
      set({ selectedCard: null, validTargets: [] });
      return;
    }

    const targets = computeValidTargets(game, card);
    set({
      selectedCard: card,
      validTargets: targets,
      game: {
        ...game,
        selectedCardId: cardId,
      },
    });
  },

  playMove(cell: [number, number], cardId?: string) {
    const { game, selectedCard } = get();
    if (!game) return;

    const targetCardId = cardId ?? selectedCard?.id ?? game.selectedCardId ?? undefined;
    const nextState = gameEngineReducer(game, {
      type: 'PLAY_MOVE',
      cell,
      cardId: targetCardId,
    });

    set({
      game: nextState,
      selectedCard: null,
      validTargets: [],
      hasSavedGame: nextState.phase !== 'finished',
      isBotThinking: false,
    });

    // Auto-save after every turn
    if (nextState.phase === 'finished') {
      clearBotTimer();
      storage.removeItem(GAME_SAVE_STORAGE_KEY).catch(() => {});
    } else {
      storage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(nextState)).catch(() => {});
      // Trigger bot turn if next player is bot
      get().triggerBotTurnIfNeeded();
    }
  },

  discardDeadCard(cardId: string) {
    const { game } = get();
    if (!game) return;

    const nextState = gameEngineReducer(game, {
      type: 'DISCARD_DEAD_CARD',
      cardId,
    });

    set({
      game: nextState,
      selectedCard: null,
      validTargets: [],
    });

    storage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(nextState)).catch(() => {});

    // If bot discarded, it still needs to make its regular move
    if (get().isCurrentPlayerBot()) {
      get().triggerBotTurnIfNeeded();
    }
  },

  endTurn() {
    const { game } = get();
    if (!game) return;

    const nextState = gameEngineReducer(game, { type: 'END_TURN' });
    set({
      game: nextState,
      selectedCard: null,
      validTargets: [],
      isBotThinking: false,
    });

    storage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(nextState)).catch(() => {});
    get().triggerBotTurnIfNeeded();
  },

  triggerBotTurnIfNeeded() {
    clearBotTimer();
    const { game, botDifficulty, isCurrentPlayerBot } = get();
    if (!game || game.phase !== 'playing' || !isCurrentPlayerBot()) {
      set({ isBotThinking: false });
      return;
    }

    set({ isBotThinking: true });

    // Wait 0.8-1.5s (800ms - 1500ms random) as requested
    const delay = Math.floor(Math.random() * (1500 - 800 + 1)) + 800;

    botTimer = setTimeout(() => {
      const state = get().game;
      if (!state || state.phase !== 'playing') {
        set({ isBotThinking: false });
        return;
      }

      const currentPlayer = state.players[state.currentPlayerIndex];
      const botMove = chooseMove(state, currentPlayer.id, botDifficulty);

      if (!botMove) {
        // No moves available, end turn
        get().endTurn();
        return;
      }

      if (botMove.type === 'discard_dead') {
        get().discardDeadCard(botMove.cardId);
      } else {
        get().playMove(botMove.cell, botMove.cardId);
      }
    }, delay);
  },

  async resumeGame(): Promise<boolean> {
    clearBotTimer();
    try {
      const raw = await storage.getItem(GAME_SAVE_STORAGE_KEY);
      if (!raw) {
        set({ hasSavedGame: false });
        return false;
      }
      const savedState = JSON.parse(raw) as GameEngineState;
      if (savedState && savedState.board && savedState.players) {
        set({
          game: savedState,
          selectedCard: null,
          validTargets: [],
          hasSavedGame: true,
          isBotThinking: false,
        });
        get().triggerBotTurnIfNeeded();
        return true;
      }
    } catch {
      // Storage error
    }
    set({ hasSavedGame: false });
    return false;
  },

  async checkSavedGame(): Promise<boolean> {
    try {
      const raw = await storage.getItem(GAME_SAVE_STORAGE_KEY);
      const exists = Boolean(raw && raw.length > 10);
      set({ hasSavedGame: exists });
      return exists;
    } catch {
      set({ hasSavedGame: false });
      return false;
    }
  },

  async clearSavedGame(): Promise<void> {
    clearBotTimer();
    await storage.removeItem(GAME_SAVE_STORAGE_KEY);
    set({ hasSavedGame: false });
  },

  getCurrentPlayer() {
    const { game } = get();
    if (!game || game.players.length === 0) return null;
    return game.players[game.currentPlayerIndex] ?? null;
  },

  getDeadCardsInHand() {
    const { game } = get();
    if (!game) return [];
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer) return [];
    return currentPlayer.hand.filter((card) => isDeadCard(game.board, card));
  },

  isCurrentPlayerBot() {
    const { game } = get();
    if (!game || game.settings.mode !== 'bot') return false;
    // In bot mode, player 0 is the human player, player 1+ are bots
    return game.currentPlayerIndex > 0;
  },
}));

function computeValidTargets(game: GameEngineState, card: Card): [number, number][] {
  const targets: [number, number][] = [];
  const currentPlayer = game.players[game.currentPlayerIndex];
  const board = game.board;

  if (isTwoEyedJack(card)) {
    // Any unoccupied non-corner cell
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        if (cell.card !== 'CORNER' && cell.chip === null) {
          targets.push([r, c]);
        }
      }
    }
    return targets;
  }

  if (isOneEyedJack(card)) {
    // Any opponent chip not locked
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        if (cell.card !== 'CORNER' && cell.chip !== null && cell.chip !== currentPlayer.teamId && !cell.locked) {
          targets.push([r, c]);
        }
      }
    }
    return targets;
  }

  // Normal card: empty matching board cells
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = board[r][c];
      if (
        cell.card !== 'CORNER' &&
        cell.card.suit === card.suit &&
        cell.card.rank === card.rank &&
        cell.chip === null
      ) {
        targets.push([r, c]);
      }
    }
  }

  return targets;
}
