// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Bot AI (Easy, Medium, Hard)
// Pure TypeScript, zero UI imports.
// ─────────────────────────────────────────────────────────────────────────────

import type { Cell, Card, TeamId } from './types';
import { GameEngineState, MoveType } from './gameReducer';
import { isDeadCard, getCellsForCard } from './board';
import { isOneEyedJack, isTwoEyedJack } from './deck';
import { isCorner, requiredSequences, findSequences } from './sequenceDetector';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export type BotMove =
  | { type: 'play'; cardId: string; cell: [number, number] }
  | { type: 'discard_dead'; cardId: string };

interface LineDefinition {
  cells: [number, number][];
}

/** Precomputed 192 lines of 5 consecutive cells on a 10×10 board */
const ALL_BOARD_LINES: LineDefinition[] = (() => {
  const lines: LineDefinition[] = [];

  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal ↘
    [1, -1], // diagonal ↙
  ];

  for (const [dr, dc] of directions) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const endR = r + dr * 4;
        const endC = c + dc * 4;
        if (endR >= 0 && endR < 10 && endC >= 0 && endC < 10) {
          const cells: [number, number][] = [];
          for (let step = 0; step < 5; step++) {
            cells.push([r + dr * step, c + dc * step]);
          }
          lines.push({ cells });
        }
      }
    }
  }

  return lines;
})();

/** Map from "r,c" to list of line indices passing through that cell */
const CELL_TO_LINES_MAP: number[][] = (() => {
  const map: number[][] = Array.from({ length: 100 }, () => []);
  ALL_BOARD_LINES.forEach((line, lineIdx) => {
    for (const [r, c] of line.cells) {
      map[r * 10 + c].push(lineIdx);
    }
  });
  return map;
})();

function getLinesForCell(r: number, c: number): LineDefinition[] {
  const lineIndices = CELL_TO_LINES_MAP[r * 10 + c] || [];
  return lineIndices.map((idx) => ALL_BOARD_LINES[idx]);
}

interface MoveCandidate {
  card: Card;
  cell: [number, number];
  isWild: boolean;
  isRemove: boolean;
}

/**
 * Returns all valid moves for a player given their current hand.
 */
