// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Sequence Detection
// Pure TypeScript, zero UI imports.
// ─────────────────────────────────────────────────────────────────────────────

import type { Cell, TeamId, SequenceLine } from './types';

export type DirectionType =
  | 'horizontal'
  | 'vertical'
  | 'diagonal-down-right'
  | 'diagonal-down-left';

export interface Sequence {
  team: TeamId;
  cells: [number, number][]; // Exactly 5 [row, col] coordinates
  direction: DirectionType;
}

export interface WinnerResult {
  winner: TeamId | null;
  teamSequences: Record<TeamId, Sequence[]>;
  requiredCount: number;
}

interface DirectionVector {
  dr: number;
  dc: number;
  name: DirectionType;
}

const DIRECTIONS: DirectionVector[] = [
  { dr: 0, dc: 1, name: 'horizontal' },           // →
  { dr: 1, dc: 0, name: 'vertical' },             // ↓
  { dr: 1, dc: 1, name: 'diagonal-down-right' },  // ↘
  { dr: 1, dc: -1, name: 'diagonal-down-left' },  // ↙
];

/**
 * Returns true if the cell is one of the 4 board corners.
 * Corners are permanently wild and count for all teams.
 */
export function isCorner(cell: Cell): boolean {
  if (cell.card === 'CORNER') return true;
  return (
    (cell.row === 0 || cell.row === 9) &&
    (cell.col === 0 || cell.col === 9)
  );
}

/**
 * Returns true if the cell counts toward a sequence for `team`:
 * - It is a corner cell (wild for any team), OR
 * - It has a chip placed belonging to `team`.
 */
export function countsForTeam(cell: Cell, team: TeamId): boolean {
  return isCorner(cell) || cell.chip === team;
}

/**
 * Counts how many actual chips (excluding neutral corner cells) are shared between two sequences.
 */
export function countSharedChips(s1: Sequence, s2: Sequence, board: Cell[][]): number {
  let shared = 0;
  for (const [r1, c1] of s1.cells) {
    if (isCorner(board[r1][c1])) continue; // corners are not chips
    for (const [r2, c2] of s2.cells) {
      if (r1 === r2 && c1 === c2) {
        shared++;
      }
    }
  }
  return shared;
}

/**
 * Finds all valid 5-in-a-row sequences for a given team on the board.
 *
 * Rules:
 * - A sequence consists of exactly 5 in a row (horizontal, vertical, or diagonal).
 * - The 4 corners count as that team's chip.
 * - Two sequences of the same team may share at most ONE chip.
 * - A straight run of 6+ chips does NOT count as two sequences.
 * - Returns detailed cell coordinates for UI animation.
 */
export function findSequences(board: Cell[][], teamId: TeamId): Sequence[] {
  const candidates: Sequence[] = [];

  // Step 1: Find all potential 5-in-a-row lines
  for (const { dr, dc, name } of DIRECTIONS) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        // Check if 5 cells can fit starting at (r, c)
        const endR = r + dr * 4;
        const endC = c + dc * 4;
        if (endR < 0 || endR > 9 || endC < 0 || endC > 9) continue;

        const cells: [number, number][] = [];
        let valid = true;

        for (let step = 0; step < 5; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          const cell = board[nr][nc];
          if (!countsForTeam(cell, teamId)) {
            valid = false;
            break;
          }
          cells.push([nr, nc]);
        }

        if (valid && cells.length === 5) {
          candidates.push({
            team: teamId,
            cells,
            direction: name,
          });
        }
      }
    }
  }

  if (candidates.length <= 1) {
    return candidates;
  }

  // Step 2: Select the maximum number of mutually compatible sequences
  // where any two sequences of the same team share at most ONE chip.
  return selectMaxCompatibleSequences(candidates, board);
}

/**
 * Backtracking search to find the maximum set of sequences that satisfy the
 * rule: every pair of sequences of the same team shares at most 1 chip.
 */
function selectMaxCompatibleSequences(candidates: Sequence[], board: Cell[][]): Sequence[] {
  let bestSubset: Sequence[] = [];

  function backtrack(index: number, current: Sequence[]) {
    // Prune if even selecting all remaining candidates cannot beat bestSubset
    if (current.length + (candidates.length - index) <= bestSubset.length) {
      return;
    }

    if (index === candidates.length) {
      if (current.length > bestSubset.length) {
        bestSubset = [...current];
      }
      return;
    }

    const nextCand = candidates[index];

    // Check if nextCand is compatible with all sequences in current
    const compatible = current.every(
      (existing) => countSharedChips(existing, nextCand, board) <= 1
    );

    if (compatible) {
      current.push(nextCand);
      backtrack(index + 1, current);
      current.pop();
    }

    // Branch without nextCand
    backtrack(index + 1, current);
  }

  backtrack(0, []);
  return bestSubset;
}

/**
 * Marks cells in completed sequences as locked.
 * Corners are never locked or consumed.
 * Returns a new board copy.
 */
export function lockSequenceCells(
  board: Cell[][],
  sequences: (Sequence | SequenceLine)[]
): Cell[][] {
  const next = board.map((row) => row.map((cell) => ({ ...cell })));

  for (const seq of sequences) {
    for (const [r, c] of seq.cells) {
      const cell = next[r][c];
      if (isCorner(cell)) {
        cell.locked = false; // Corners are never locked
      } else if (cell.chip !== null) {
        cell.locked = true;
      }
    }
  }

  return next;
}

/**
 * Hand size and victory sequence thresholds:
 * - 2 teams need 2 sequences to win.
 * - 3 teams need 1 sequence to win.
 */
export function requiredSequences(teamCount: number): number {
  if (teamCount === 2) return 2;
  if (teamCount === 3) return 1;
  throw new Error(`Invalid team count: ${teamCount}. Allowed: 2 or 3 teams.`);
}

/**
 * Checks all teams and returns the winning team if required sequence count is met.
 */
export function checkWinner(
  board: Cell[][],
  teams: TeamId[]
): WinnerResult {
  const req = requiredSequences(teams.length);
  const teamSequences = {} as Record<TeamId, Sequence[]>;
  let winner: TeamId | null = null;

  for (const team of teams) {
    const seqs = findSequences(board, team);
    teamSequences[team] = seqs;
    if (seqs.length >= req && winner === null) {
      winner = team;
    }
  }

  return {
    winner,
    teamSequences,
    requiredCount: req,
  };
}

/**
 * Incremental sequence finder for the game reducer:
 * Finds any new sequences formed by `team` that are not already in `existing`.
 */
export function findNewSequences(
  board: Cell[][],
  team: TeamId,
  existing: SequenceLine[]
): Sequence[] {
  const currentSequences = findSequences(board, team);
  const existingKeys = new Set(existing.map((s) => canonicalSeqKey(s.cells)));

  return currentSequences.filter(
    (seq) => !existingKeys.has(canonicalSeqKey(seq.cells))
  );
}

/**
 * Helper to check victory based on counts map.
 */
export function checkWin(
  teamSequenceCounts: Record<TeamId, number>,
  sequencesNeeded: number
): TeamId | null {
  for (const [team, count] of Object.entries(teamSequenceCounts) as [TeamId, number][]) {
    if (count >= sequencesNeeded) return team;
  }
  return null;
}

function canonicalSeqKey(cells: [number, number][]): string {
  return cells
    .map(([r, c]) => `${r},${c}`)
    .sort()
    .join('|');
}
