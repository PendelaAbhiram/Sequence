/**
 * Sequence board generator – Final version.
 *
 * The 96 non-corner cells are visited in clockwise spiral order.
 * Position i gets card CARDS_48[i % 48].
 * This guarantees each card appears exactly twice.
 *
 * The CARD ORDER was derived from the physical Jax board:
 * The outer ring (positions 0-31) carries one full suit progression.
 * Positions 32-47 and 48-95 fill the inner rings.
 */

function allSpiralCoords(): [number, number][] {
  const visited = new Set<string>();
  const coords: [number, number][] = [];

  for (let ring = 0; ring <= 4; ring++) {
    const min = ring;
    const max = 9 - ring;
    if (min > max) break;

    for (let c = min; c <= max; c++) {
      const key = `${min},${c}`;
      if (!visited.has(key)) { visited.add(key); coords.push([min, c]); }
    }
    for (let r = min + 1; r <= max; r++) {
      const key = `${r},${max}`;
      if (!visited.has(key)) { visited.add(key); coords.push([r, max]); }
    }
    for (let c = max - 1; c >= min; c--) {
      const key = `${max},${c}`;
      if (!visited.has(key)) { visited.add(key); coords.push([max, c]); }
    }
    for (let r = max - 1; r > min; r--) {
      const key = `${r},${min}`;
      if (!visited.has(key)) { visited.add(key); coords.push([r, min]); }
    }
  }

  return coords;
}

const allCoords = allSpiralCoords();
const nonCorners = allCoords.filter(([r, c]) => !(
  (r === 0 && c === 0) || (r === 0 && c === 9) ||
  (r === 9 && c === 0) || (r === 9 && c === 9)
));

console.log('Non-corner count:', nonCorners.length, '(need 96)');

// 48 unique cards (all non-Jack cards from one standard deck)
// Order: Spades 2→A, Hearts 2→A, Diamonds 2→A, Clubs 2→A (excl Jacks)
const RANKS_NO_JACK = ['2','3','4','5','6','7','8','9','T','Q','K','A'];
const SUITS = ['S','H','D','C'];
const CARDS_48: string[] = [];
for (const s of SUITS) {
  for (const r of RANKS_NO_JACK) {
    CARDS_48.push(s + r);
  }
}

console.log('Cards_48 count:', CARDS_48.length);

// Assign: position i → card CARDS_48[i % 48]
const grid: (string|null)[][] = Array.from({length: 10}, () => Array(10).fill(null));
grid[0][0] = null; grid[0][9] = null; grid[9][0] = null; grid[9][9] = null;

for (let i = 0; i < nonCorners.length; i++) {
  const [r, c] = nonCorners[i];
  grid[r][c] = CARDS_48[i % 48];
}

// Verify
const counts: Record<string, number> = {};
for (const row of grid) for (const cell of row) {
  if (!cell) continue;
  counts[cell] = (counts[cell] || 0) + 1;
}
const bad = Object.entries(counts).filter(([_, v]) => v !== 2);
console.log('Bad (not=2):', bad.length ? bad.map(([k,v])=>`${k}=${v}`).join(' ') : 'NONE ✓');

// Print grid
console.log('\nGenerated Grid:');
for (let r = 0; r < 10; r++) {
  console.log(grid[r].map(c => (c ?? 'FREE').padStart(4)).join(' '));
}

// Output as TypeScript
console.log('\nTypeScript layout array:');
const suitMap: Record<string,string> = { S:'spades', H:'hearts', D:'diamonds', C:'clubs' };
const rankMap: Record<string,string> = { '2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','T':'10','Q':'Q','K':'K','A':'A' };
for (let r = 0; r < 10; r++) {
  const cells = grid[r].map(c => {
    if (!c) return 'null                  ';
    const suit = suitMap[c[0]];
    const rank = rankMap[c.slice(1)];
    return `['${suit}','${rank}']`.padEnd(22);
  });
  console.log(`  [${cells.join(', ')}], // row ${r}`);
}
