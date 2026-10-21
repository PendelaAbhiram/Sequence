import { createInitialBoard } from '../board';

const board = createInitialBoard();
const counts = new Map<string, number>();
for (let r = 0; r < 10; r++) {
  for (let c = 0; c < 10; c++) {
    const card = board[r][c].card;
    if (card && card !== 'CORNER') {
      const key = `${card.suit}-${card.rank}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
}

let allTwo = true;
for (const [k, v] of counts.entries()) {
  if (v !== 2) { console.log('BAD:', k, '=', v); allTwo = false; }
}
console.log('allTwo:', allTwo, '| distinct non-Jack cards:', counts.size);
// Should be 48 distinct cards (52 - 4 Jacks)
