// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – State Machine & Reducer
// Pure TypeScript, zero UI imports.
// ─────────────────────────────────────────────────────────────────────────────

import type { Cell, Card, TeamId, Rank, Suit } from './types';
import { createBoard, isDeadCard } from './board';
import { createDeck, shuffle, handSizeForPlayerCount, isOneEyedJack, isTwoEyedJack } from './deck';
import {
  findSequences,
  lockSequenceCells,
  checkWinner,
  Sequence,
} from './sequenceDetector';

export interface PlayerState {
  id: string;
  name: string;
  teamId: TeamId;
  seat: number;
  hand: Card[];
  discardPile: Card[];
}

export type MoveType = 'place' | 'remove' | 'discard_dead';

export interface LastMove {
  playerId: string;
  playerName: string;
  teamId: TeamId;
  card: Card;
  cell?: [number, number];
  type: MoveType;
  timestamp: number;
}

export interface GameSettings {
  mode: 'bot' | 'local';
}

export type GamePhase = 'setup' | 'playing' | 'finished';

export interface GameEngineState {
  teams: TeamId[];
  players: PlayerState[];
  board: Cell[][];
  drawPile: Card[];
  currentPlayerIndex: number;
  phase: GamePhase;
  sequenceCounts: Record<TeamId, number>;
  completedSequences: Sequence[];
  winner: TeamId | null;
  lastMove: LastMove | null;
  settings: GameSettings;
  dealerIndex: number;
  selectedCardId: string | null;
  cutCards?: Card[];
  reshuffleOccurred?: boolean;
}

export interface SetupOptions {
  playerNames: string[];
  teams?: TeamId[];
  settings?: GameSettings;
  customDeck?: Card[];
  /** For testing: force a specific dealer index rather than random cut */
  forcedDealerIndex?: number;
}

const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

const SUIT_VALUES: Record<Suit, number> = {
  clubs: 1,
  diamonds: 2,
  hearts: 3,
  spades: 4,
};

export function getCardValue(card: Card): number {
  return RANK_VALUES[card.rank] * 10 + SUIT_VALUES[card.suit];
}

/**
 * Cut the deck:
 * Each player cuts a card. Lowest card deals.
 * (Ties broken by suit: clubs < diamonds < hearts < spades).
 */
export function cutTheDeck(playerCount: number, deck: Card[]): { dealerIndex: number; cutCards: Card[] } {
  const cutCards: Card[] = [];
  let lowestVal = Infinity;
  let dealerIndex = 0;

  for (let p = 0; p < playerCount; p++) {
    const card = deck[p % deck.length];
    cutCards.push(card);
    const val = getCardValue(card);
    if (val < lowestVal) {
      lowestVal = val;
      dealerIndex = p;
    }
  }

  return { dealerIndex, cutCards };
}

/**
 * Initializes a new game with alternate seating, cut-the-deck dealer, and dealt hands.
 */
export function setupGame(options: SetupOptions): GameEngineState {
  const {
    playerNames,
    settings = { mode: 'local' },
    customDeck,
    forcedDealerIndex,
  } = options;

  const playerCount = playerNames.length;
  // Determine teams: default to 2 teams (red, blue) or 3 teams if 3, 6, 9 players
  let teams = options.teams;
  if (!teams) {
    teams = (playerCount === 3 || playerCount === 9) ? ['red', 'blue', 'green'] : ['red', 'blue'];
  }

  // Hand size for player count
  const handSize = handSizeForPlayerCount(playerCount);

  // Alternate seating: player at seat i gets teams[i % teams.length]
  const players: PlayerState[] = playerNames.map((name, idx) => ({
    id: `player-${idx}`,
    name,
    teamId: teams[idx % teams.length],
    seat: idx,
    hand: [],
    discardPile: [],
  }));

  // Create & shuffle deck
  const deck = customDeck ? [...customDeck] : shuffle(createDeck());

  // Cut the deck: lowest card deals, player to dealer's left starts
  let dealerIndex: number;
  let cutCards: Card[] = [];
  if (forcedDealerIndex !== undefined) {
    dealerIndex = forcedDealerIndex;
  } else {
    const cutResult = cutTheDeck(playerCount, deck);
    dealerIndex = cutResult.dealerIndex;
    cutCards = cutResult.cutCards;
  }

  // Player to the dealer's left starts (clockwise: (dealer + 1) % playerCount)
  const startingPlayerIndex = (dealerIndex + 1) % playerCount;

  // Deal hands
  for (let i = 0; i < handSize; i++) {
    for (let p = 0; p < playerCount; p++) {
      const card = deck.shift();
      if (card) {
        players[p].hand.push(card);
      }
    }
  }

  const sequenceCounts: Record<TeamId, number> = {
    red: 0,
    blue: 0,
    green: 0,
  };

  return {
    teams,
    players,
    board: createBoard(),
    drawPile: deck,
    currentPlayerIndex: startingPlayerIndex,
    phase: 'playing',
    sequenceCounts,
    completedSequences: [],
    winner: null,
    lastMove: null,
    settings,
    dealerIndex,
    selectedCardId: null,
    cutCards,
    reshuffleOccurred: false,
  };
}

