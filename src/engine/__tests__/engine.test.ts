// ─────────────────────────────────────────────────────────────────────────────
// Sequence Engine – Test Suite (pure Node, no test framework needed)
// Run with:  npx ts-node src/engine/__tests__/engine.test.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
  gameReducer,
  buildDrawPile,
  shuffle,
  isTwoEyedJack,
  isOneEyedJack,
  handSizeForPlayerCount,
  createInitialBoard,
  findCellsForCard,
  isDeadCard,
  findNewSequences,
  lockSequenceCells,
  checkWin,
  currentPlayer,
  validTargetsForCard,
  deadCardsInHand,
} from '../index';
import type { GameState, BoardCell, Card, TeamId } from '../types';

// ─── tiny test harness ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n▶ ${name}`);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function startGame(playerCount = 2, teams?: TeamId[]): GameState {
  const teamList: TeamId[] = teams ?? ['red', 'blue'];
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    team: teamList[i % teamList.length],
  }));
  const result = gameReducer(null, { type: 'START_GAME', players });
  if (!result.ok || !result.newState) throw new Error('START_GAME failed: ' + result.error);
  return result.newState;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

section('Deck');
{
  const deck = buildDrawPile();
  assert(deck.length === 104, `Draw pile has 104 cards (got ${deck.length})`);
  const jacks = deck.filter(c => c.rank === 'J');
  assert(jacks.length === 8, `8 Jacks in draw pile (got ${jacks.length})`);
  const twoEyed = jacks.filter(c => isTwoEyedJack(c));
  const oneEyed = jacks.filter(c => isOneEyedJack(c));
  assert(twoEyed.length === 4, '4 two-eyed Jacks');
  assert(oneEyed.length === 4, '4 one-eyed Jacks');
}

section('Hand sizes');
{
  const cases: [number, number][] = [[2,7],[3,6],[4,6],[6,5],[8,4],[9,4],[10,3],[12,3]];
  for (const [count, expected] of cases) {
    assert(handSizeForPlayerCount(count) === expected, `${count} players → hand ${expected}`);
  }
}

