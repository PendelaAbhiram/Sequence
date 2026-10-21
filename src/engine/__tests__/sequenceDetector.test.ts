// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Sequence Detector Tests (Jest)
// ─────────────────────────────────────────────────────────────────────────────

import { createBoard } from '../board';
import {
  findSequences,
  lockSequenceCells,
  requiredSequences,
  checkWinner,
  isCorner,
} from '../sequenceDetector';
import type { Cell, TeamId } from '../types';

function createEmptyTestBoard(): Cell[][] {
  return createBoard();
}

describe('Sequence Detector – Directional Detection', () => {
  test('detects a horizontal sequence (→)', () => {
    const board = createEmptyTestBoard();
    // Place 5 red chips horizontally on row 3, cols 1..5
    for (let c = 1; c <= 5; c++) {
      board[3][c].chip = 'red';
    }

    const seqs = findSequences(board, 'red');
    expect(seqs).toHaveLength(1);
    expect(seqs[0].direction).toBe('horizontal');
    expect(seqs[0].team).toBe('red');
    expect(seqs[0].cells).toEqual([
      [3, 1],
      [3, 2],
      [3, 3],
      [3, 4],
      [3, 5],
    ]);
  });

  test('detects a vertical sequence (↓)', () => {
    const board = createEmptyTestBoard();
    // Place 5 blue chips vertically on col 4, rows 2..6
    for (let r = 2; r <= 6; r++) {
      board[r][4].chip = 'blue';
    }

    const seqs = findSequences(board, 'blue');
    expect(seqs).toHaveLength(1);
    expect(seqs[0].direction).toBe('vertical');
    expect(seqs[0].team).toBe('blue');
    expect(seqs[0].cells).toEqual([
      [2, 4],
      [3, 4],
      [4, 4],
      [5, 4],
      [6, 4],
    ]);
  });

  test('detects a diagonal down-right sequence (↘)', () => {
    const board = createEmptyTestBoard();
    // Place 5 green chips diagonally ↘ from (2, 2) to (6, 6)
    for (let i = 2; i <= 6; i++) {
      board[i][i].chip = 'green';
    }

    const seqs = findSequences(board, 'green');
    expect(seqs).toHaveLength(1);
    expect(seqs[0].direction).toBe('diagonal-down-right');
    expect(seqs[0].team).toBe('green');
    expect(seqs[0].cells).toEqual([
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
    ]);
  });

  test('detects a diagonal down-left sequence (↙)', () => {
    const board = createEmptyTestBoard();
    // Place 5 red chips diagonally ↙ from (2, 7) to (6, 3)
    for (let i = 0; i < 5; i++) {
      board[2 + i][7 - i].chip = 'red';
    }

    const seqs = findSequences(board, 'red');
    expect(seqs).toHaveLength(1);
    expect(seqs[0].direction).toBe('diagonal-down-left');
    expect(seqs[0].team).toBe('red');
    expect(seqs[0].cells).toEqual([
      [2, 7],
      [3, 6],
      [4, 5],
      [5, 4],
      [6, 3],
    ]);
  });
});

describe('Corner Handling (Free / Wild Corners)', () => {
  test('forms a sequence with top-left corner [0, 0] + 4 chips', () => {
    const board = createEmptyTestBoard();
    // Corner [0, 0] + chips at [0, 1], [0, 2], [0, 3], [0, 4]
    for (let c = 1; c <= 4; c++) {
      board[0][c].chip = 'red';
    }

    const seqs = findSequences(board, 'red');
    expect(seqs).toHaveLength(1);
    expect(seqs[0].cells).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ]);
  });

  test('forms a sequence with top-right corner [0, 9] + 4 chips', () => {
    const board = createEmptyTestBoard();
    // Corner [0, 9] + chips at [0, 8], [0, 7], [0, 6], [0, 5]
    for (let c = 5; c <= 8; c++) {
      board[0][c].chip = 'blue';
    }

    const seqs = findSequences(board, 'blue');
    expect(seqs).toHaveLength(1);
    expect(seqs[0].cells).toEqual([
      [0, 5],
      [0, 6],
      [0, 7],
      [0, 8],
      [0, 9],
    ]);
  });

  test('forms a sequence with bottom-left corner [9, 0] + 4 chips vertically', () => {
    const board = createEmptyTestBoard();
    // Corner [9, 0] + chips at [8, 0], [7, 0], [6, 0], [5, 0]
    for (let r = 5; r <= 8; r++) {
      board[r][0].chip = 'green';
    }

    const seqs = findSequences(board, 'green');
    expect(seqs).toHaveLength(1);
    expect(seqs[0].cells).toEqual([
      [5, 0],
      [6, 0],
      [7, 0],
      [8, 0],
      [9, 0],
    ]);
  });

  test('forms a sequence with bottom-right corner [9, 9] + 4 chips diagonally', () => {
    const board = createEmptyTestBoard();
    // Corner [9, 9] + chips at (5,5), (6,6), (7,7), (8,8)
    for (let i = 5; i <= 8; i++) {
      board[i][i].chip = 'red';
    }

    const seqs = findSequences(board, 'red');
    expect(seqs).toHaveLength(1);
    expect(seqs[0].direction).toBe('diagonal-down-right');
    expect(seqs[0].cells).toEqual([
      [5, 5],
      [6, 6],
      [7, 7],
      [8, 8],
      [9, 9],
    ]);
  });

  test('two teams can simultaneously use the same corner', () => {
    const board = createEmptyTestBoard();
    // Red uses top-left corner horizontally [0, 0]..[0, 4]
    for (let c = 1; c <= 4; c++) {
      board[0][c].chip = 'red';
    }
    // Blue uses top-left corner vertically [0, 0]..[4, 0]
    for (let r = 1; r <= 4; r++) {
      board[r][0].chip = 'blue';
    }

    const redSeqs = findSequences(board, 'red');
    const blueSeqs = findSequences(board, 'blue');

    expect(redSeqs).toHaveLength(1);
    expect(blueSeqs).toHaveLength(1);
    expect(redSeqs[0].cells[0]).toEqual([0, 0]);
    expect(blueSeqs[0].cells[0]).toEqual([0, 0]);
  });
});

