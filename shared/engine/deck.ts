// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Deck & Dealing
// Pure TypeScript, zero UI imports.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Suit, Rank } from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const ALL_RANKS: Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
];

export const VALID_PLAYER_COUNTS = [2, 3, 4, 6, 8, 9, 10, 12] as const;
export type ValidPlayerCount = (typeof VALID_PLAYER_COUNTS)[number];

export const HAND_SIZES: Record<ValidPlayerCount, number> = {
  2: 7,
  3: 6,
  4: 6,
  6: 5,
  8: 4,
  9: 4,
  10: 3,
  12: 3,
};

/**
 * Creates 2 standard 52-card decks combined = 104 cards total, including 8 Jacks.
 */
export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (let deckIdx = 0; deckIdx < 2; deckIdx++) {
    for (const suit of SUITS) {
      for (const rank of ALL_RANKS) {
        cards.push({
          suit,
          rank,
          id: `${suit}-${rank}-${deckIdx}`,
        });
      }
    }
  }
  return cards;
}

/** Alias for createDeck */
export const buildDrawPile = createDeck;

/**
 * Fisher-Yates in-place shuffle algorithm.
 * Returns a new shuffled copy by default to prevent unwanted mutation.
 */
export function shuffle<T>(deck: T[]): T[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Returns the standard Sequence hand size for a given player count.
 */
export function handSizeForPlayerCount(playerCount: number): number {
  if (!(playerCount in HAND_SIZES)) {
    throw new Error(
      `Invalid player count: ${playerCount}. Allowed player counts are: ${VALID_PLAYER_COUNTS.join(', ')}`
    );
  }
  return HAND_SIZES[playerCount as ValidPlayerCount];
}

export interface DealResult {
  hands: Card[][];
  remainingDeck: Card[];
  drawPile: Card[];
}

/**
 * Deals cards to players according to the official Sequence hand-size table.
 */
export function deal(deck: Card[], playerCount: number): DealResult {
  const handSize = handSizeForPlayerCount(playerCount);
  const totalCardsNeeded = playerCount * handSize;

  if (deck.length < totalCardsNeeded) {
    throw new Error(
      `Deck does not have enough cards to deal (${deck.length} available, ${totalCardsNeeded} required).`
    );
  }

  const deckCopy = [...deck];
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  // Standard round-robin dealing
  for (let cardNum = 0; cardNum < handSize; cardNum++) {
    for (let p = 0; p < playerCount; p++) {
      const card = deckCopy.shift();
      if (card) {
        hands[p].push(card);
      }
    }
  }

  return {
    hands,
    remainingDeck: deckCopy,
    drawPile: deckCopy,
  };
}

/**
 * Jack Identification Helpers:
 * - Two-Eyed Jacks: Diamonds (J♦) and Clubs (J♣) -> Wild
 * - One-Eyed Jacks: Spades (J♠) and Hearts (J♥) -> Anti-Wild (remove opponent chip)
 */
export function isJack(card: Card): boolean {
  return card.rank === 'J';
}

export function isTwoEyedJack(card: Card): boolean {
  return card.rank === 'J' && (card.suit === 'diamonds' || card.suit === 'clubs');
}

export function isOneEyedJack(card: Card): boolean {
  return card.rank === 'J' && (card.suit === 'spades' || card.suit === 'hearts');
}

export function getJackType(card: Card): 'one-eyed' | 'two-eyed' | null {
  if (card.rank !== 'J') return null;
  if (card.suit === 'spades' || card.suit === 'hearts') return 'one-eyed';
  return 'two-eyed';
}
