// ─────────────────────────────────────────────────────────────────────────────
// Sequence Mobile App – Online Multiplayer Zustand Store
// Manages socket connection, room lifecycle, personalized game state,
// auto-reconnection, and device session persistence.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';
import { getSocket, connectSocket, disconnectSocket, TypedSocket } from '../services/socket';
import { SERVER_URL } from '../config';
import type {
  RoomState,
  RoomSettings,
  PlayerGameState,
} from '../../shared/protocol';
import type { Card, TeamId } from '../engine/types';
import { isDeadCard } from '../engine/board';
import { isTwoEyedJack, isOneEyedJack } from '../engine/deck';
import {
  savePlayerRoomSession,
  getPlayerRoomSession,
  clearPlayerRoomSession,
  PlayerRoomSession,
} from '../utils/storage';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface OnlineStore {
  // ── Connection & Meta ─────────────────────────────────────────────────────
  status: ConnectionStatus;
  serverUrl: string;
  errorMessage: string | null;

  // ── Session ───────────────────────────────────────────────────────────────
  isOnline: boolean;
  room: RoomState | null;
  playerId: string | null;
  reconnectToken: string | null;
  playerName: string;

  // ── Personalized Game State ───────────────────────────────────────────────
  gameState: PlayerGameState | null;
  selectedCard: Card | null;
  validTargets: [number, number][];

  // ── Actions ───────────────────────────────────────────────────────────────
  initSocket: () => void;
  createRoom: (
    playerName: string,
    settings?: Partial<RoomSettings>
  ) => Promise<{ success: boolean; room?: RoomState; error?: string }>;
  joinRoom: (
    roomCode: string,
    playerName: string
  ) => Promise<{ success: boolean; room?: RoomState; error?: string }>;
  setTeamCount: (teamCount: 2 | 3) => Promise<{ success: boolean; error?: string }>;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  selectCard: (cardId: string | null) => void;
  playMove: (cell: [number, number], cardId?: string) => Promise<{ success: boolean; error?: string }>;
  discardDeadCard: (cardId: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => Promise<void>;
  rejoinCurrentRoom: () => Promise<boolean>;
  clearError: () => void;
  resetOnlineState: () => void;
}

let socketInitialized = false;
let appStateSubscription: any = null;

function calculateValidTargets(
  board: PlayerGameState['board'],
  card: Card,
  myTeamId: TeamId
): [number, number][] {
  const targets: [number, number][] = [];

  if (isTwoEyedJack(card)) {
    // Two-eyed Jack: place on any unoccupied non-corner cell
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
    // One-eyed Jack: remove any opponent chip that is NOT locked
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        if (
          cell.card !== 'CORNER' &&
          cell.chip !== null &&
          cell.chip !== myTeamId &&
          !cell.locked
        ) {
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

export const useOnlineStore = create<OnlineStore>((set, get) => ({
  status: 'disconnected',
  serverUrl: SERVER_URL,
  errorMessage: null,

  isOnline: false,
  room: null,
  playerId: null,
  reconnectToken: null,
  playerName: 'Player',

  gameState: null,
  selectedCard: null,
  validTargets: [],

  clearError() {
    set({ errorMessage: null });
  },

  initSocket() {
    if (socketInitialized) return;
    socketInitialized = true;

    const socket = getSocket();

    socket.on('connect', () => {
      set({ status: 'connected', errorMessage: null });
      // If we were in a room, automatically re-authenticate and rejoin
      const { room, reconnectToken, playerId } = get();
      if (room && (reconnectToken || playerId)) {
        get().rejoinCurrentRoom();
      }
    });

    socket.on('disconnect', () => {
      set({ status: 'disconnected' });
    });

    socket.on('connect_error', () => {
      set({ status: 'connecting' });
    });

    socket.io.on('reconnect_attempt', () => {
      set({ status: 'connecting' });
    });

    socket.io.on('reconnect', () => {
      set({ status: 'connected' });
      get().rejoinCurrentRoom();
    });

    socket.on('roomUpdated', (updatedRoom) => {
      set({ room: updatedRoom });
    });

    socket.on('gameStateUpdated', (newGameState) => {
      const { selectedCard, playerId } = get();
      const meInRoom = newGameState.players.find((p) => p.id === playerId);
      const myTeam = meInRoom?.teamId ?? 'red';

      // Re-calculate valid targets if a card is currently selected
      let updatedTargets: [number, number][] = [];
      if (selectedCard && newGameState.board) {
        updatedTargets = calculateValidTargets(newGameState.board, selectedCard, myTeam);
      }

      set({
        gameState: newGameState,
        validTargets: updatedTargets,
      });
    });

    socket.on('error', (err) => {
      set({ errorMessage: err.message });
    });

    // Auto-rejoin when the app returns to the foreground
    if (!appStateSubscription && typeof AppState !== 'undefined') {
      appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          const { isOnline, status } = get();
          if (isOnline) {
            connectSocket();
            get().rejoinCurrentRoom();
          }
        }
      });
    }

    // Connect socket
    connectSocket();
  },

  async createRoom(playerName: string, customSettings?: Partial<RoomSettings>) {
    get().initSocket();
    const socket = connectSocket();

    const name = playerName.trim() || 'Host';

    return new Promise((resolve) => {
      socket.emit('createRoom', { playerName: name, settings: customSettings }, async (res) => {
        if (!res.success || !res.room || !res.playerId) {
          const err = res.error || 'Failed to create room.';
          set({ errorMessage: err });
          resolve({ success: false, error: err });
          return;
        }

        const room = res.room;
        const playerId = res.playerId;
        const reconnectToken = res.reconnectToken || null;

        set({
          isOnline: true,
          room,
          playerId,
          reconnectToken,
          playerName: name,
          gameState: null,
          selectedCard: null,
          validTargets: [],
          errorMessage: null,
        });

        // Save session to device for persistent reconnects
        if (reconnectToken) {
          await savePlayerRoomSession({
            roomCode: room.roomCode,
            playerId,
            reconnectToken,
            playerName: name,
            seat: 0,
            teamId: 'red',
            savedAt: Date.now(),
          });
        }

        resolve({ success: true, room });
      });
    });
  },

  async joinRoom(roomCode: string, playerName: string) {
    get().initSocket();
    const socket = connectSocket();

    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim() || 'Player';

    // Check if device has an existing reconnect token for this room
    const savedSession = await getPlayerRoomSession(code);
    const tokenToPass = savedSession?.reconnectToken;

    return new Promise((resolve) => {
      socket.emit(
        'joinRoom',
        { roomCode: code, playerName: name, reconnectToken: tokenToPass },
        async (res) => {
          if (!res.success || !res.room || !res.playerId) {
            const err = res.error || `Could not join room ${code}.`;
            set({ errorMessage: err });
            resolve({ success: false, error: err });
            return;
          }

          const room = res.room;
          const playerId = res.playerId;
          const reconnectToken = res.reconnectToken || tokenToPass || null;
          const playerObj = room.players.find((p) => p.id === playerId);

          set({
            isOnline: true,
            room,
            playerId,
            reconnectToken,
            playerName: name,
            gameState: null,
            selectedCard: null,
            validTargets: [],
            errorMessage: null,
          });

          // Save session to device
          if (reconnectToken) {
            await savePlayerRoomSession({
              roomCode: code,
              playerId,
              reconnectToken,
              playerName: name,
              seat: playerObj?.seat ?? 0,
              teamId: playerObj?.teamId,
              savedAt: Date.now(),
            });
          }

          resolve({ success: true, room });
        }
      );
    });
  },

  async setTeamCount(teamCount: 2 | 3) {
    const { room, playerId } = get();
    if (!room || !playerId) {
      return { success: false, error: 'Not in a room.' };
    }

    const socket = getSocket();
    return new Promise((resolve) => {
      socket.emit('setTeamCount', { roomCode: room.roomCode, playerId, teamCount }, (res) => {
        if (!res.success || !res.room) {
          const err = res.error || 'Failed to change team count.';
          set({ errorMessage: err });
          resolve({ success: false, error: err });
          return;
        }

        set({ room: res.room, errorMessage: null });
        resolve({ success: true });
      });
    });
  },

  async startGame() {
    const { room, playerId } = get();
    if (!room || !playerId) {
      return { success: false, error: 'Not in a room.' };
    }

    const socket = getSocket();
    return new Promise((resolve) => {
      socket.emit('startGame', { roomCode: room.roomCode, playerId }, (res) => {
        if (!res.success) {
          const err = res.error || 'Failed to start game.';
          set({ errorMessage: err });
          resolve({ success: false, error: err });
          return;
        }

        resolve({ success: true });
      });
    });
  },

  selectCard(cardId: string | null) {
    const { gameState, playerId } = get();
    if (!gameState || !cardId) {
      set({ selectedCard: null, validTargets: [] });
      return;
    }

    const card = gameState.hand.find((c) => c.id === cardId) ?? null;
    if (!card) {
      set({ selectedCard: null, validTargets: [] });
      return;
    }

    const me = gameState.players.find((p) => p.id === playerId);
    const myTeam = me?.teamId ?? 'red';
    const targets = calculateValidTargets(gameState.board, card, myTeam);

    set({
      selectedCard: card,
      validTargets: targets,
    });
  },

  async playMove(cell: [number, number], cardId?: string) {
    const { room, playerId, selectedCard } = get();
    if (!room || !playerId) {
      return { success: false, error: 'No active online match.' };
    }

    const targetCardId = cardId ?? selectedCard?.id;
    if (!targetCardId) {
      return { success: false, error: 'No card selected.' };
    }

    const socket = getSocket();
    return new Promise((resolve) => {
      socket.emit(
        'playMove',
        {
          roomCode: room.roomCode,
          playerId,
          cell,
          cardId: targetCardId,
        },
        (res) => {
          if (!res.success) {
            const err = res.error || 'Move was rejected by server.';
            set({ errorMessage: err });
            resolve({ success: false, error: err });
            return;
          }

          set({ selectedCard: null, validTargets: [], errorMessage: null });
          resolve({ success: true });
        }
      );
    });
  },

  async discardDeadCard(cardId: string) {
    const { room, playerId } = get();
    if (!room || !playerId) {
      return { success: false, error: 'No active online match.' };
    }

    const socket = getSocket();
    return new Promise((resolve) => {
      socket.emit(
        'discardDeadCard',
        {
          roomCode: room.roomCode,
          playerId,
          cardId,
        },
        (res) => {
          if (!res.success) {
            const err = res.error || 'Failed to discard card.';
            set({ errorMessage: err });
            resolve({ success: false, error: err });
            return;
          }

          set({ selectedCard: null, validTargets: [], errorMessage: null });
          resolve({ success: true });
        }
      );
    });
  },

  async rejoinCurrentRoom(): Promise<boolean> {
    const { room, playerId, reconnectToken } = get();
    if (!room) return false;

    const socket = connectSocket();
    const token = reconnectToken || playerId;
    if (!token) return false;

    return new Promise((resolve) => {
      socket.emit('rejoin', { roomCode: room.roomCode, reconnectToken: token }, (res) => {
        if (res.success && res.room) {
          set({
            status: 'connected',
            room: res.room,
            gameState: res.gameState ?? get().gameState,
            errorMessage: null,
          });
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  },

  async leaveRoom() {
    const { room, playerId } = get();
    if (room && playerId) {
      const socket = getSocket();
      socket.emit('leaveRoom', { roomCode: room.roomCode, playerId }, () => {});
      await clearPlayerRoomSession(room.roomCode);
    }
    get().resetOnlineState();
  },

  resetOnlineState() {
    set({
      isOnline: false,
      room: null,
      playerId: null,
      reconnectToken: null,
      gameState: null,
      selectedCard: null,
      validTargets: [],
      errorMessage: null,
    });
  },
}));
