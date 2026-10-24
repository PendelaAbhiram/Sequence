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
  GameIncrementalUpdate,
} from '../../shared/protocol';
import type { Card, TeamId } from '../engine/types';
import { isDeadCard } from '../engine/board';
import { isTwoEyedJack, isOneEyedJack } from '../engine/deck';
import {
  storage,
  savePlayerRoomSession,
  getPlayerRoomSession,
  clearPlayerRoomSession,
  PlayerRoomSession,
} from '../utils/storage';

export const LAST_ACTIVE_ROOM_KEY = 'sequence_last_active_room_code';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface OnlineStore {
  // ── Connection & Meta ─────────────────────────────────────────────────────
  status: ConnectionStatus;
  serverUrl: string;
  errorMessage: string | null;
  notificationMessage: string | null;
  clearNotification: () => void;

  // ── Session ───────────────────────────────────────────────────────────────
  isOnline: boolean;
  room: RoomState | null;
  playerId: string | null;
  reconnectToken: string | null;
  playerName: string;

  // ── Personalized Game State ───────────────────────────────────────────────
  gameState: PlayerGameState | null;
  stateVersion: number;
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
  retryConnection: () => void;
  resetOnlineState: () => void;
}


let socketInitialized = false;
let isRejoining = false;
let appStateSubscription: any = null;

/**
 * Merges newly received cards with current hand while preserving the exact
 * visual array order of existing cards. Newly drawn cards are appended to the end.
 */
