// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Core Reducer
// Pure TypeScript, zero UI imports.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GameState,
  GameAction,
  ActionResult,
  BoardCell,
  Player,
  TeamId,
  Card,
  SequenceLine,
} from './types';
import { createInitialBoard, findCellsForCard, isDeadCard } from './board';
import {
  buildDrawPile,
  shuffle,
  handSizeForPlayerCount,
  isTwoEyedJack,
  isOneEyedJack,
  isJack,
  VALID_PLAYER_COUNTS,
} from './cards';
import { findNewSequences, lockSequenceCells, checkWin } from './sequences';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cloneBoard(board: BoardCell[][]): BoardCell[][] {
  return board.map(row => row.map(cell => ({ ...cell })));
}

function clonePlayers(players: Player[]): Player[] {
  return players.map(p => ({ ...p, hand: [...p.hand] }));
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    board: cloneBoard(state.board),
    players: clonePlayers(state.players),
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    sequences: state.sequences.map(s => ({ ...s, cells: [...s.cells] as [number,number][] })),
    teamSequenceCounts: { ...state.teamSequenceCounts },
  };
}

function drawCard(state: GameState): { card: Card | null; state: GameState } {
  if (state.drawPile.length === 0) {
    if (state.discardPile.length === 0) return { card: null, state };
    // Reshuffle discard into draw
    state.drawPile = shuffle([...state.discardPile]);
    state.discardPile = [];
  }
  const card = state.drawPile.pop()!;
  return { card, state };
}

function advanceTurn(state: GameState): GameState {
  state.currentPlayerIndex =
    (state.currentPlayerIndex + 1) % state.players.length;
  return state;
}

function err(msg: string): ActionResult {
  return { ok: false, error: msg };
}

// ─── START_GAME ───────────────────────────────────────────────────────────────

function handleStartGame(
  action: Extract<GameAction, { type: 'START_GAME' }>
): ActionResult {
  const count = action.players.length;
  if (!(VALID_PLAYER_COUNTS as readonly number[]).includes(count)) {
    return err(`Invalid player count ${count}. Allowed: ${VALID_PLAYER_COUNTS.join(', ')}`);
  }

  const teams = [...new Set(action.players.map(p => p.team))];
  if (teams.length < 2 || teams.length > 3) {
    return err('Need exactly 2 or 3 teams.');
  }

  // Validate team distribution – players per team must be equal
  const teamCounts = teams.map(t => action.players.filter(p => p.team === t).length);
  if (!teamCounts.every(c => c === teamCounts[0])) {
    return err('All teams must have the same number of players.');
  }

  const handSize = handSizeForPlayerCount(count);
  const drawPile = shuffle(buildDrawPile());
  const board = createInitialBoard();

  const players: Player[] = action.players.map(p => ({
    id: p.id,
    name: p.name,
    team: p.team,
    hand: [],
  }));

  // Deal hands
  let pile = [...drawPile];
  for (const player of players) {
    for (let i = 0; i < handSize; i++) {
      const card = pile.pop();
      if (card) player.hand.push(card);
    }
  }

  const teamSequenceCounts: Record<TeamId, number> = { red: 0, blue: 0, green: 0 };
  const sequencesNeeded = teams.length === 3 ? 1 : 2;

  const newState: GameState = {
    phase: 'playing',
    board,
    players,
    currentPlayerIndex: 0,
    drawPile: pile,
    discardPile: [],
    sequences: [],
    sequencesNeeded,
    winner: null,
    teamSequenceCounts,
    pendingDeadCardReplacement: false,
  };

  return { ok: true, newState };
}

// ─── REPLACE_DEAD_CARD ────────────────────────────────────────────────────────

function handleReplaceDeadCard(
  state: GameState,
  action: Extract<GameAction, { type: 'REPLACE_DEAD_CARD' }>
): ActionResult {
  const next = cloneState(state);
  const player = next.players[next.currentPlayerIndex];

  if (player.id !== action.playerId) {
    return err('Not your turn.');
  }

  const cardIdx = player.hand.findIndex(c => c.id === action.cardId);
  if (cardIdx === -1) return err('Card not in hand.');

  const card = player.hand[cardIdx];
  if (!isDeadCard(next.board, card)) {
    return err('That card is not a dead card.');
  }

  // Discard the dead card
  player.hand.splice(cardIdx, 1);
  next.discardPile.push(card);

  // Draw a replacement
  const { card: drawn, state: afterDraw } = drawCard(next);
  if (drawn) player.hand.push(drawn);
  Object.assign(next, afterDraw);

  // pendingDeadCardReplacement stays true so the player must still take their turn.
  // The flag is cleared after a normal turn action.
  next.pendingDeadCardReplacement = false;

  return { ok: true, newState: next };
}

// ─── PLACE_CHIP ───────────────────────────────────────────────────────────────

