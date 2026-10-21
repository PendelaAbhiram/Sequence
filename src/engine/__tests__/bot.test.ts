// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Bot AI Tests (Jest)
// Simulations for Easy, Medium, Hard, and Hard-vs-Easy win rates
// ─────────────────────────────────────────────────────────────────────────────

import { setupGame, gameEngineReducer, GameEngineState } from '../gameReducer';
import { chooseMove, BotDifficulty } from '../bot';
import { getCellsForCard } from '../board';
import { useGameStore, clearBotTimer } from '../../store/gameStore';
import type { Card, TeamId } from '../types';

/**
 * Runs a complete bot-vs-bot game between two bots.
 * Validates that every move is legal and the game never crashes.
 */
function runBotGame(
  difficultyP0: BotDifficulty,
  difficultyP1: BotDifficulty,
  maxMoves: number = 250
): {
  winner: TeamId | null;
  movesPlayed: number;
  completedNormally: boolean;
  errors: string[];
} {
  let state = setupGame({
    playerNames: ['Bot0', 'Bot1'],
    teams: ['red', 'blue'],
  });

  const errors: string[] = [];
  let moves = 0;

  while (state.phase === 'playing' && moves < maxMoves) {
    moves++;
    const currentPlayer = state.players[state.currentPlayerIndex];
    const diff = currentPlayer.seat === 0 ? difficultyP0 : difficultyP1;

    let move;
    try {
      move = chooseMove(state, currentPlayer.id, diff);
    } catch (err: any) {
      errors.push(`Bot error in chooseMove: ${err.message}`);
      break;
    }

    if (!move) {
      errors.push(`Bot returned null move while game in progress.`);
      break;
    }

    try {
      if (move.type === 'discard_dead') {
        state = gameEngineReducer(state, {
          type: 'DISCARD_DEAD_CARD',
          cardId: move.cardId,
        });
      } else {
        state = gameEngineReducer(state, {
          type: 'PLAY_MOVE',
          cell: move.cell,
          cardId: move.cardId,
        });
      }
    } catch (err: any) {
      errors.push(`Illegal move executed by bot [${diff}]: ${err.message}`);
      break;
    }
  }

  return {
    winner: state.winner,
    movesPlayed: moves,
    completedNormally: state.phase === 'finished',
    errors,
  };
}

