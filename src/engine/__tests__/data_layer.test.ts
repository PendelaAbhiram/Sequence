// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Data Layer Tests (Jest)
// Tests for board validator, deck size, and dealing for every allowed player count.
// ─────────────────────────────────────────────────────────────────────────────

import rawLayout from '../boardLayout.json';
import {
  validateBoardLayout,
  createBoard,
  getCellsForCard,
  isDeadCard,
  RawBoardLayout,
} from '../board';
import {
  createDeck,
  shuffle,
  deal,
  handSizeForPlayerCount,
  isJack,
  isOneEyedJack,
  isTwoEyedJack,
  VALID_PLAYER_COUNTS,
  HAND_SIZES,
} from '../deck';
import type { Card } from '../types';

describe('Board Layout and Validator', () => {
  test('validates the official boardLayout.json successfully', () => {
    const result = validateBoardLayout(rawLayout);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('createBoard() returns a 10x10 grid with 4 corners and 96 cards', () => {
    const board = createBoard();
    expect(board).toHaveLength(10);
    expect(board[0]).toHaveLength(10);

    // 4 corners
    expect(board[0][0].card).toBe('CORNER');
    expect(board[0][9].card).toBe('CORNER');
    expect(board[9][0].card).toBe('CORNER');
    expect(board[9][9].card).toBe('CORNER');

    // Count corners and card cells
    let corners = 0;
    let cardCells = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        if (cell.card === 'CORNER') {
          corners++;
          expect(cell.locked).toBe(true);
        } else {
          cardCells++;
          expect(cell.locked).toBe(false);
          expect(cell.card.id).toBeDefined();
        }
      }
    }

    expect(corners).toBe(4);
    expect(cardCells).toBe(96);
  });

  test('getCellsForCard() finds exactly 2 cells for any standard non-Jack card', () => {
    const board = createBoard();
    const testCard: Card = { rank: 'Q', suit: 'spades', id: 'spades-Q-0' };
    const cells = getCellsForCard(board, testCard);

    expect(cells).toHaveLength(2);
    expect(cells[0].card).not.toBe('CORNER');
    expect(cells[1].card).not.toBe('CORNER');

    if (cells[0].card !== 'CORNER' && cells[1].card !== 'CORNER') {
      expect(cells[0].card.rank).toBe('Q');
      expect(cells[0].card.suit).toBe('spades');
      expect(cells[1].card.rank).toBe('Q');
      expect(cells[1].card.suit).toBe('spades');
    }
  });

  test('getCellsForCard() returns empty array for Jacks', () => {
    const board = createBoard();
    const jack: Card = { rank: 'J', suit: 'clubs', id: 'clubs-J-0' };
    const cells = getCellsForCard(board, jack);
    expect(cells).toHaveLength(0);
  });

  test('isDeadCard detects when both cells are covered', () => {
    const board = createBoard();
    const card: Card = { rank: '5', suit: 'hearts', id: 'hearts-5-0' };

    expect(isDeadCard(board, card)).toBe(false);

    const cells = getCellsForCard(board, card);
    expect(cells).toHaveLength(2);

    // Cover first cell
    cells[0].chip = 'red';
    expect(isDeadCard(board, card)).toBe(false);

    // Cover second cell
    cells[1].chip = 'blue';
    expect(isDeadCard(board, card)).toBe(true);
  });

  test('validator detects missing row or wrong dimension', () => {
    const invalidLayout = (rawLayout as RawBoardLayout).slice(0, 9);
    const result = validateBoardLayout(invalidLayout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('10 rows'))).toBe(true);
  });

  test('validator detects misplaced corner', () => {
    const corrupted: any = JSON.parse(JSON.stringify(rawLayout));
    corrupted[0][0] = { rank: '2', suit: 'spades' }; // replace corner with card
    const result = validateBoardLayout(corrupted);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Expected CORNER at [0, 0]'))).toBe(true);
  });

  test('validator detects forbidden Jack on the board', () => {
    const corrupted: any = JSON.parse(JSON.stringify(rawLayout));
    corrupted[1][1] = { rank: 'J', suit: 'diamonds' };
    const result = validateBoardLayout(corrupted);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid Jack'))).toBe(true);
  });

  test('validator detects duplicate or missing card counts', () => {
    const corrupted: any = JSON.parse(JSON.stringify(rawLayout));
    // Replace a 3S with another 2S (so 2S has 3 occurrences and 3S has 1)
    corrupted[0][2] = { rank: '2', suit: 'spades' };
    const result = validateBoardLayout(corrupted);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Card 2 of spades must appear exactly 2 times'))).toBe(true);
    expect(result.errors.some(e => e.includes('Card 3 of spades must appear exactly 2 times'))).toBe(true);
  });
});

