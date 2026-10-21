// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Board
// Pure TypeScript, zero UI imports.
// ─────────────────────────────────────────────────────────────────────────────

import type { Cell, Card, Suit, Rank } from './types';
import rawLayout from './boardLayout.json';

export type RawBoardCell = { rank: Rank; suit: Suit } | 'CORNER';
export type RawBoardLayout = RawBoardCell[][];

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const NON_JACK_RANKS: Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Q', 'K', 'A',
];

export interface BoardValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that a 10×10 board layout has:
 * 1. Exactly 10 rows and 10 columns.
 * 2. Exactly 4 "CORNER" cells at [0,0], [0,9], [9,0], and [9,9].
 * 3. Exactly 96 card cells (no Jacks).
 * 4. Every non-Jack card appears exactly twice.
 */
export function validateBoardLayout(layout: unknown): BoardValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(layout) || layout.length !== 10) {
    errors.push(`Layout must have exactly 10 rows. Found: ${Array.isArray(layout) ? layout.length : 'not an array'}`);
    return { valid: false, errors };
  }

  const cornerPositions: [number, number][] = [
    [0, 0],
    [0, 9],
    [9, 0],
    [9, 9],
  ];

  const cardCounts = new Map<string, number>();
  let totalCorners = 0;
  let totalCards = 0;

  for (let r = 0; r < 10; r++) {
    const row = layout[r];
    if (!Array.isArray(row) || row.length !== 10) {
      errors.push(`Row ${r} must have exactly 10 columns.`);
      continue;
    }

    for (let c = 0; c < 10; c++) {
      const cell = row[c] as RawBoardCell;
      const isCornerPos = cornerPositions.some(([cr, cc]) => cr === r && cc === c);

      if (cell === 'CORNER') {
        totalCorners++;
        if (!isCornerPos) {
          errors.push(`Unexpected CORNER at [${r}, ${c}]. Corners must only be at the 4 grid corners.`);
        }
      } else if (cell && typeof cell === 'object' && 'rank' in cell && 'suit' in cell) {
        totalCards++;
        if (isCornerPos) {
          errors.push(`Expected CORNER at [${r}, ${c}], but found card ${cell.rank} of ${cell.suit}.`);
        }

        if ((cell.rank as string) === 'J') {
          errors.push(`Invalid Jack found on board at [${r}, ${c}]: ${cell.rank} of ${cell.suit}. Jacks cannot appear on the board.`);
        }

        const key = `${cell.suit}-${cell.rank}`;
        cardCounts.set(key, (cardCounts.get(key) ?? 0) + 1);
      } else {
        errors.push(`Invalid cell format at [${r}, ${c}]: ${JSON.stringify(cell)}`);
      }
    }
  }

  if (totalCorners !== 4) {
    errors.push(`Board must contain exactly 4 corners. Found: ${totalCorners}`);
  }

  if (totalCards !== 96) {
    errors.push(`Board must contain exactly 96 cards. Found: ${totalCards}`);
  }

  // Check that every non-Jack card appears exactly twice
  for (const suit of SUITS) {
    for (const rank of NON_JACK_RANKS) {
      const key = `${suit}-${rank}`;
      const count = cardCounts.get(key) ?? 0;
      if (count !== 2) {
        errors.push(`Card ${rank} of ${suit} must appear exactly 2 times, but appeared ${count} times.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a fresh 10×10 board populated from layout JSON.
 */
export function createBoard(customLayout?: RawBoardLayout): Cell[][] {
  const layout = customLayout ?? (rawLayout as RawBoardLayout);
  const board: Cell[][] = [];
  const cardIndexMap = new Map<string, number>();

  for (let r = 0; r < 10; r++) {
    board[r] = [];
    for (let c = 0; c < 10; c++) {
      const def = layout[r][c];
      if (def === 'CORNER') {
        board[r][c] = {
          row: r,
          col: c,
          card: 'CORNER',
          chip: null,
          locked: true,
        };
      } else {
        const key = `${def.suit}-${def.rank}`;
        const idx = cardIndexMap.get(key) ?? 0;
        cardIndexMap.set(key, idx + 1);

        board[r][c] = {
          row: r,
          col: c,
          card: {
            suit: def.suit,
            rank: def.rank,
            id: `board-${def.suit}-${def.rank}-${idx}`,
          },
          chip: null,
          locked: false,
        };
      }
    }
  }

  return board;
}

/** Alias for createBoard */
export const createInitialBoard = createBoard;

/**
 * Returns the matching cells for a card on the board (2 cells for any standard non-Jack card).
 * Supports both getCellsForCard(card, board?) and getCellsForCard(board, card).
 */
export function getCellsForCard(
  arg1: Cell[][] | Card | { rank: Rank; suit: Suit },
  arg2?: Cell[][] | Card | { rank: Rank; suit: Suit }
): Cell[] {
  let board: Cell[][];
  let target: { rank: Rank; suit: Suit };

  if (Array.isArray(arg1)) {
    board = arg1;
    target = arg2 as { rank: Rank; suit: Suit };
  } else {
    target = arg1 as { rank: Rank; suit: Suit };
    board = (Array.isArray(arg2) ? arg2 : undefined) ?? createBoard();
  }

  if (!target || target.rank === 'J') {
    return [];
  }

  const matching: Cell[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = board[r][c];
      if (cell.card !== 'CORNER' && cell.card.suit === target.suit && cell.card.rank === target.rank) {
        matching.push(cell);
      }
    }
  }

  return matching;
}

/**
 * Finds all [row, col] positions on the board for a given suit and rank.
 */
export function findCellsForCard(
  board: Cell[][],
  suit: Suit,
  rank: Rank
): [number, number][] {
  const cells = getCellsForCard(board, { suit, rank });
  return cells.map((c) => [c.row, c.col]);
}

/**
 * A card is dead when both of its matching board positions are occupied by chips.
 * Jacks are never dead.
 */
export function isDeadCard(board: Cell[][], card: Card): boolean {
  if (card.rank === 'J') return false;
  const matchingCells = getCellsForCard(board, card);
  if (matchingCells.length === 0) return false;
  return matchingCells.every((cell) => cell.chip !== null);
}