describe('Bot Move Selection & Edge Cases', () => {
  afterEach(() => {
    clearBotTimer();
  });

  test('bot detects and chooses to discard a dead card', () => {
    const game = setupGame({
      playerNames: ['Bot1', 'Bot2'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Bot1 (Player 0) starts
    });

    const card = game.players[0].hand.find((c) => c.rank !== 'J')!;
    const matching = getCellsForCard(game.board, card);
    // Cover both board positions
    game.board[matching[0].row][matching[0].col].chip = 'blue';
    game.board[matching[1].row][matching[1].col].chip = 'red';

    const chosen = chooseMove(game, game.players[0].id, 'medium');
    expect(chosen).not.toBeNull();
    expect(chosen?.type).toBe('discard_dead');
    if (chosen?.type === 'discard_dead') {
      expect(chosen.cardId).toBe(card.id);
    }
  });

  test('bot correctly operates in a 3-team game', () => {
    const game3 = setupGame({
      playerNames: ['RedBot', 'BlueBot', 'GreenBot'],
      teams: ['red', 'blue', 'green'],
      forcedDealerIndex: 2, // RedBot starts
    });

    const move = chooseMove(game3, game3.players[0].id, 'hard');
    expect(move).not.toBeNull();
    expect(move?.type).toBe('play');
  });

  test('Medium and Hard prioritize completing immediate sequence', () => {
    const game = setupGame({
      playerNames: ['Bot1', 'Bot2'],
      teams: ['red', 'blue'],
      forcedDealerIndex: 1, // Bot1 starts
    });

    // Place 4 red chips at row 3, cols 1..4
    for (let c = 1; c <= 4; c++) {
      game.board[3][c].chip = 'red';
    }

    // Give Bot1 a Two-Eyed Jack so it can place at [3, 5]
    const wildJack: Card = { rank: 'J', suit: 'diamonds', id: 'bot-wild' };
    game.players[0].hand[0] = wildJack;

    const move = chooseMove(game, game.players[0].id, 'hard');
    expect(move).not.toBeNull();
    expect(move?.type).toBe('play');
    if (move?.type === 'play') {
      // Both [3, 0] and [3, 5] complete the sequence for the 4 chips at cols 1..4
      expect([[3, 0], [3, 5]]).toContainEqual(move.cell);
    }
  });
});

describe('Bot Simulations (50 Games per Difficulty)', () => {
  // Set generous Jest timeout for 150+ automated game simulations
  jest.setTimeout(45000);

  test('50 games of Easy vs Easy never crash or make illegal moves', () => {
    let completedCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = runBotGame('easy', 'easy');
      expect(result.errors).toHaveLength(0);
      if (result.completedNormally) completedCount++;
    }
    expect(completedCount).toBeGreaterThan(30);
  });

  test('50 games of Medium vs Medium never crash or make illegal moves', () => {
    let completedCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = runBotGame('medium', 'medium');
      expect(result.errors).toHaveLength(0);
      if (result.completedNormally) completedCount++;
    }
    expect(completedCount).toBeGreaterThan(40);
  });

  test('50 games of Hard vs Hard never crash or make illegal moves', () => {
    let completedCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = runBotGame('hard', 'hard');
      expect(result.errors).toHaveLength(0);
      if (result.completedNormally) completedCount++;
    }
    expect(completedCount).toBeGreaterThan(40);
  });

  test('Hard beats Easy in most games (Hard vs Easy tournament)', () => {
    let hardWins = 0;
    let easyWins = 0;
    const TOTAL_MATCHES = 30;

    for (let i = 0; i < TOTAL_MATCHES; i++) {
      // Alternate which bot plays first to eliminate any first-player advantage
      const hardIsP0 = i % 2 === 0;
      const p0Diff: BotDifficulty = hardIsP0 ? 'hard' : 'easy';
      const p1Diff: BotDifficulty = hardIsP0 ? 'easy' : 'hard';

      const result = runBotGame(p0Diff, p1Diff);
      expect(result.errors).toHaveLength(0);

      if (result.winner === 'red') {
        if (hardIsP0) hardWins++;
        else easyWins++;
      } else if (result.winner === 'blue') {
        if (hardIsP0) easyWins++;
        else hardWins++;
      }
    }

    // Hard must beat Easy in the clear majority of decided games
    expect(hardWins).toBeGreaterThan(easyWins);
  });
});

describe('Zustand Store Bot Integration', () => {
  afterEach(() => {
    clearBotTimer();
  });

  test('store triggers bot turn in bot mode when current player is a bot', (done) => {
    const store = useGameStore.getState();

    // Start a 2-player game in 'bot' mode
    store.startNewGame({
      playerNames: ['HumanPlayer', 'RobotPlayer'],
      teams: ['red', 'blue'],
      settings: { mode: 'bot' },
      forcedDealerIndex: 1, // Human starts (seat 0)
    });

    const game = useGameStore.getState().game;
    expect(game?.currentPlayerIndex).toBe(0);

    // Human plays a card
    const card = game!.players[0].hand.find((c) => c.rank !== 'J')!;
    const cell = getCellsForCard(game!.board, card)[0];

    store.selectCard(card.id);
    store.playMove([cell.row, cell.col]);

    // Now it's RobotPlayer's turn (seat 1, index 1)
    const afterHuman = useGameStore.getState().game;
    expect(afterHuman?.currentPlayerIndex).toBe(1);
    expect(useGameStore.getState().isCurrentPlayerBot()).toBe(true);
    expect(useGameStore.getState().isBotThinking).toBe(true);

    // After bot timer fires (mocked or awaited), robot plays
    // Let's verify that after the delay the bot executes a move
    setTimeout(() => {
      const stateAfterBot = useGameStore.getState().game;
      // Bot either played or turn advanced back to Human (seat 0)
      expect(stateAfterBot?.lastMove?.playerName).toBe('RobotPlayer');
      expect(stateAfterBot?.currentPlayerIndex).toBe(0);
      done();
    }, 1600); // 1.6s is after the 0.8-1.5s random timer
  });
});