/**
 * Auto-draws a replacement card from drawPile.
 * If drawPile is empty, all personal discard piles are collected, shuffled,
 * and become the new drawPile!
 */
export function drawReplacementCard(
  drawPile: Card[],
  players: PlayerState[]
): { drawnCard: Card | null; newDrawPile: Card[]; reshuffled: boolean } {
  let pile = [...drawPile];
  let reshuffled = false;

  if (pile.length === 0) {
    // Collect all personal discard piles
    const collectedDiscards: Card[] = [];
    for (const player of players) {
      collectedDiscards.push(...player.discardPile);
      player.discardPile = [];
    }

    if (collectedDiscards.length > 0) {
      pile = shuffle(collectedDiscards);
      reshuffled = true;
    }
  }

  const drawnCard = pile.shift() ?? null;
  return { drawnCard, newDrawPile: pile, reshuffled };
}

export type GameEngineAction =
  | { type: 'SELECT_CARD'; cardId: string | null }
  | { type: 'PLAY_MOVE'; cell: [number, number]; cardId?: string }
  | { type: 'DISCARD_DEAD_CARD'; cardId: string }
  | { type: 'END_TURN' }
  | { type: 'RESET_GAME'; options: SetupOptions };

/**
 * Game State Reducer
 */
export function gameEngineReducer(
  state: GameEngineState,
  action: GameEngineAction
): GameEngineState {
  switch (action.type) {
    case 'SELECT_CARD': {
      return {
        ...state,
        selectedCardId: action.cardId,
      };
    }

    case 'PLAY_MOVE': {
      if (state.phase !== 'playing') {
        throw new Error('Game is not in playing phase.');
      }

      const currentPlayer = state.players[state.currentPlayerIndex];
      const cardId = action.cardId ?? state.selectedCardId;
      if (!cardId) {
        throw new Error('No card selected for move.');
      }

      const cardIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) {
        throw new Error(`Card with id ${cardId} is not in current player's hand.`);
      }

      const card = currentPlayer.hand[cardIndex];
      const [r, c] = action.cell;
      if (r < 0 || r > 9 || c < 0 || c > 9) {
        throw new Error(`Coordinates [${r}, ${c}] are out of bounds.`);
      }

      // Clone board and players
      const nextBoard = state.board.map((row) => row.map((cell) => ({ ...cell })));
      const nextPlayers = state.players.map((p) => ({
        ...p,
        hand: [...p.hand],
        discardPile: [...p.discardPile],
      }));
      const nextPlayer = nextPlayers[state.currentPlayerIndex];

      const targetCell = nextBoard[r][c];
      let moveType: MoveType = 'place';

      if (targetCell.card === 'CORNER') {
        throw new Error('Cannot target a corner space.');
      }

      if (isTwoEyedJack(card)) {
        // Wild Jack: place on any unoccupied non-corner cell
        if (targetCell.chip !== null) {
          throw new Error('Cell is already occupied by a chip.');
        }
        targetCell.chip = nextPlayer.teamId;
      } else if (isOneEyedJack(card)) {
        // Anti-Wild Jack: remove an opponent's chip that is NOT locked
        if (targetCell.chip === null) {
          throw new Error('No chip to remove at this cell.');
        }
        if (targetCell.chip === nextPlayer.teamId) {
          throw new Error('Cannot remove your own team chip.');
        }
        if (targetCell.locked) {
          throw new Error('Cannot remove a chip from a completed sequence.');
        }
        targetCell.chip = null;
        moveType = 'remove';
      } else {
        // Normal card: must match cell card and cell must be empty
        if (targetCell.card.suit !== card.suit || targetCell.card.rank !== card.rank) {
          throw new Error(
            `Card ${card.rank} of ${card.suit} does not match cell card ${targetCell.card.rank} of ${targetCell.card.suit}.`
          );
        }
        if (targetCell.chip !== null) {
          throw new Error('Cell is already occupied.');
        }
        targetCell.chip = nextPlayer.teamId;
      }

      // Discard played card to player's personal discard pile
      nextPlayer.hand.splice(cardIndex, 1);
      nextPlayer.discardPile.push(card);

      // Auto-draw replacement card (reshuffling discard piles if draw pile is empty)
      const { drawnCard, newDrawPile, reshuffled } = drawReplacementCard(state.drawPile, nextPlayers);
      if (drawnCard) {
        nextPlayer.hand.push(drawnCard);
      }

      // Run sequence detection
      const teamSequences = findSequences(nextBoard, nextPlayer.teamId);
      const lockedBoard = lockSequenceCells(nextBoard, teamSequences);

      const nextSequenceCounts = {
        ...state.sequenceCounts,
        [nextPlayer.teamId]: teamSequences.length,
      };

      // Check win condition
      const winCheck = checkWinner(lockedBoard, state.teams);
      const winner = winCheck.winner;
      const nextPhase: GamePhase = winner ? 'finished' : 'playing';

      // Next player (clockwise)
      const nextPlayerIndex = winner
        ? state.currentPlayerIndex
        : (state.currentPlayerIndex + 1) % nextPlayers.length;

      return {
        ...state,
        board: lockedBoard,
        players: nextPlayers,
        drawPile: newDrawPile,
        currentPlayerIndex: nextPlayerIndex,
        phase: nextPhase,
        sequenceCounts: nextSequenceCounts,
        completedSequences: teamSequences,
        winner,
        selectedCardId: null,
        reshuffleOccurred: reshuffled,
        lastMove: {
          playerId: nextPlayer.id,
          playerName: nextPlayer.name,
          teamId: nextPlayer.teamId,
          card,
          cell: action.cell,
          type: moveType,
          timestamp: Date.now(),
        },
      };
    }

    case 'DISCARD_DEAD_CARD': {
      if (state.phase !== 'playing') {
        throw new Error('Game is not in playing phase.');
      }

      const currentPlayer = state.players[state.currentPlayerIndex];
      const cardIndex = currentPlayer.hand.findIndex((c) => c.id === action.cardId);
      if (cardIndex === -1) {
        throw new Error('Card not found in current player hand.');
      }

      const card = currentPlayer.hand[cardIndex];
      if (!isDeadCard(state.board, card)) {
        throw new Error('Card is not dead. Both of its board positions are not occupied.');
      }

      const nextPlayers = state.players.map((p) => ({
        ...p,
        hand: [...p.hand],
        discardPile: [...p.discardPile],
      }));
      const nextPlayer = nextPlayers[state.currentPlayerIndex];

      // Discard dead card to personal pile
      nextPlayer.hand.splice(cardIndex, 1);
      nextPlayer.discardPile.push(card);

      // Auto-draw replacement card
      const { drawnCard, newDrawPile, reshuffled } = drawReplacementCard(state.drawPile, nextPlayers);
      if (drawnCard) {
        nextPlayer.hand.push(drawnCard);
      }

      return {
        ...state,
        players: nextPlayers,
        drawPile: newDrawPile,
        selectedCardId: null,
        reshuffleOccurred: reshuffled,
        lastMove: {
          playerId: nextPlayer.id,
          playerName: nextPlayer.name,
          teamId: nextPlayer.teamId,
          card,
          type: 'discard_dead',
          timestamp: Date.now(),
        },
      };
    }

    case 'END_TURN': {
      if (state.phase !== 'playing') return state;
      return {
        ...state,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
        selectedCardId: null,
      };
    }

    case 'RESET_GAME': {
      return setupGame(action.options);
    }

    default:
      return state;
  }
}