section('Board layout');
{
  const board = createInitialBoard();
  assert(board.length === 10, '10 rows');
  assert(board[0].length === 10, '10 cols');

  // Corners should be free (CORNER marker)
  assert(board[0][0].card === 'CORNER', 'top-left corner is free');
  assert(board[0][9].card === 'CORNER', 'top-right corner is free');
  assert(board[9][0].card === 'CORNER', 'bottom-left corner is free');
  assert(board[9][9].card === 'CORNER', 'bottom-right corner is free');

  // Count non-corner cells
  let cardCells = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    if (board[r][c].card !== 'CORNER') cardCells++;
  }
  assert(cardCells === 96, `96 card cells (got ${cardCells})`);

  // Each non-Jack card appears exactly twice
  const counts = new Map<string, number>();
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    const card = board[r][c].card;
    if (card && card !== 'CORNER') {
      const key = `${card.suit}-${card.rank}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const allTwo = [...counts.values()].every(v => v === 2);
  assert(allTwo, 'Every non-Jack card appears exactly twice on board');
}

section('START_GAME');
{
  const state = startGame(2);
  assert(state.phase === 'playing', 'Phase is playing');
  assert(state.players.length === 2, '2 players');
  assert(state.players[0].hand.length === 7, 'P0 has 7 cards');
  assert(state.players[1].hand.length === 7, 'P1 has 7 cards');
  assert(state.sequencesNeeded === 2, '2 teams → 2 sequences needed');

  const state3 = startGame(3, ['red', 'blue', 'green']);
  assert(state3.sequencesNeeded === 1, '3 teams → 1 sequence needed');

  const badResult = gameReducer(null, {
    type: 'START_GAME',
    players: [{ id: 'x', name: 'X', team: 'red' }],
  });
  assert(!badResult.ok, 'Rejects 1 player');
}

section('PLACE_CHIP – normal card');
{
  const state = startGame(2);
  const player = state.players[0];
  // Find a non-Jack card in hand that has a free cell on board
  const card = player.hand.find(c => c.rank !== 'J' && !isDeadCard(state.board, c));
  assert(!!card, 'Player has a playable non-Jack card');
  if (card) {
    const cells = findCellsForCard(state.board, card.suit, card.rank);
    const freeCell = cells.find(([r, c]) => state.board[r][c].chip === null);
    assert(!!freeCell, 'Found a free cell for that card');
    if (freeCell) {
      const result = gameReducer(state, {
        type: 'PLACE_CHIP',
        playerId: player.id,
        cardId: card.id,
        row: freeCell[0],
        col: freeCell[1],
      });
      assert(result.ok, 'PLACE_CHIP succeeds');
      assert(result.newState!.board[freeCell[0]][freeCell[1]].chip === 'red', 'Chip placed correctly');
      assert(result.newState!.currentPlayerIndex === 1, 'Turn advanced to player 1');
      assert(result.newState!.players[0].hand.length === 7, 'Hand refilled to 7');
    }
  }
}

section('PLACE_CHIP – wrong player');
{
  const state = startGame(2);
  const p1 = state.players[1]; // not current player
  const card = p1.hand.find(c => c.rank !== 'J');
  if (card) {
    const cells = findCellsForCard(state.board, card.suit, card.rank);
    if (cells.length > 0) {
      const [r, c] = cells[0];
      const result = gameReducer(state, {
        type: 'PLACE_CHIP', playerId: p1.id, cardId: card.id, row: r, col: c,
      });
      assert(!result.ok, 'Rejects out-of-turn play');
    }
  }
}

section('PLACE_CHIP – two-eyed Jack (wild)');
{
  let state = startGame(2);
  // Inject a two-eyed Jack into player 0's hand for testing
  const twoEyedJack: Card = { suit: 'diamonds', rank: 'J', id: 'test-2ej' };
  state = {
    ...state,
    players: state.players.map((p, i) =>
      i === 0 ? { ...p, hand: [twoEyedJack, ...p.hand.slice(0, 6)] } : p
    ),
  };
  // Find any empty non-corner cell
  let target: [number, number] | null = null;
  for (let r = 0; r < 10 && !target; r++) {
    for (let c = 0; c < 10 && !target; c++) {
      if (state.board[r][c].card !== 'CORNER' && state.board[r][c].card !== null && state.board[r][c].chip === null) {
        target = [r, c];
      }
    }
  }
  assert(!!target, 'Found empty cell for wild Jack');
  if (target) {
    const result = gameReducer(state, {
      type: 'PLACE_CHIP',
      playerId: 'p0',
      cardId: twoEyedJack.id,
      row: target[0],
      col: target[1],
    });
    assert(result.ok, 'Two-eyed Jack places on any empty cell');
    assert(result.newState!.board[target[0]][target[1]].chip === 'red', 'Chip placed by wild Jack');
  }
}

section('REMOVE_CHIP – one-eyed Jack');
{
  // Manually place a blue chip, then use a one-eyed Jack to remove it
  let state = startGame(2);
  const blueChip: [number, number] = [2, 2]; // pick a non-corner, non-locked cell
  state = {
    ...state,
    board: state.board.map((row, r) =>
      row.map((cell, c) =>
        r === blueChip[0] && c === blueChip[1]
          ? { ...cell, chip: 'blue' as TeamId }
          : cell
      )
    ),
  };
  const oneEyedJack: Card = { suit: 'spades', rank: 'J', id: 'test-1ej' };
  state = {
    ...state,
    players: state.players.map((p, i) =>
      i === 0 ? { ...p, hand: [oneEyedJack, ...p.hand.slice(0, 6)] } : p
    ),
  };
  const result = gameReducer(state, {
    type: 'REMOVE_CHIP',
    playerId: 'p0',
    cardId: oneEyedJack.id,
    row: blueChip[0],
    col: blueChip[1],
  });
  assert(result.ok, 'REMOVE_CHIP succeeds');
  assert(result.newState!.board[blueChip[0]][blueChip[1]].chip === null, 'Chip removed');
}

section('REMOVE_CHIP – cannot remove own chip');
{
  let state = startGame(2);
  const cell: [number, number] = [3, 3];
  state = {
    ...state,
    board: state.board.map((row, r) =>
      row.map((c2, c) =>
        r === cell[0] && c === cell[1] ? { ...c2, chip: 'red' as TeamId } : c2
      )
    ),
  };
  const oneEyedJack: Card = { suit: 'hearts', rank: 'J', id: 'test-1ej-own' };
  state = {
    ...state,
    players: state.players.map((p, i) =>
      i === 0 ? { ...p, hand: [oneEyedJack, ...p.hand.slice(0, 6)] } : p
    ),
  };
  const result = gameReducer(state, {
    type: 'REMOVE_CHIP', playerId: 'p0', cardId: oneEyedJack.id,
    row: cell[0], col: cell[1],
  });
  assert(!result.ok, 'Cannot remove own chip with one-eyed Jack');
}

section('REMOVE_CHIP – cannot remove locked chip');
{
  let state = startGame(2);
  const cell: [number, number] = [4, 4];
  state = {
    ...state,
    board: state.board.map((row, r) =>
      row.map((c2, c) =>
        r === cell[0] && c === cell[1] ? { ...c2, chip: 'blue' as TeamId, locked: true } : c2
      )
    ),
  };
  const oneEyedJack: Card = { suit: 'spades', rank: 'J', id: 'test-1ej-lock' };
  state = {
    ...state,
    players: state.players.map((p, i) =>
      i === 0 ? { ...p, hand: [oneEyedJack, ...p.hand.slice(0, 6)] } : p
    ),
  };
  const result = gameReducer(state, {
    type: 'REMOVE_CHIP', playerId: 'p0', cardId: oneEyedJack.id,
    row: cell[0], col: cell[1],
  });
  assert(!result.ok, 'Cannot remove locked chip');
}

section('Sequence detection');
{
  const board = createInitialBoard();
  // Manually place 5 red chips in row 1, cols 1-5
  const testBoard = board.map((row, r) =>
    row.map((cell, c) =>
      r === 1 && c >= 1 && c <= 5 ? { ...cell, chip: 'red' as TeamId } : cell
    )
  );
  const seqs = findNewSequences(testBoard, 'red', []);
  assert(seqs.length >= 1, `Detected sequence in row (found ${seqs.length})`);
  assert(seqs[0].team === 'red', 'Sequence belongs to red team');

  // Diagonal
  const diagBoard = board.map((row, r) =>
    row.map((cell, c) =>
      r === c && r >= 1 && r <= 5 ? { ...cell, chip: 'blue' as TeamId } : cell
    )
  );
  const diagSeqs = findNewSequences(diagBoard, 'blue', []);
  assert(diagSeqs.length >= 1, 'Detected diagonal sequence');
}

section('Sequence with free corner');
{
  const board = createInitialBoard();
  // Top-left corner is free. Place 4 blue chips in row 0, cols 1-4.
  // (0,0) is free corner → should form a sequence [0,0],[0,1],[0,2],[0,3],[0,4]
  const testBoard = board.map((row, r) =>
    row.map((cell, c) =>
      r === 0 && c >= 1 && c <= 4 ? { ...cell, chip: 'blue' as TeamId } : cell
    )
  );
  const seqs = findNewSequences(testBoard, 'blue', []);
  const cornerSeq = seqs.find(s => s.cells.some(([rr, cc]) => rr === 0 && cc === 0));
  assert(!!cornerSeq, '4 chips + free corner counts as a sequence');
}

section('checkWin');
{
  const counts = { red: 2, blue: 1, green: 0 };
  assert(checkWin(counts, 2) === 'red', 'Red wins with 2 sequences');
  assert(checkWin(counts, 3) === null, 'No winner when needing 3');
  const counts2 = { red: 1, blue: 1, green: 1 };
  assert(checkWin(counts2, 1) === 'red', 'Red wins first (1 needed)');
}

section('Dead card');
{
  let state = startGame(2);
  // Cover both cells of player 0's first non-Jack card with chips
  const card = state.players[0].hand.find(c => c.rank !== 'J')!;
  const positions = findCellsForCard(state.board, card.suit, card.rank);
  assert(positions.length === 2, 'Card has 2 board positions');

  // Cover both positions
  const coveredBoard = state.board.map((row, r) =>
    row.map((cell, c) =>
      positions.some(([pr, pc]) => pr === r && pc === c)
        ? { ...cell, chip: 'blue' as TeamId }
        : cell
    )
  );
  state = { ...state, board: coveredBoard };

  assert(isDeadCard(state.board, card), 'Card is detected as dead');

  const result = gameReducer(state, {
    type: 'REPLACE_DEAD_CARD',
    playerId: 'p0',
    cardId: card.id,
  });
  assert(result.ok, 'REPLACE_DEAD_CARD succeeds');
  assert(!result.newState!.players[0].hand.includes(card), 'Dead card removed from hand');
  assert(result.newState!.players[0].hand.length === 7, 'Hand size maintained after dead-card replacement');
}

section('validTargetsForCard');
{
  const state = startGame(2);
  const card = state.players[0].hand.find(c => !isOneEyedJack(c) && !isTwoEyedJack(c) && c.rank !== 'J')!;
  if (card) {
    const targets = validTargetsForCard(state, card);
    assert(targets.length > 0, `Non-Jack card has valid targets (found ${targets.length})`);
  }
  // Two-eyed Jack targets all empty non-corner cells
  const twoEyedJack: Card = { suit: 'diamonds', rank: 'J', id: 'vt-2ej' };
  const wildTargets = validTargetsForCard(state, twoEyedJack);
  assert(wildTargets.length === 96, `Two-eyed Jack targets all 96 empty non-corner cells (got ${wildTargets.length})`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Tests: ${passed} passed, ${failed} failed`);
if (typeof describe === 'function') {
  describe('Full Sequence Engine Test Suite', () => {
    test('all 55 engine assertions pass with zero failures', () => {
      expect(failed).toBe(0);
      expect(passed).toBeGreaterThanOrEqual(55);
    });
  });
} else if (failed > 0) {
  process.exit(1);
}