describe('Deck Size and Composition', () => {
  test('createDeck() returns 104 total cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(104);
  });

  test('createDeck() contains 8 Jacks (4 two-eyed, 4 one-eyed)', () => {
    const deck = createDeck();
    const jacks = deck.filter(isJack);
    expect(jacks).toHaveLength(8);

    const twoEyed = deck.filter(isTwoEyedJack);
    expect(twoEyed).toHaveLength(4);
    for (const card of twoEyed) {
      expect(['diamonds', 'clubs']).toContain(card.suit);
    }

    const oneEyed = deck.filter(isOneEyedJack);
    expect(oneEyed).toHaveLength(4);
    for (const card of oneEyed) {
      expect(['spades', 'hearts']).toContain(card.suit);
    }
  });

  test('createDeck() has unique IDs for all 104 cards', () => {
    const deck = createDeck();
    const ids = new Set(deck.map(c => c.id));
    expect(ids.size).toBe(104);
  });

  test('shuffle() returns all 104 cards in randomized order', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);

    expect(shuffled).toHaveLength(104);
    // Same card IDs present
    const originalIds = deck.map(c => c.id).sort();
    const shuffledIds = shuffled.map(c => c.id).sort();
    expect(shuffledIds).toEqual(originalIds);
  });
});

describe('Dealing for Every Allowed Player Count', () => {
  test('handSizeForPlayerCount table matches the official Sequence rules', () => {
    expect(handSizeForPlayerCount(2)).toBe(7);
    expect(handSizeForPlayerCount(3)).toBe(6);
    expect(handSizeForPlayerCount(4)).toBe(6);
    expect(handSizeForPlayerCount(6)).toBe(5);
    expect(handSizeForPlayerCount(8)).toBe(4);
    expect(handSizeForPlayerCount(9)).toBe(4);
    expect(handSizeForPlayerCount(10)).toBe(3);
    expect(handSizeForPlayerCount(12)).toBe(3);
  });

  // Test dealing for EVERY allowed player count: 2, 3, 4, 6, 8, 9, 10, 12
  test.each(VALID_PLAYER_COUNTS)(
    'deal() correctly deals for %i players',
    (playerCount) => {
      const deck = createDeck();
      const expectedHandSize = HAND_SIZES[playerCount];
      const result = deal(deck, playerCount);

      // Correct number of hands
      expect(result.hands).toHaveLength(playerCount);

      // Every player gets exact hand size
      for (const hand of result.hands) {
        expect(hand).toHaveLength(expectedHandSize);
      }

      // Total cards accounted for: dealt cards + remaining cards = 104
      const totalDealt = playerCount * expectedHandSize;
      expect(result.remainingDeck).toHaveLength(104 - totalDealt);
      expect(result.drawPile).toHaveLength(104 - totalDealt);

      // All dealt cards are unique
      const allDealtIds = result.hands.flat().map(c => c.id);
      expect(new Set(allDealtIds).size).toBe(totalDealt);

      // No dealt card remains in the draw pile
      const remainingIds = new Set(result.remainingDeck.map(c => c.id));
      for (const id of allDealtIds) {
        expect(remainingIds.has(id)).toBe(false);
      }
    }
  );

  test('deal() rejects invalid player counts', () => {
    const deck = createDeck();
    const invalidCounts = [1, 5, 7, 11, 13, 15];

    for (const count of invalidCounts) {
      expect(() => deal(deck, count)).toThrow(/Invalid player count/);
    }
  });

  test('deal() rejects insufficient deck', () => {
    const shortDeck = createDeck().slice(0, 10);
    expect(() => deal(shortDeck, 2)).toThrow(/not have enough cards/); // 2 players need 14
  });
});