export function getValidMoves(state: GameEngineState, playerId: string): MoveCandidate[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const candidates: MoveCandidate[] = [];
  const board = state.board;

  // Cache board empty non-corner cells and opponent non-locked chips
  const emptyNonCornerCells: [number, number][] = [];
  const opponentRemovableCells: [number, number][] = [];

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = board[r][c];
      if (cell.card !== 'CORNER') {
        if (cell.chip === null) {
          emptyNonCornerCells.push([r, c]);
        } else if (cell.chip !== player.teamId && !cell.locked) {
          opponentRemovableCells.push([r, c]);
        }
      }
    }
  }

  for (const card of player.hand) {
    if (isTwoEyedJack(card)) {
      for (const [r, c] of emptyNonCornerCells) {
        candidates.push({ card, cell: [r, c], isWild: true, isRemove: false });
      }
    } else if (isOneEyedJack(card)) {
      for (const [r, c] of opponentRemovableCells) {
        candidates.push({ card, cell: [r, c], isWild: false, isRemove: true });
      }
    } else {
      const matching = getCellsForCard(board, card);
      for (const cell of matching) {
        if (cell.chip === null) {
          candidates.push({
            card,
            cell: [cell.row, cell.col],
            isWild: false,
            isRemove: false,
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Computes heuristic score for placing a chip or removing an opponent chip.
 */
function scoreMove(
  board: Cell[][],
  myTeam: TeamId,
  candidate: MoveCandidate,
  difficulty: 'medium' | 'hard',
  neededSequences: number,
  currentSequenceCount: number
): number {
  const [r, c] = candidate.cell;
  const lines = getLinesForCell(r, c);
  let score = 0;

  // Center proximity bonus
  const distToCenter = Math.hypot(r - 4.5, c - 4.5);
  score += (5 - distToCenter) * 2;

  let threatsCreated = 0;

  if (candidate.isRemove) {
    // Evaluating One-Eyed Jack removal of opponent chip at [r, c]
    let maxOpponentThreatBroken = 0;

    for (const line of lines) {
      let oppCount = 0;
      let blockedByOther = false;

      for (const [lr, lc] of line.cells) {
        const cell = board[lr][lc];
        if (isCorner(cell)) {
          oppCount++;
        } else if (cell.chip === null) {
          // empty
        } else if (cell.chip !== myTeam) {
          oppCount++;
        } else {
          blockedByOther = true;
          break;
        }
      }

      if (!blockedByOther) {
        if (oppCount === 4) {
          maxOpponentThreatBroken = Math.max(maxOpponentThreatBroken, 20000); // broke opponent 4-in-a-row!
        } else if (oppCount === 3) {
          maxOpponentThreatBroken = Math.max(maxOpponentThreatBroken, 2500);
        } else if (oppCount === 2) {
          maxOpponentThreatBroken = Math.max(maxOpponentThreatBroken, 300);
        }
      }
    }

    score += maxOpponentThreatBroken;

    // Penalty for wasting One-Eyed Jack on trivial chip
    if (maxOpponentThreatBroken < 1000) {
      score -= difficulty === 'hard' ? 3000 : 800;
    }

    return score;
  }

  // Evaluating chip placement at [r, c]
  for (const line of lines) {
    let myCount = 0;
    let oppCount = 0;

    for (const [lr, lc] of line.cells) {
      if (lr === r && lc === c) {
        myCount++; // our proposed chip
        continue;
      }

      const cell = board[lr][lc];
      if (isCorner(cell)) {
        myCount++;
        oppCount++;
      } else if (cell.chip === myTeam) {
        myCount++;
      } else if (cell.chip !== null) {
        oppCount++;
      }
    }

    // 1. Extending own line (only valid if unblocked by opponents)
    if (oppCount === 0 || (oppCount === 1 && line.cells.some(([lr, lc]) => isCorner(board[lr][lc])))) {
      if (myCount === 5) {
        // Completes sequence!
        const willWin = currentSequenceCount + 1 >= neededSequences;
        score += willWin ? 100000 : 25000;
      } else if (myCount === 4) {
        score += 3500; // 4-in-a-row threat
        threatsCreated++;
      } else if (myCount === 3) {
        score += 450;
        threatsCreated++;
      } else if (myCount === 2) {
        score += 60;
      }
    }

    // 2. Blocking opponent line
    if (myCount === 1) { // only our proposed chip is in this line so far
      if (oppCount === 4) {
        // Blocks an immediate opponent sequence!
        score += 15000;
      } else if (oppCount === 3) {
        score += 1800;
      } else if (oppCount === 2) {
        score += 200;
      }
    }
  }

  // Double threat bonus (creates multiple strong branches simultaneously)
  if (threatsCreated >= 2) {
    score += difficulty === 'hard' ? 8000 : 2000;
  }

  // Jack Conservation: penalize using Wild Jack on low-value moves
  if (candidate.isWild) {
    if (score < 3000) {
      score -= difficulty === 'hard' ? 4000 : 1500;
    }
  }

  return score;
}

/**
 * Chooses the best move for a bot player based on difficulty level.
 */
export function chooseMove(
  state: GameEngineState,
  playerId: string,
  difficulty: BotDifficulty = 'medium'
): BotMove | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || state.phase !== 'playing') {
    return null;
  }

  // 1. Always discard dead cards first (free action, recycles dead card)
  for (const card of player.hand) {
    if (isDeadCard(state.board, card)) {
      return { type: 'discard_dead', cardId: card.id };
    }
  }

  // 2. Find all legal moves
  const validMoves = getValidMoves(state, playerId);
  if (validMoves.length === 0) {
    return null;
  }

  // Easy: Random move with slight preference for center cells
  if (difficulty === 'easy') {
    let bestScore = -Infinity;
    let chosen = validMoves[0];

    for (const move of validMoves) {
      const [r, c] = move.cell;
      const dist = Math.hypot(r - 4.5, c - 4.5);
      // Center preference + high randomness
      const score = (5 - dist) * 1.5 + Math.random() * 20;
      if (score > bestScore) {
        bestScore = score;
        chosen = move;
      }
    }

    return {
      type: 'play',
      cardId: chosen.card.id,
      cell: chosen.cell,
    };
  }

  // Medium and Hard: Score moves
  const needed = requiredSequences(state.teams.length);
  const myCurrentSeqs = state.sequenceCounts[player.teamId] || 0;

  let bestScore = -Infinity;
  let bestCandidate = validMoves[0];

  for (const move of validMoves) {
    let score = scoreMove(state.board, player.teamId, move, difficulty, needed, myCurrentSeqs);

    // Hard difficulty: small lookahead bonus or tie-break
    if (difficulty === 'hard') {
      // Prioritize winning immediately
      if (score >= 25000) {
        return { type: 'play', cardId: move.card.id, cell: move.cell };
      }
    }

    // Add tiny random jitter for equal-scoring moves
    score += Math.random() * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = move;
    }
  }

  return {
    type: 'play',
    cardId: bestCandidate.card.id,
    cell: bestCandidate.cell,
  };
}
