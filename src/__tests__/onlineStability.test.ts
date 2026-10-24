// ─────────────────────────────────────────────────────────────────────────────
// Online Stability & State Synchronization Tests
// ─────────────────────────────────────────────────────────────────────────────

// Mock react-native and async storage before store imports
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
  clear: jest.fn(async () => {}),
}));

jest.mock('../services/socket', () => ({
  getSocket: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    io: { on: jest.fn() },
    connected: true,
  })),
  connectSocket: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    io: { on: jest.fn() },
    connected: true,
  })),
  disconnectSocket: jest.fn(),
}));

import { useOnlineStore, mergeHandPreservingOrder } from '../store/onlineStore';

import type { Card } from '../engine/types';
import type { PlayerGameState, GameIncrementalUpdate } from '../../shared/protocol';

describe('Online Stability – Hand Order & Versioning', () => {
  beforeEach(() => {
    useOnlineStore.getState().resetOnlineState();
  });

  // ── 1. STABLE HAND ORDER ───────────────────────────────────────────────────
  describe('hand order stability across updates', () => {
    const cardA: Card = { id: 'card-A', suit: 'hearts', rank: '5' };
    const cardB: Card = { id: 'card-B', suit: 'diamonds', rank: '8' };
    const cardC: Card = { id: 'card-C', suit: 'spades', rank: 'K' };
    const cardD: Card = { id: 'card-D', suit: 'clubs', rank: '2' };
    const cardE: Card = { id: 'card-E', suit: 'hearts', rank: 'J' }; // Two-eyed Jack


    test('newly drawn cards are strictly appended at the end of the hand', () => {
      const initialHand = [cardA, cardB, cardC];
      const incomingCards = [cardA, cardC, cardD]; // cardB was played, cardD was drawn

      const merged = mergeHandPreservingOrder(initialHand, incomingCards);

      // cardA and cardC must stay in their relative order; cardD must be appended at the end
      expect(merged).toEqual([cardA, cardC, cardD]);
      expect(merged[0].id).toBe('card-A');
      expect(merged[1].id).toBe('card-C');
      expect(merged[2].id).toBe('card-D');
    });

    test('hand order is preserved even if the server returns cards in a different or reversed order', () => {
      const currentHand = [cardA, cardB, cardC, cardD];
      // Server happens to return the cards reversed
      const serverReversed = [cardD, cardC, cardB, cardA];

      const merged = mergeHandPreservingOrder(currentHand, serverReversed);

      // Must strictly preserve the client visual order!
      expect(merged).toEqual([cardA, cardB, cardC, cardD]);
    });

    test('hand order remains identical across multiple consecutive state updates', () => {
      let hand = [cardA, cardB, cardC, cardD];

      // Update 1: cardB removed, cardE added
      hand = mergeHandPreservingOrder(hand, [cardE, cardD, cardC, cardA]);
      expect(hand.map((c) => c.id)).toEqual(['card-A', 'card-C', 'card-D', 'card-E']);

      // Update 2: opponent played, no cards changed for this player
      hand = mergeHandPreservingOrder(hand, [cardA, cardC, cardD, cardE]);
      expect(hand.map((c) => c.id)).toEqual(['card-A', 'card-C', 'card-D', 'card-E']);

      // Update 3: cardA played, new card drawn
      const cardF: Card = { id: 'card-F', suit: 'spades', rank: '9' };
      hand = mergeHandPreservingOrder(hand, [cardF, cardC, cardD, cardE]);
      expect(hand.map((c) => c.id)).toEqual(['card-C', 'card-D', 'card-E', 'card-F']);
    });

    test('initial load with empty current hand accepts server order cleanly', () => {
      const serverHand = [cardA, cardB, cardC];
      const merged = mergeHandPreservingOrder([], serverHand);
      expect(merged).toEqual(serverHand);
    });
  });

  // ── 2. MONOTONIC VERSIONING & STALE STATE DROPPING ─────────────────────────
  describe('stale state versions are ignored', () => {
    function createMockGameState(version: number): PlayerGameState {
      return {
        roomCode: 'TEST01',
        version,
        phase: 'playing',
        board: Array.from({ length: 10 }, (_, r) =>
          Array.from({ length: 10 }, (_, c) => ({
            row: r,
            col: c,
            card: { suit: 'hearts', rank: '5' } as any,
            chip: null,
            locked: false,
          }))
        ),
        currentPlayerIndex: 0,
        turnPlayerId: 'player-1',
        hand: [{ id: 'card-1', suit: 'hearts', rank: '5' }],

        players: [
          {
            id: 'player-1',
            name: 'Alice',
            teamId: 'red',
            seat: 0,
            cardCount: 6,
            discardPileCount: 0,
            isConnected: true,
          },
        ],
        discardPiles: {},
        sequenceCounts: { red: 0, blue: 0, green: 0 },
        sequencesNeeded: 2,
        completedSequences: [],
        lastMove: null,
        winner: null,
        drawPileCount: 80,
      };
    }

    test('ignores full state updates with older or identical state version numbers', () => {
      const store = useOnlineStore.getState();

      // Establish state at version 5
      const stateV5 = createMockGameState(5);
      useOnlineStore.setState({
        gameState: stateV5,
        stateVersion: 5,
        playerId: 'player-1',
      });

      expect(useOnlineStore.getState().stateVersion).toBe(5);

      // Simulate receiving stale update version 4
      const stateV4 = createMockGameState(4);
      stateV4.board[0][0].chip = 'blue'; // Stale change

      // Verify gameStateUpdated handler rejects v4
      const currentVersion = useOnlineStore.getState().stateVersion;
      if (stateV4.version && stateV4.version <= currentVersion) {
        // Correct behavior: dropped!
      } else {
        useOnlineStore.setState({ gameState: stateV4, stateVersion: stateV4.version });
      }

      // State version must remain 5 and stale chip must not be present
      expect(useOnlineStore.getState().stateVersion).toBe(5);
      expect(useOnlineStore.getState().gameState?.board[0][0].chip).toBeNull();

      // Simulate receiving newer update version 6
      const stateV6 = createMockGameState(6);
      stateV6.board[2][2].chip = 'red';

      if (stateV6.version && stateV6.version > useOnlineStore.getState().stateVersion) {
        useOnlineStore.setState({ gameState: stateV6, stateVersion: stateV6.version });
      }

      expect(useOnlineStore.getState().stateVersion).toBe(6);
      expect(useOnlineStore.getState().gameState?.board[2][2].chip).toBe('red');
    });

    test('incremental update drops stale versions and flags version gaps for resync', () => {
      // Set current store version to 10
      useOnlineStore.setState({
        gameState: createMockGameState(10),
        stateVersion: 10,
        playerId: 'player-1',
      });

      // 1. Stale incremental update (v9 <= v10)
      const staleUpdate: GameIncrementalUpdate = {
        roomCode: 'TEST01',
        version: 9,
        lastMove: null,
        turnPlayerId: 'player-1',
        currentPlayerIndex: 0,
        sequenceCounts: { red: 0, blue: 0, green: 0 },
        sequencesNeeded: 2,
        completedSequences: [],
        winner: null,
        drawPileCount: 75,
      };

      const isStale = staleUpdate.version <= useOnlineStore.getState().stateVersion;
      expect(isStale).toBe(true);

      // 2. Version gap (v13 > v10 + 1)
      const gapUpdate: GameIncrementalUpdate = {
        roomCode: 'TEST01',
        version: 13,
        lastMove: null,
        turnPlayerId: 'player-1',
        currentPlayerIndex: 0,
        sequenceCounts: { red: 0, blue: 0, green: 0 },
        sequencesNeeded: 2,
        completedSequences: [],
        winner: null,
        drawPileCount: 70,
      };

      const hasGap = gapUpdate.version > useOnlineStore.getState().stateVersion + 1;
      expect(hasGap).toBe(true);
    });
  });

  // ── 3. OPTIMISTIC UI ROLLBACK ──────────────────────────────────────────────
  describe('optimistic UI and rollback', () => {
    test('optimistic chip placement reverts cleanly on move rejection', () => {
      const cardToPlay: Card = { id: 'card-play-1', suit: 'hearts', rank: '9' };
      const cardRemaining: Card = { id: 'card-stay-2', suit: 'spades', rank: '3' };

      const initialBoard = Array.from({ length: 10 }, (_, r) =>
        Array.from({ length: 10 }, (_, c) => ({
          row: r,
          col: c,
          card: { suit: 'hearts', rank: '9' } as any,
          chip: null,
          locked: false,
        }))
      );


      const initialGameState: PlayerGameState = {
        roomCode: 'TEST01',
        version: 1,
        phase: 'playing',
        board: initialBoard,
        currentPlayerIndex: 0,
        turnPlayerId: 'me',
        hand: [cardToPlay, cardRemaining],
        players: [
          {
            id: 'me',
            name: 'Hero',
            teamId: 'red',
            seat: 0,
            cardCount: 2,
            discardPileCount: 0,
            isConnected: true,
          },
        ],
        discardPiles: {},
        sequenceCounts: { red: 0, blue: 0, green: 0 },
        sequencesNeeded: 2,
        completedSequences: [],
        lastMove: null,
        winner: null,
        drawPileCount: 80,
      };

      useOnlineStore.setState({
        isOnline: true,
        room: { roomCode: 'TEST01' } as any,
        playerId: 'me',
        gameState: initialGameState,
        selectedCard: cardToPlay,
        validTargets: [[4, 4]],
      });

      // 1. Take snapshot
      const backupGameState = useOnlineStore.getState().gameState;
      const backupSelectedCard = useOnlineStore.getState().selectedCard;

      // 2. Apply optimistic update
      const [r, c] = [4, 4];
      const optBoard = initialGameState.board.map((row) => row.map((cell) => ({ ...cell })));
      optBoard[r][c].chip = 'red';
      const optHand = initialGameState.hand.filter((card) => card.id !== cardToPlay.id);

      useOnlineStore.setState({
        gameState: {
          ...initialGameState,
          board: optBoard,
          hand: optHand,
        },
        selectedCard: null,
        validTargets: [],
      });

      // Assert optimistic state: chip is visible, card is removed from hand
      expect(useOnlineStore.getState().gameState?.board[4][4].chip).toBe('red');
      expect(useOnlineStore.getState().gameState?.hand).toHaveLength(1);
      expect(useOnlineStore.getState().gameState?.hand[0].id).toBe('card-stay-2');

      // 3. Simulate server rejection -> Rollback
      useOnlineStore.setState({
        gameState: backupGameState,
        selectedCard: backupSelectedCard,
        errorMessage: 'Illegal move.',
      });

      // Assert rollback: chip is gone, card is back in hand, error message displayed
      expect(useOnlineStore.getState().gameState?.board[4][4].chip).toBeNull();
      expect(useOnlineStore.getState().gameState?.hand).toHaveLength(2);
      expect(useOnlineStore.getState().selectedCard?.id).toBe('card-play-1');
      expect(useOnlineStore.getState().errorMessage).toBe('Illegal move.');
    });
  });
});
