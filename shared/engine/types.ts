// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Types
// Pure TypeScript, zero UI imports.
// ─────────────────────────────────────────────────────────────────────────────

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
  /** Unique id within the deck pool, e.g. "spades-J-0" */
  id: string;
}

export type JackType = 'two-eyed' | 'one-eyed';

export type TeamId = 'red' | 'blue' | 'green';

export type CellCard = Card | 'CORNER';

/** A single cell on the 10×10 board */
export interface Cell {
  row: number; // 0-9
  col: number; // 0-9
  card: Card | 'CORNER';
  chip: TeamId | null;
  locked: boolean;
}

/** Alias for Cell */
export type BoardCell = Cell;

export interface Player {
  id: string;
  name: string;
  team: TeamId;
  hand: Card[];
}

export type GamePhase =
  | 'lobby'     // waiting for players
  | 'playing'   // active gameplay
  | 'finished'; // game over

export interface SequenceLine {
  cells: [number, number][]; // [row, col] tuples
  team: TeamId;
}

export interface GameState {
  phase: GamePhase;
  board: Cell[][];             // [row][col]
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  sequences: SequenceLine[];   // all completed sequences so far
  sequencesNeeded: number;     // 1 (3 teams) or 2 (2 teams)
  winner: TeamId | null;
  teamSequenceCounts: Record<TeamId, number>;
  pendingDeadCardReplacement: boolean;
}

export type ActionType =
  | 'PLACE_CHIP'
  | 'REMOVE_CHIP'
  | 'REPLACE_DEAD_CARD'
  | 'START_GAME';

export interface PlaceChipAction {
  type: 'PLACE_CHIP';
  playerId: string;
  cardId: string;
  row: number;
  col: number;
}

export interface RemoveChipAction {
  type: 'REMOVE_CHIP';
  playerId: string;
  cardId: string;
  row: number;
  col: number;
}

export interface ReplaceDeadCardAction {
  type: 'REPLACE_DEAD_CARD';
  playerId: string;
  cardId: string;
}

export interface StartGameAction {
  type: 'START_GAME';
  players: { id: string; name: string; team: TeamId }[];
}

export type GameAction =
  | PlaceChipAction
  | RemoveChipAction
  | ReplaceDeadCardAction
  | StartGameAction;

export interface ActionResult {
  ok: boolean;
  error?: string;
  newState?: GameState;
  newSequences?: SequenceLine[];
  winner?: TeamId;
}