export function mergeHandPreservingOrder(currentHand: Card[], incomingCards: Card[]): Card[] {
  if (!currentHand || currentHand.length === 0) {
    return incomingCards;
  }
  const incomingMap = new Map(incomingCards.map((c) => [c.id, c]));
  const preserved: Card[] = [];
  const keptIds = new Set<string>();

  // 1. Keep existing cards that are still in incomingCards (in identical relative order)
  for (const card of currentHand) {
    if (incomingMap.has(card.id)) {
      preserved.push(incomingMap.get(card.id)!);
      keptIds.add(card.id);
    }
  }

  // 2. Append newly drawn cards strictly at the end
  for (const card of incomingCards) {
    if (!keptIds.has(card.id)) {
      preserved.push(card);
    }
  }

  return preserved;
}


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
  notificationMessage: null,

  clearNotification() {
    set({ notificationMessage: null });
  },

  isOnline: false,
  room: null,
  playerId: null,
  reconnectToken: null,
  playerName: 'Player',

  gameState: null,
  stateVersion: 0,
  selectedCard: null,
  validTargets: [],

  clearError() {
    set({ errorMessage: null });
  },

  retryConnection() {
    set({ status: 'connecting', errorMessage: null });
    const socket = getSocket();
    socket.disconnect();
    socket.connect();
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

    socket.on('notification', ({ message }) => {
      set({ notificationMessage: message });
    });

    socket.on('gameStateUpdated', (newGameState) => {
      const { stateVersion, selectedCard, playerId, gameState: currentGameState } = get();

      // Drop stale or out-of-order state updates
      if (newGameState.version && newGameState.version <= stateVersion) {
        return;
      }

      const meInRoom = newGameState.players.find((p) => p.id === playerId);
      const myTeam = meInRoom?.teamId ?? 'red';

      // Stable hand order: retain existing visual slot order, append new cards at the end
      const currentHand = currentGameState?.hand ?? [];
      const stableHand = mergeHandPreservingOrder(currentHand, newGameState.hand);

      const stableGameState: PlayerGameState = {
        ...newGameState,
        hand: stableHand,
      };

      // Re-calculate valid targets if a card is currently selected
      let updatedTargets: [number, number][] = [];
      if (selectedCard && stableGameState.board) {
        const stillInHand = stableHand.find((c) => c.id === selectedCard.id);
        if (stillInHand) {
          updatedTargets = calculateValidTargets(stableGameState.board, stillInHand, myTeam);
        }
      }

      set({
        gameState: stableGameState,
        stateVersion: newGameState.version ?? (stateVersion + 1),
        selectedCard: updatedTargets.length > 0 ? selectedCard : null,
        validTargets: updatedTargets,
      });
    });

    socket.on('gameIncrementalUpdate', (update) => {
      const { stateVersion, gameState: currentGameState, playerId, selectedCard } = get();

      // Ignore stale updates
      if (update.version <= stateVersion) {
        return;
      }

      // If missing full state or version gap detected (e.g. packet loss), trigger full resync
      if (!currentGameState || update.version > stateVersion + 1) {
        get().rejoinCurrentRoom();
        return;
      }

      // Clone board
      const newBoard = currentGameState.board.map((row) => row.map((cell) => ({ ...cell })));

      // Apply cell change if present
      if (update.cell && update.lastMove) {
        const [r, c] = update.cell;
        if (update.lastMove.type === 'remove') {
          newBoard[r][c].chip = null;
        } else if (update.lastMove.teamId) {
          newBoard[r][c].chip = update.lastMove.teamId;
        }
      }


      // Update hand:
      // If playedCardId is present, ensure it is removed
      let newHand = currentGameState.hand;
      if (update.playedCardId && update.lastMove?.playerId === playerId) {
        newHand = newHand.filter((c) => c.id !== update.playedCardId);
      }
      // If drawnCard is provided for this player, append strictly at the end
      if (update.drawnCard && !newHand.some((c) => c.id === update.drawnCard!.id)) {
        newHand = [...newHand, update.drawnCard];
      }

      const meInRoom = currentGameState.players.find((p) => p.id === playerId);
      const myTeam = meInRoom?.teamId ?? 'red';

      const nextGameState: PlayerGameState = {
        ...currentGameState,
        version: update.version,
        board: newBoard,
        hand: newHand,
        currentPlayerIndex: update.currentPlayerIndex,
        turnPlayerId: update.turnPlayerId,
        sequenceCounts: update.sequenceCounts,
        sequencesNeeded: update.sequencesNeeded,
        completedSequences: update.completedSequences,
        lastMove: update.lastMove,
        winner: update.winner,
        drawPileCount: update.drawPileCount,
        reshuffleOccurred: update.reshuffleOccurred,
        phase: update.winner ? 'finished' : currentGameState.phase,
        isPaused: update.isPaused,
      };

      // Re-calculate targets if a card is selected
      let updatedTargets: [number, number][] = [];
      if (selectedCard) {
        const stillInHand = newHand.find((c) => c.id === selectedCard.id);
        if (stillInHand) {
          updatedTargets = calculateValidTargets(newBoard, stillInHand, myTeam);
        }
      }

      set({
        gameState: nextGameState,
        stateVersion: update.version,
        selectedCard: updatedTargets.length > 0 ? selectedCard : null,
        validTargets: updatedTargets,
      });
    });

    socket.on('heartbeat', () => {
      // Lightweight server heartbeat received: maintains active connection
    });

    socket.on('error', (err) => {
      set({ errorMessage: err.message });
    });

    const onForegroundOrOnline = async () => {
      const { isOnline, room, playerId, reconnectToken } = get();
      let currentRoomCode = room?.roomCode;
      let currentToken = reconnectToken || playerId;

      if (!currentRoomCode) {
        const lastCode = await storage.getItem(LAST_ACTIVE_ROOM_KEY);
        if (lastCode) {
          const session = await getPlayerRoomSession(lastCode);
          if (session && session.reconnectToken) {
            set({
              isOnline: true,
              playerId: session.playerId,
              reconnectToken: session.reconnectToken,
              playerName: session.playerName,
              room: { roomCode: session.roomCode } as any,
            });
            currentRoomCode = session.roomCode;
            currentToken = session.reconnectToken;
          }
        }
      }

      if (!currentRoomCode || !currentToken) return;

      const s = getSocket();
      if (!s.connected) {
        // If not connected, immediately connect and emit rejoin
        s.connect();
        get().rejoinCurrentRoom();
      } else {
        // If already connected, emit lightweight presence:active event
        s.emit('presence:active', {
          roomCode: currentRoomCode,
          playerId: playerId || currentToken,
        });
      }
    };

    // Auto-rejoin when the app returns to the foreground (React Native AppState)
    if (!appStateSubscription && typeof AppState !== 'undefined') {
      appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          onForegroundOrOnline();
        }
      });
    }

    // Web visibilitychange and online event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        onForegroundOrOnline();
      });
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            onForegroundOrOnline();
          }
        });
      }
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
          await storage.setItem(LAST_ACTIVE_ROOM_KEY, room.roomCode);
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
            await storage.setItem(LAST_ACTIVE_ROOM_KEY, code);
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
    const { room, playerId, selectedCard, gameState } = get();
    if (!room || !playerId) {
      return { success: false, error: 'No active online match.' };
    }

    const targetCardId = cardId ?? selectedCard?.id;
    if (!targetCardId) {
      return { success: false, error: 'No card selected.' };
    }

    const me = gameState?.players.find((p) => p.id === playerId);
    const myTeam = me?.teamId ?? 'red';

    // 1. Snapshot state for instant rollback if server rejects move
    const backupGameState = gameState;
    const backupSelectedCard = selectedCard;
    const backupTargets = get().validTargets;

    // 2. Optimistic UI: immediately place chip on client board and remove card from hand
    if (gameState) {
      const cardObj = gameState.hand.find((c) => c.id === targetCardId);
      const newBoard = gameState.board.map((row) => row.map((cellObj) => ({ ...cellObj })));
      const [r, c] = cell;
      if (cardObj) {
        if (isOneEyedJack(cardObj)) {
          newBoard[r][c].chip = null;
        } else {
          newBoard[r][c].chip = myTeam;
        }
      }
      const newHand = gameState.hand.filter((c) => c.id !== targetCardId);

      set({
        gameState: {
          ...gameState,
          board: newBoard,
          hand: newHand,
        },
        selectedCard: null,
        validTargets: [],
        errorMessage: null,
      });
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
            // Rejection: roll back optimistic update cleanly
            const err = res.error || 'Move was rejected by server.';
            set({
              gameState: backupGameState,
              selectedCard: backupSelectedCard,
              validTargets: backupTargets,
              errorMessage: err,
            });
            resolve({ success: false, error: err });
            return;
          }

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
    if (isRejoining) return false;
    const { isOnline, room, playerId, reconnectToken } = get();
    if (!isOnline || !room) return false;

    const socket = connectSocket();
    const token = reconnectToken || playerId;
    if (!token) return false;

    isRejoining = true;
    return new Promise((resolve) => {
      socket.emit('rejoin', { roomCode: room.roomCode, reconnectToken: token }, (res) => {
        isRejoining = false;
        if (res.success && res.room) {
          let mergedGameState = get().gameState;
          let version = get().stateVersion;
          if (res.gameState) {
            // Requirement 4: Replace local state with server full state using state version
            // so stale updates (version <= current version) are ignored
            if (res.gameState.version === undefined || res.gameState.version >= version) {
              const currentHand = get().gameState?.hand ?? [];
              const stableHand = mergeHandPreservingOrder(currentHand, res.gameState.hand);
              mergedGameState = {
                ...res.gameState,
                hand: stableHand,
              };
              version = res.gameState.version ?? version;
            }
          }
          set({
            status: 'connected',
            room: res.room,
            gameState: mergedGameState,
            stateVersion: version,
            errorMessage: null,
          });
          resolve(true);
        } else {
          // Requirement 5: If room doesn't exist anymore on server (e.g. server restart/spin-down)
          if (
            res.error?.includes('does not exist') ||
            res.error?.includes('closed') ||
            res.error?.includes('not recognized')
          ) {
            storage.removeItem(LAST_ACTIVE_ROOM_KEY);
            if (room?.roomCode) {
              clearPlayerRoomSession(room.roomCode);
            }
            set({
              status: 'disconnected',
              errorMessage: 'Match has ended or server restarted.',
            });
          }
          resolve(false);
        }
      });
    });
  },

  async leaveRoom() {
    const { room, playerId } = get();
    const code = room?.roomCode?.trim().toUpperCase();
    const pid = playerId;

    // 1. Immediately clear saved room code and reconnect token from AsyncStorage
    if (code) {
      try {
        await clearPlayerRoomSession(code);
      } catch (e) {
        console.warn('Error clearing room session:', e);
      }
    }
    try {
      await storage.removeItem(LAST_ACTIVE_ROOM_KEY);
    } catch (e) {
      console.warn('Error removing active room key:', e);
    }

    // 2. Emit leaveRoom to server in background with a 3-second fallback
    if (code && pid) {
      try {
        const socket = getSocket();
        if (socket && socket.connected) {
          let timer: any = null;
          timer = setTimeout(() => {
            timer = null;
          }, 3000);
          if (timer && typeof timer.unref === 'function') timer.unref();
          socket.emit('leaveRoom', { roomCode: code, playerId: pid }, () => {
            if (timer) clearTimeout(timer);
          });
        } else if (socket) {
          // Socket is currently disconnected: wait up to 3s fallback
          let timer: any = null;
          const onConnect = () => {
            if (timer) clearTimeout(timer);
            socket.emit('leaveRoom', { roomCode: code, playerId: pid }, () => {});
          };
          timer = setTimeout(() => {
            socket.off('connect', onConnect);
          }, 3000);
          if (timer && typeof timer.unref === 'function') timer.unref();
          socket.once('connect', onConnect);
        }
      } catch (e) {
        console.warn('Error emitting leaveRoom:', e);
      }
    }

    // 3. Reset online store (socket listeners, room state, hand)
    get().resetOnlineState();
  },

  resetOnlineState() {
    try {
      const socket = getSocket();
      socket.off('roomUpdated');
      socket.off('gameStateUpdated');
      socket.off('gameIncrementalUpdate');
      socket.off('notification');
      socket.off('error');
    } catch {}
    socketInitialized = false;

    set({
      isOnline: false,
      room: null,
      playerId: null,
      reconnectToken: null,
      gameState: null,
      stateVersion: 0,
      selectedCard: null,
      validTargets: [],
      errorMessage: null,
      notificationMessage: null,
    });
  },

}));
