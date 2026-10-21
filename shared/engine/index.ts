// ─────────────────────────────────────────────────────────────────────────────
// Sequence Game Engine – Public API (barrel)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  Suit,
  Rank,
  Card,
  Cell,
  BoardCell,
  TeamId,
  Player,
  GamePhase,
  GameState,
  SequenceLine,
  GameAction,
  PlaceChipAction,
  RemoveChipAction,
  ReplaceDeadCardAction,
  StartGameAction,
  ActionResult,
} from './types';

export {
  createDeck,
  buildDrawPile,
  shuffle,
  deal,
  HAND_SIZES,
  getJackType,
  isJack,
  isTwoEyedJack,
  isOneEyedJack,
  handSizeForPlayerCount,
  VALID_PLAYER_COUNTS,
} from './deck';

export {
  createBoard,
  createInitialBoard,
  getCellsForCard,
  validateBoardLayout,
  findCellsForCard,
  isDeadCard,
} from './board';

export type {
  DirectionType,
  Sequence,
  WinnerResult,
} from './sequenceDetector';

export {
  findSequences,
  findNewSequences,
  lockSequenceCells,
  requiredSequences,
  checkWinner,
  checkWin,
  isCorner,
  countsForTeam,
  countSharedChips,
} from './sequenceDetector';

export {
  gameReducer,
  currentPlayer,
  validTargetsForCard,
  deadCardsInHand,
} from './reducer';

export type {
  PlayerState,
  MoveType,
  LastMove,
  GameSettings,
  GameEngineState,
  SetupOptions,
  GameEngineAction,
} from './gameReducer';

export {
  setupGame,
  gameEngineReducer,
  drawReplacementCard,
  cutTheDeck,
  getCardValue,
} from './gameReducer';

export type {
  BotDifficulty,
  BotMove,
} from './bot';

export {
  chooseMove,
  getValidMoves,
} from './bot';
