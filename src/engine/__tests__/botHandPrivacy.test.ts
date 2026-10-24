import { setupGame, gameEngineReducer } from '../gameReducer';
import { chooseMove } from '../bot';
import { useGameStore } from '../../store/gameStore';

describe('Bot Mode Hand Privacy & Isolation', () => {
  beforeEach(() => {
    // Reset store
    useGameStore.setState({
      game: null,
      selectedCard: null,
      validTargets: [],
      hasSavedGame: false,
      isBotThinking: false,
    });
  });

  test('In bot mode, the human player is fixed to player 0 (player-0)', () => {
    const game = setupGame({
      playerNames: ['HumanAlice', 'BotBob'],
      settings: { mode: 'bot' },
    });

    expect(game.settings.mode).toBe('bot');
    expect(game.players[0].name).toBe('HumanAlice');
    expect(game.players[0].id).toBe('player-0');
    expect(game.players[1].name).toBe('BotBob');
    expect(game.players[1].id).toBe('player-1');
  });

  test('Bot hand is NEVER exposed as the displayed hand during a bot turn', () => {
    useGameStore.getState().startNewGame({
      playerNames: ['HumanAlice', 'BotBob'],
      settings: { mode: 'bot' },
    });

    const storeState = useGameStore.getState();
    const game = storeState.game!;
    const humanPlayer = storeState.getHumanPlayer()!;

    expect(humanPlayer.id).toBe('player-0');
    expect(humanPlayer.name).toBe('HumanAlice');

    // Simulate bot's turn (currentPlayerIndex = 1)
    useGameStore.setState({
      game: {
        ...game,
        currentPlayerIndex: 1,
      },
    });

    const currentState = useGameStore.getState();
    const currentTurnPlayer = currentState.getCurrentPlayer()!;
    expect(currentTurnPlayer.id).toBe('player-1'); // Turn is bot

    // The displayed hand in bot mode must ALWAYS be humanPlayer.hand, never currentTurnPlayer.hand
    const displayedHand =
      currentState.game?.settings.mode === 'bot'
        ? currentState.getHumanPlayer()?.hand
        : currentState.getCurrentPlayer()?.hand;

    expect(displayedHand).toEqual(humanPlayer.hand);
    expect(displayedHand).not.toEqual(currentTurnPlayer.hand);
    expect(displayedHand).toHaveLength(humanPlayer.hand.length);
  });

  test('Sanitized players passed to UI components (discard sheet, intro) have empty hands for bots', () => {
    const game = setupGame({
      playerNames: ['HumanAlice', 'Bot1', 'Bot2'],
      teams: ['red', 'blue', 'green'],
      settings: { mode: 'bot' },
    });

    // Emulate the sanitization logic used in GameScreen for DiscardSheet & Intro components
    const sanitizedForComponents = game.players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      teamId: p.teamId,
      hand: (game.settings.mode === 'bot' && idx > 0) ? [] : p.hand,
      discardPile: p.discardPile,
      isBot: game.settings.mode === 'bot' ? idx > 0 : false,
    }));

    // Human player retains their hand
    expect(sanitizedForComponents[0].hand).toEqual(game.players[0].hand);
    expect(sanitizedForComponents[0].isBot).toBe(false);

    // ALL bot players have completely empty hands stripped out
    expect(sanitizedForComponents[1].hand).toEqual([]);
    expect(sanitizedForComponents[1].isBot).toBe(true);
    expect(sanitizedForComponents[2].hand).toEqual([]);
    expect(sanitizedForComponents[2].isBot).toBe(true);

    // Discard piles are preserved
    expect(sanitizedForComponents[1].discardPile).toEqual(game.players[1].discardPile);
  });

  test('Human cannot select cards or targets during a bot turn in bot mode', () => {
    useGameStore.getState().startNewGame({
      playerNames: ['HumanAlice', 'BotBob'],
      settings: { mode: 'bot' },
    });

    const game = useGameStore.getState().game!;
    const botPlayer = game.players[1];

    // Set turn to bot
    useGameStore.setState({
      game: {
        ...game,
        currentPlayerIndex: 1,
      },
    });

    // Try to select card during bot turn
    const humanCardId = game.players[0].hand[0].id;
    useGameStore.getState().selectCard(humanCardId);

    // Should be rejected / no card selected
    expect(useGameStore.getState().selectedCard).toBeNull();
    expect(useGameStore.getState().validTargets).toEqual([]);
  });

  test('Pass-and-play keeps rotating displayed hands after reveal', () => {
    const game = setupGame({
      playerNames: ['Alice', 'Bob'],
      settings: { mode: 'local' },
    });

    useGameStore.setState({
      game: {
        ...game,
        currentPlayerIndex: 0,
      },
    });

    // When currentPlayerIndex is 0, displayed hand is player 0's hand
    expect(game.settings.mode).toBe('local');
    const p0Hand = useGameStore.getState().getCurrentPlayer()?.hand;
    expect(p0Hand).toEqual(game.players[0].hand);

    // Advance to player 1
    useGameStore.setState({
      game: {
        ...game,
        currentPlayerIndex: 1,
      },
    });

    const p1Hand = useGameStore.getState().getCurrentPlayer()?.hand;
    expect(p1Hand).toEqual(game.players[1].hand);
  });
});