function handlePlaceChip(
  state: GameState,
  action: Extract<GameAction, { type: 'PLACE_CHIP' }>
): ActionResult {
  if (state.phase !== 'playing') return err('Game is not in progress.');

  const next = cloneState(state);
  const player = next.players[next.currentPlayerIndex];

  if (player.id !== action.playerId) return err('Not your turn.');

  const { row, col } = action;
  if (row < 0 || row > 9 || col < 0 || col > 9) return err('Cell out of bounds.');

  const cell = next.board[row][col];

  // Free corners are occupied from game start (locked, no card)
  if (cell.card === 'CORNER' || cell.card === null) return err('Cannot place on a free corner.');
  if (cell.chip !== null) return err('Cell already occupied.');

  const cardIdx = player.hand.findIndex(c => c.id === action.cardId);
  if (cardIdx === -1) return err('Card not in hand.');

  const card = player.hand[cardIdx];

  if (isTwoEyedJack(card)) {
    // Wild – can go anywhere empty
  } else {
    // Must match the cell's card
    if (card.suit !== cell.card.suit || card.rank !== cell.card.rank) {
      return err('Card does not match cell.');
    }
  }

  // Place chip
  cell.chip = player.team;

  // Play card from hand → discard
  player.hand.splice(cardIdx, 1);
  next.discardPile.push(card);

  // Draw replacement
  const { card: drawn, state: afterDraw } = drawCard(next);
  if (drawn) player.hand.push(drawn);
  Object.assign(next, afterDraw);

  // Check for new sequences
  const newSeqs = findNewSequences(next.board, player.team, next.sequences);
  let winner: TeamId | null = null;

  if (newSeqs.length > 0) {
    next.board = lockSequenceCells(next.board, newSeqs);
    next.sequences = [...next.sequences, ...newSeqs];
    next.teamSequenceCounts[player.team] += newSeqs.length;
    winner = checkWin(next.teamSequenceCounts, next.sequencesNeeded);
    if (winner) {
      next.winner = winner;
      next.phase = 'finished';
    }
  }

  if (!winner) advanceTurn(next);

  return { ok: true, newState: next, newSequences: newSeqs, winner: winner ?? undefined };
}

// ─── REMOVE_CHIP ─────────────────────────────────────────────────────────────

function handleRemoveChip(
  state: GameState,
  action: Extract<GameAction, { type: 'REMOVE_CHIP' }>
): ActionResult {
  if (state.phase !== 'playing') return err('Game is not in progress.');

  const next = cloneState(state);
  const player = next.players[next.currentPlayerIndex];

  if (player.id !== action.playerId) return err('Not your turn.');

  const { row, col } = action;
  if (row < 0 || row > 9 || col < 0 || col > 9) return err('Cell out of bounds.');

  const cell = next.board[row][col];

  if (cell.card === 'CORNER' || cell.card === null) return err('Cannot target a free corner.');
  if (cell.chip === null) return err('No chip to remove.');
  if (cell.chip === player.team) return err('Cannot remove your own chip.');
  if (cell.locked) return err('Cannot remove a chip in a completed sequence.');

  const cardIdx = player.hand.findIndex(c => c.id === action.cardId);
  if (cardIdx === -1) return err('Card not in hand.');

  const card = player.hand[cardIdx];
  if (!isOneEyedJack(card)) return err('Only a one-eyed Jack can remove a chip.');

  // Remove chip
  cell.chip = null;

  // Play card → discard
  player.hand.splice(cardIdx, 1);
  next.discardPile.push(card);

  // Draw replacement
  const { card: drawn, state: afterDraw } = drawCard(next);
  if (drawn) player.hand.push(drawn);
  Object.assign(next, afterDraw);

  advanceTurn(next);

  return { ok: true, newState: next };
}

// ─── Main Reducer ─────────────────────────────────────────────────────────────

export function gameReducer(
  state: GameState | null,
  action: GameAction
): ActionResult {
  switch (action.type) {
    case 'START_GAME':
      return handleStartGame(action);

    case 'REPLACE_DEAD_CARD':
      if (!state) return err('No game in progress.');
      return handleReplaceDeadCard(state, action);

    case 'PLACE_CHIP':
      if (!state) return err('No game in progress.');
      return handlePlaceChip(state, action);

    case 'REMOVE_CHIP':
      if (!state) return err('No game in progress.');
      return handleRemoveChip(state, action);

    default:
      return err('Unknown action.');
  }
}

// ─── Utility selectors (pure, read-only) ─────────────────────────────────────

/** Returns the current player. */
export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

/**
 * Which cells a card in hand could legally target.
 * Returns [] if the card has no valid moves (dead card scenario excluded here –
 * callers should check `isDeadCard` first).
 */
export function validTargetsForCard(
  state: GameState,
  card: Card
): [number, number][] {
  const board = state.board;

  if (isTwoEyedJack(card)) {
    // Any unoccupied non-corner cell
    const targets: [number, number][] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        if (cell.card !== 'CORNER' && cell.card !== null && cell.chip === null) targets.push([r, c]);
      }
    }
    return targets;
  }

  if (isOneEyedJack(card)) {
    // Any opponent chip that is NOT locked
    const cp = currentPlayer(state);
    const targets: [number, number][] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        if (
          cell.chip !== null &&
          cell.chip !== cp.team &&
          !cell.locked
        ) {
          targets.push([r, c]);
        }
      }
    }
    return targets;
  }

  // Normal card – find matching cells that are unoccupied
  return findCellsForCard(board, card.suit, card.rank).filter(
    ([r, c]) => board[r][c].chip === null
  );
}

/** Returns all dead cards in the current player's hand. */
export function deadCardsInHand(state: GameState): Card[] {
  const player = currentPlayer(state);
  return player.hand.filter(c => isDeadCard(state.board, c));
}
