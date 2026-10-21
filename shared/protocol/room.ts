// ─────────────────────────────────────────────────────────────────────────────
// Shared Protocol – Room & Multiplayer State Definitions
// Pure TypeScript, shared by App and Server.
// ─────────────────────────────────────────────────────────────────────────────

import type { TeamId, Cell, Card, Sequence, LastMove } from '../engine';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomSettings {
  teamCount: 2 | 3;
  maxPlayers: number; // 2, 3, 4, 6, 8, 9, 10, or 12
  turnTimeoutSeconds?: number; // 0 or undefined = unlimited
}

export interface RoomPlayer {
  id: string; // Unique persistent player UUID
  socketId: string; // Transient socket connection ID
  name: string;
  teamId: TeamId;
  seat: number;
  isHost: boolean;
  isConnected: boolean;
  isBotControlled?: boolean;
  reconnectToken?: string; // Private secret token for re-authentication
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  settings: RoomSettings;
  createdAt: number;
}

/**
 * Player-specific view of the game state.
 * Crucial for fairness: a player only receives their own cards in `hand`,
 * while opponents' hands are masked to their `cardCount`.
 */
export interface PlayerSummary {
  id: string;
  name: string;
  teamId: TeamId;
  seat: number;
  cardCount: number;
  discardPile?: Card[]; // Public face-up discard pile for this player
  discardPileCount: number;
  isConnected: boolean;
  isBotControlled?: boolean;
}

export interface PlayerGameState {
  roomCode: string;
  phase: 'playing' | 'finished';
  board: Cell[][];
  currentPlayerIndex: number;
  turnPlayerId: string;
  hand: Card[]; // Secret cards for THIS player only
  players: PlayerSummary[];
  discardPiles: Record<string, Card[]>; // All public discard piles keyed by playerId
  sequenceCounts: Record<TeamId, number>;
  sequencesNeeded: number;
  completedSequences: Sequence[];
  lastMove: LastMove | null;
  winner: TeamId | null;
  drawPileCount: number; // Count only - draw pile array is never exposed
  reshuffleOccurred?: boolean;
  dealerIndex?: number;
  cutCards?: Card[];
  isPaused?: boolean;
}