describe('Shared-Chip Rule and Overlaps', () => {
  test('two sequences sharing at most ONE chip count as 2 sequences (perpendicular)', () => {
    const board = createEmptyTestBoard();
    // Horizontal line on row 4: cols 2..6
    for (let c = 2; c <= 6; c++) {
      board[4][c].chip = 'red';
    }
    // Vertical line on col 4: rows 2..6 (crosses at [4, 4])
    for (let r = 2; r <= 6; r++) {
      board[r][4].chip = 'red';
    }

    const seqs = findSequences(board, 'red');
    // They share exactly ONE chip [4, 4] -> Both count!
    expect(seqs).toHaveLength(2);
    const directions = seqs.map((s) => s.direction);
    expect(directions).toContain('horizontal');
    expect(directions).toContain('vertical');
  });

  test('9-in-a-row counts as 2 sequences (sharing 1 center chip)', () => {
    const board = createEmptyTestBoard();
    // 9 chips in a row on row 5, cols 1..9
    // Sequence 1: 1..5, Sequence 2: 5..9 (shares [5, 5])
    for (let c = 1; c <= 9; c++) {
      board[5][c].chip = 'blue';
    }

    const seqs = findSequences(board, 'blue');
    expect(seqs).toHaveLength(2);
  });

  test('6-in-a-row counts as ONLY ONE sequence (shared-chip limit)', () => {
    const board = createEmptyTestBoard();
    // Place 6 red chips in a straight row (cols 1..6)
    for (let c = 1; c <= 6; c++) {
      board[2][c].chip = 'red';
    }

    const seqs = findSequences(board, 'red');
    // Candidate 1..5 and Candidate 2..6 share 4 chips -> only 1 sequence allowed!
    expect(seqs).toHaveLength(1);
  });

  test('7-in-a-row and 8-in-a-row also count as only ONE sequence', () => {
    const board7 = createEmptyTestBoard();
    for (let c = 1; c <= 7; c++) board7[1][c].chip = 'green';
    expect(findSequences(board7, 'green')).toHaveLength(1);

    const board8 = createEmptyTestBoard();
    for (let c = 1; c <= 8; c++) board8[1][c].chip = 'green';
    expect(findSequences(board8, 'green')).toHaveLength(1);
  });
});

describe('Cell Locking', () => {
  test('marks chips in completed sequence as locked, but leaves corners unlocked', () => {
    const board = createEmptyTestBoard();
    // Sequence with top-left corner + 4 chips
    for (let c = 1; c <= 4; c++) {
      board[0][c].chip = 'red';
    }

    const seqs = findSequences(board, 'red');
    expect(seqs).toHaveLength(1);

    const lockedBoard = lockSequenceCells(board, seqs);

    // Corner is NEVER locked
    expect(lockedBoard[0][0].locked).toBe(false);
    expect(isCorner(lockedBoard[0][0])).toBe(true);

    // All 4 chips are locked
    for (let c = 1; c <= 4; c++) {
      expect(lockedBoard[0][c].locked).toBe(true);
    }

    // Other cells remain unlocked
    expect(lockedBoard[0][5].locked).toBe(false);
  });
});

describe('Win Thresholds and Winner Checking', () => {
  test('requiredSequences returns 2 for 2 teams and 1 for 3 teams', () => {
    expect(requiredSequences(2)).toBe(2);
    expect(requiredSequences(3)).toBe(1);
    expect(() => requiredSequences(4)).toThrow(/Invalid team count/);
  });

  test('in a 2-team game, 1 sequence does NOT win, but 2 sequences does', () => {
    const board = createEmptyTestBoard();
    // Sequence 1 for Red: horizontal row 3, cols 1..5
    for (let c = 1; c <= 5; c++) board[3][c].chip = 'red';

    const check1 = checkWinner(board, ['red', 'blue']);
    expect(check1.winner).toBeNull();
    expect(check1.teamSequences.red).toHaveLength(1);

    // Sequence 2 for Red: horizontal row 7, cols 1..5
    for (let c = 1; c <= 5; c++) board[7][c].chip = 'red';

    const check2 = checkWinner(board, ['red', 'blue']);
    expect(check2.winner).toBe('red');
    expect(check2.teamSequences.red).toHaveLength(2);
  });

  test('in a 3-team game, 1 sequence is sufficient to win immediately', () => {
    const board = createEmptyTestBoard();
    // Sequence 1 for Blue: vertical col 5, rows 2..6
    for (let r = 2; r <= 6; r++) board[r][5].chip = 'blue';

    const check = checkWinner(board, ['red', 'blue', 'green']);
    expect(check.winner).toBe('blue');
    expect(check.requiredCount).toBe(1);
    expect(check.teamSequences.blue).toHaveLength(1);
  });
});
