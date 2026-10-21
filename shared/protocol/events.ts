// ─────────────────────────────────────────────────────────────────────────────
// Shared Protocol – Socket.io Event Definitions & Message Payloads
// Pure TypeScript, shared by App and Server.
// ─────────────────────────────────────────────────────────────────────────────

import type { RoomState, RoomSettings, PlayerGameState } from './room';

// ── Client-to-Server Event Payloads ─────────────────────────────────────────

export interface CreateRoomPayload {
  playerName: string;
  settings?: Partial<RoomSettings>;
}

export interface CreateRoomResponse {
  success: boolean;
  room?: RoomState;
  playerId?: string;
  reconnectToken?: string;
  error?: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
  reconnectToken?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  room?: RoomState;
  playerId?: string;
  reconnectToken?: string;
  error?: string;
}

export interface StartGamePayload {
  roomCode: string;
  playerId: string;
}

export interface StartGameResponse {
  success: boolean;
  error?: string;
}

export interface PlayMovePayload {
  roomCode: string;
  playerId: string;
  cell: [number, number];
  cardId: string;
}

export interface PlayMoveResponse {
  success: boolean;
  error?: string;
}

export interface DiscardDeadCardPayload {
  roomCode: string;
  playerId: string;
  cardId: string;
}

export interface DiscardDeadCardResponse {
  success: boolean;
  error?: string;
}

export interface RejoinPayload {
  roomCode: string;
  playerId?: string;
  reconnectToken?: string;
}

export interface RejoinResponse {
  success: boolean;
  room?: RoomState;
  gameState?: PlayerGameState;
  playerId?: string;
  reconnectToken?: string;
  error?: string;
}

export interface SetTeamCountPayload {
  roomCode: string;
  playerId: string;
  teamCount: 2 | 3;
}

export interface SetTeamCountResponse {
  success: boolean;
  room?: RoomState;
  error?: string;
}

export interface LeaveRoomPayload {
  roomCode: string;
  playerId: string;
}

export interface LeaveRoomResponse {
  success: boolean;
  error?: string;
}

// ── Server-to-Client Event Payloads ─────────────────────────────────────────

export type RoomUpdatedPayload = RoomState;

export type GameStateUpdatedPayload = PlayerGameState;

export interface ErrorPayload {
  message: string;
  code?: string;
}

// ── Typed Socket.io Event Interfaces ────────────────────────────────────────

/**
 * Events emitted by Client -> received by Server
 */
export interface ClientToServerEvents {
  createRoom: (
    payload: CreateRoomPayload,
    callback: (res: CreateRoomResponse) => void
  ) => void;
  joinRoom: (
    payload: JoinRoomPayload,
    callback: (res: JoinRoomResponse) => void
  ) => void;
  setTeamCount: (
    payload: SetTeamCountPayload,
    callback: (res: SetTeamCountResponse) => void
  ) => void;
  startGame: (
    payload: StartGamePayload,
    callback: (res: StartGameResponse) => void
  ) => void;
  playMove: (
    payload: PlayMovePayload,
    callback: (res: PlayMoveResponse) => void
  ) => void;
  discardDeadCard: (
    payload: DiscardDeadCardPayload,
    callback: (res: DiscardDeadCardResponse) => void
  ) => void;
  rejoin: (
    payload: RejoinPayload,
    callback: (res: RejoinResponse) => void
  ) => void;
  leaveRoom: (
    payload: LeaveRoomPayload,
    callback: (res: LeaveRoomResponse) => void
  ) => void;
}

/**
 * Events emitted by Server -> received by Client
 */
export interface ServerToClientEvents {
  roomUpdated: (room: RoomUpdatedPayload) => void;
  gameStateUpdated: (gameState: GameStateUpdatedPayload) => void;
  error: (err: ErrorPayload) => void;
}

/**
 * Socket data attached to each connected socket instance on the server
 */
export interface SocketData {
  playerId?: string;
  roomCode?: string;
}

