// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine & Store – Full Scripted Game Tests (Jest)
// ─────────────────────────────────────────────────────────────────────────────

import {
  setupGame,
  gameEngineReducer,
  drawReplacementCard,
  cutTheDeck,
  getCardValue,
  PlayerState,
} from '../gameReducer';
import { getCellsForCard } from '../board';
import { useGameStore, GAME_SAVE_STORAGE_KEY } from '../../store/gameStore';
import { storage } from '../../utils/storage';
import type { Card } from '../types';

describe('Game Setup & Mechanics', () => {
  test('alternate seating ensures teammates are never seated next to each other', () => {
    // 4 players, 2 teams (red, blue)
    const state4 = setupGame({
      playerNames: ['Alice', 'Bob', 'Charlie', 'David'],
      teams: ['red', 'blue'],
    });

    expect(state4.players[0].teamId).toBe('red');
    expect(state4.players[1].teamId).toBe('blue');
    expect(state4.players[2].teamId).toBe('red');
    expect(state4.players[3].teamId).toBe('blue');

    // 3 players, 3 teams (red, blue, green)
    const state3 = setupGame({
      playerNames: ['Alice', 'Bob', 'Charlie'],
      teams: ['red', 'blue', 'green'],
    });

    expect(state3.players[0].teamId).toBe('red');
    expect(state3.players[1].teamId).toBe('blue');
    expect(state3.players[2].teamId).toBe('green');
  });

  test('cut the deck selects lowest card as dealer, and dealer left starts', () => {
    // Scripted cut cards: Player 0 has 10S (value 104), Player 1 has 2C (value 21, lowest!)
    const cutDeck: Card[] = [
      { rank: '10', suit: 'spades', id: '10s' },
      { rank: '2', suit: 'clubs', id: '2c' },
    ];

    const cut = cutTheDeck(2, cutDeck);
    expect(cut.dealerIndex).toBe(1); // Player 1 cut the lowest card (2 of clubs)

    const game = setupGame({
      playerNames: ['Alice', 'Bob'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Bob deals
    });

    // Player to the dealer's left starts (clockwise: (1 + 1) % 2 = 0 -> Alice starts)
    expect(game.dealerIndex).toBe(1);
    expect(game.currentPlayerIndex).toBe(0);
  });

  test('deals correct hand sizes and starts with empty personal discard piles', () => {
    const game = setupGame({
      playerNames: ['Alice', 'Bob'],
      teams: ['red', 'blue'],
    });

    // 2 players get 7 cards each
    expect(game.players[0].hand).toHaveLength(7);
    expect(game.players[1].hand).toHaveLength(7);
    expect(game.players[0].discardPile).toEqual([]);
    expect(game.players[1].discardPile).toEqual([]);

    // 104 - 14 = 90 in draw pile
    expect(game.drawPile).toHaveLength(90);
  });
});

describe('Turns, Discarding, and Auto-Draw', () => {
  test('playMove discards to personal pile, auto-draws replacement, and passes turn clockwise', () => {
    const game = setupGame({
      playerNames: ['Alice', 'Bob'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Player 0 (Alice) starts
    });

    const player0 = game.players[0];
    const initialDrawPileCount = game.drawPile.length;

    // Find a playable non-Jack card from Alice's hand
    const cardToPlay = player0.hand.find((c) => c.rank !== 'J')!;
    const matchingCells = getCellsForCard(game.board, cardToPlay);
    const targetCell: [number, number] = [matchingCells[0].row, matchingCells[0].col];

    // Alice plays the card
    const nextState = gameEngineReducer(game, {
      type: 'PLAY_MOVE',
      cell: targetCell,
      cardId: cardToPlay.id,
    });

    // Chip placed
    expect(nextState.board[targetCell[0]][targetCell[1]].chip).toBe('red');

    // Alice's personal discard pile received the card
    expect(nextState.players[0].discardPile).toContainEqual(cardToPlay);

    // Alice auto-drew a replacement (hand size remains 7)
    expect(nextState.players[0].hand).toHaveLength(7);
    expect(nextState.drawPile).toHaveLength(initialDrawPileCount - 1);

    // Turn passed clockwise to Player 1 (Bob)
    expect(nextState.currentPlayerIndex).toBe(1);
  });

  test('One-Eyed Jack removes opponent unlocked chip', () => {
    const game = setupGame({
      playerNames: ['Alice', 'Bob'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Alice starts
    });

    // Put a blue chip at [2, 2]
    game.board[2][2].chip = 'blue';

    // Give Alice a one-eyed Jack (J of spades)
    const oneEyedJack: Card = { rank: 'J', suit: 'spades', id: 'alice-1ej' };
    game.players[0].hand[0] = oneEyedJack;

    const nextState = gameEngineReducer(game, {
      type: 'PLAY_MOVE',
      cell: [2, 2],
      cardId: oneEyedJack.id,
    });

    // Blue chip removed
    expect(nextState.board[2][2].chip).toBeNull();
    expect(nextState.lastMove?.type).toBe('remove');
  });

  test('Two-Eyed Jack places chip on any unoccupied cell', () => {
    const game = setupGame({
      playerNames: ['Alice', 'Bob'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Alice starts
    });

    const twoEyedJack: Card = { rank: 'J', suit: 'diamonds', id: 'alice-2ej' };
    game.players[0].hand[0] = twoEyedJack;

    const nextState = gameEngineReducer(game, {
      type: 'PLAY_MOVE',
      cell: [4, 4],
      cardId: twoEyedJack.id,
    });

    expect(nextState.board[4][4].chip).toBe('red');
    expect(nextState.lastMove?.type).toBe('place');
  });
});

describe('Dead Card Handling', () => {
  test('detects dead card, discards it to personal pile, draws replacement, and preserves current turn', () => {
    const game = setupGame({
      playerNames: ['Alice', 'Bob'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Alice starts (index 0)
    });

    // Pick a card from Alice's hand
    const card = game.players[0].hand.find((c) => c.rank !== 'J')!;
    const matchingCells = getCellsForCard(game.board, card);

    // Cover both board positions with chips
    game.board[matchingCells[0].row][matchingCells[0].col].chip = 'blue';
    game.board[matchingCells[1].row][matchingCells[1].col].chip = 'red';

    const initialDrawCount = game.drawPile.length;

    // Discard the dead card
    const nextState = gameEngineReducer(game, {
      type: 'DISCARD_DEAD_CARD',
      cardId: card.id,
    });

    // Dead card is in Alice's discard pile
    expect(nextState.players[0].discardPile).toContainEqual(card);
    expect(nextState.players[0].hand).not.toContainEqual(card);

    // Auto-drew replacement: hand size is still 7
    expect(nextState.players[0].hand).toHaveLength(7);
    expect(nextState.drawPile).toHaveLength(initialDrawCount - 1);

    // Alice still keeps her turn to play!
    expect(nextState.currentPlayerIndex).toBe(0);
    expect(nextState.lastMove?.type).toBe('discard_dead');
  });
});

describe('Draw Pile Reshuffle', () => {
  test('when draw pile is empty, personal discard piles are shuffled into new draw pile', () => {
    const game = setupGame({
      playerNames: ['Alice', 'Bob'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Alice starts
    });

    // Empty the draw pile
    game.drawPile = [];

    // Place cards into players' personal discard piles
    const discarded1: Card = { rank: '2', suit: 'clubs', id: 'd1' };
    const discarded2: Card = { rank: '3', suit: 'clubs', id: 'd2' };
    game.players[0].discardPile = [discarded1];
    game.players[1].discardPile = [discarded2];

    // Alice plays a card
    const cardToPlay = game.players[0].hand.find((c) => c.rank !== 'J')!;
    const matching = getCellsForCard(game.board, cardToPlay)[0];

    const nextState = gameEngineReducer(game, {
      type: 'PLAY_MOVE',
      cell: [matching.row, matching.col],
      cardId: cardToPlay.id,
    });

    // Hand size maintained (7)
    expect(nextState.players[0].hand).toHaveLength(7);

    // Draw pile was replenished from the discard piles and has remaining cards
    expect(nextState.drawPile.length).toBeGreaterThan(0);
  });
});

describe('Full Scripted Win', () => {
  test('completes 2 sequences to win in a 2-team game', () => {
    const game = setupGame({
      playerNames: ['Alice', 'Bob'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Alice starts
    });

    // Pre-place 4 red chips on row 2, cols 1..4
    for (let c = 1; c <= 4; c++) {
      game.board[2][c].chip = 'red';
    }

    // Sequence 1: Alice places 5th chip at [2, 5] using a wild Two-Eyed Jack
    const wild1: Card = { rank: 'J', suit: 'diamonds', id: 'wild-1' };
    game.players[0].hand[0] = wild1;

    const afterSeq1 = gameEngineReducer(game, {
      type: 'PLAY_MOVE',
      cell: [2, 5],
      cardId: wild1.id,
    });

    expect(afterSeq1.sequenceCounts.red).toBe(1);
    expect(afterSeq1.winner).toBeNull();
    expect(afterSeq1.phase).toBe('playing');

    // Bob plays an arbitrary move on row 8, col 8
    const bobsCard: Card = { rank: 'J', suit: 'clubs', id: 'bob-wild' };
    afterSeq1.players[1].hand[0] = bobsCard;
    const afterBob = gameEngineReducer(afterSeq1, {
      type: 'PLAY_MOVE',
      cell: [8, 8],
      cardId: bobsCard.id,
    });

    // Turn is back to Alice (index 0)
    expect(afterBob.currentPlayerIndex).toBe(0);

    // Pre-place 4 red chips for Sequence 2 on row 4, cols 1..4
    for (let c = 1; c <= 4; c++) {
      afterBob.board[4][c].chip = 'red';
    }

    // Sequence 2: Alice places 5th chip at [4, 5] using a second Two-Eyed Jack
    const wild2: Card = { rank: 'J', suit: 'diamonds', id: 'wild-2' };
    afterBob.players[0].hand[0] = wild2;

    const afterSeq2 = gameEngineReducer(afterBob, {
      type: 'PLAY_MOVE',
      cell: [4, 5],
      cardId: wild2.id,
    });

    // Alice (Team Red) has 2 sequences -> Red WINS!
    expect(afterSeq2.sequenceCounts.red).toBe(2);
    expect(afterSeq2.winner).toBe('red');
    expect(afterSeq2.phase).toBe('finished');
  });
});

describe('Zustand Store & Auto-Save / Resume', () => {
  beforeEach(async () => {
    await storage.clear();
  });

  test('store auto-saves state after move and resumes correctly', async () => {
    const store = useGameStore.getState();

    // Start a new game
    store.startNewGame({
      playerNames: ['Alice', 'Bob'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Alice starts
    });

    const activeGame = useGameStore.getState().game;
    expect(activeGame).not.toBeNull();
    expect(activeGame?.currentPlayerIndex).toBe(0);

    // Alice selects and plays a card
    const card = activeGame!.players[0].hand.find((c) => c.rank !== 'J')!;
    const cell = getCellsForCard(activeGame!.board, card)[0];

    store.selectCard(card.id);
    store.playMove([cell.row, cell.col]);

    // Check that AsyncStorage contains the saved state
    const savedRaw = await storage.getItem(GAME_SAVE_STORAGE_KEY);
    expect(savedRaw).not.toBeNull();
    const parsed = JSON.parse(savedRaw!);
    expect(parsed.board[cell.row][cell.col].chip).toBe('red');

    // Simulate app restart: clear store state
    useGameStore.setState({ game: null, selectedCard: null, validTargets: [] });
    expect(useGameStore.getState().game).toBeNull();

    // Call resumeGame()
    const resumed = await useGameStore.getState().resumeGame();
    expect(resumed).toBe(true);

    const resumedGame = useGameStore.getState().game;
    expect(resumedGame).not.toBeNull();
    expect(resumedGame?.board[cell.row][cell.col].chip).toBe('red');
    expect(resumedGame?.currentPlayerIndex).toBe(1); // Bob's turn
  });
});
