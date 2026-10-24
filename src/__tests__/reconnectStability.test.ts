// ─────────────────────────────────────────────────────────────────────────────
// Client Reconnect & Presence Stability Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

let appStateCallback: ((state: string) => void) | null = null;

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn((_event: string, callback: (state: string) => void) => {
      appStateCallback = callback;
      return { remove: jest.fn() };
    }),
  },
}));

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, val: string) => {
    mockStorage[key] = val;
  }),
  getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
  clear: jest.fn(async () => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  }),
}));

const mockSocketListeners: Record<string, ((...args: any[]) => void)[]> = {};
const mockSocketIoListeners: Record<string, ((...args: any[]) => void)[]> = {};
let mockSocketConnected = true;
const mockSocketEmit = jest.fn();

const mockSocketInstance: any = {
  get connected() {
    return mockSocketConnected;
  },
  on: jest.fn((event: string, handler: (...args: any[]) => void): any => {
    if (!mockSocketListeners[event]) mockSocketListeners[event] = [];
    mockSocketListeners[event].push(handler);
    return mockSocketInstance;
  }),
  off: jest.fn((event: string): any => {
    delete mockSocketListeners[event];
    return mockSocketInstance;
  }),
  emit: mockSocketEmit,
  connect: jest.fn((): any => {
    mockSocketConnected = true;
    return mockSocketInstance;
  }),
  disconnect: jest.fn((): any => {
    mockSocketConnected = false;
    return mockSocketInstance;
  }),
  io: {
    on: jest.fn((event: string, handler: (...args: any[]) => void): any => {
      if (!mockSocketIoListeners[event]) mockSocketIoListeners[event] = [];
      mockSocketIoListeners[event].push(handler);
      return mockSocketInstance.io;
    }),
  },
};

jest.mock('../services/socket', () => ({
  getSocket: jest.fn(() => mockSocketInstance),
  connectSocket: jest.fn(() => {
    mockSocketInstance.connect();
    return mockSocketInstance;
  }),
  disconnectSocket: jest.fn(() => {
    mockSocketInstance.disconnect();
  }),
}));

import { useOnlineStore } from '../store/onlineStore';

describe('Client Reconnect & Presence Synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketConnected = true;
    useOnlineStore.getState().resetOnlineState();
    useOnlineStore.getState().initSocket();
  });

  test('when app becomes active and socket is connected, emits lightweight presence:active event', async () => {
    useOnlineStore.setState({
      isOnline: true,
      room: { roomCode: 'ABCDEF', hostId: 'p1', status: 'playing', players: [], settings: { teamCount: 2, maxPlayers: 2 }, createdAt: Date.now() },
      playerId: 'player-1',
      reconnectToken: 'token-123',
    });

    mockSocketConnected = true;

    // Trigger foreground
    expect(appStateCallback).not.toBeNull();
    await appStateCallback!('active');

    // Must emit 'presence:active' with roomCode and playerId
    expect(mockSocketEmit).toHaveBeenCalledWith('presence:active', {
      roomCode: 'ABCDEF',
      playerId: 'player-1',
    });
  });

  test('when app becomes active and socket is disconnected, connects socket and rejoins', async () => {
    useOnlineStore.setState({
      isOnline: true,
      room: { roomCode: 'ABCDEF', hostId: 'p1', status: 'playing', players: [], settings: { teamCount: 2, maxPlayers: 2 }, createdAt: Date.now() },
      playerId: 'player-1',
      reconnectToken: 'token-123',
    });

    mockSocketConnected = false;

    // Mock rejoin callback response
    mockSocketEmit.mockImplementation((event: string, payload: any, callback?: Function) => {
      if (event === 'rejoin' && callback) {
        callback({
          success: true,
          room: { roomCode: 'ABCDEF', hostId: 'p1', status: 'playing', players: [], settings: { teamCount: 2, maxPlayers: 2 }, createdAt: Date.now() },
        });
      }
    });

    expect(appStateCallback).not.toBeNull();
    await appStateCallback!('active');

    // Must call socket.connect()
    expect(mockSocketInstance.connect).toHaveBeenCalled();
    // Must emit 'rejoin'
    expect(mockSocketEmit).toHaveBeenCalledWith(
      'rejoin',
      expect.objectContaining({ roomCode: 'ABCDEF', reconnectToken: 'token-123' }),
      expect.any(Function)
    );
  });

  test('rejoin replaces local state with server full state and clears reconnecting indicator', async () => {
    useOnlineStore.setState({
      isOnline: true,
      status: 'connecting',
      stateVersion: 1,
      room: { roomCode: 'ABCDEF', hostId: 'p1', status: 'playing', players: [], settings: { teamCount: 2, maxPlayers: 2 }, createdAt: Date.now() },
      playerId: 'player-1',
      reconnectToken: 'token-123',
      gameState: {
        roomCode: 'ABCDEF',
        version: 1,
        phase: 'playing',
        board: [],
        currentPlayerIndex: 0,
        turnPlayerId: 'player-1',
        hand: [{ id: 'card-1', suit: 'hearts', rank: '5' }],
        players: [],
        discardPiles: {},
        sequenceCounts: { red: 0, blue: 0, green: 0 },
        sequencesNeeded: 2,
        completedSequences: [],
        lastMove: null,
        winner: null,
        drawPileCount: 90,
      },
    });

    mockSocketEmit.mockImplementation((event: string, payload: any, callback?: Function) => {
      if (event === 'rejoin' && callback) {
        callback({
          success: true,
          room: { roomCode: 'ABCDEF', hostId: 'p1', status: 'playing', players: [], settings: { teamCount: 2, maxPlayers: 2 }, createdAt: Date.now() },
          gameState: {
            roomCode: 'ABCDEF',
            version: 5, // newer version
            phase: 'playing',
            board: [],
            currentPlayerIndex: 1,
            turnPlayerId: 'player-2',
            hand: [{ id: 'card-1', suit: 'hearts', rank: '5' }, { id: 'card-2', suit: 'clubs', rank: 'K' }],
            players: [],
            discardPiles: {},
            sequenceCounts: { red: 1, blue: 0, green: 0 },
            sequencesNeeded: 2,
            completedSequences: [],
            lastMove: null,
            winner: null,
            drawPileCount: 89,
          },
        });
      }
    });

    await useOnlineStore.getState().rejoinCurrentRoom();

    const state = useOnlineStore.getState();
    expect(state.status).toBe('connected'); // Reconnecting indicator cleared
    expect(state.stateVersion).toBe(5);
    expect(state.gameState?.turnPlayerId).toBe('player-2');
    expect(state.gameState?.hand).toHaveLength(2);
  });

  test('rejoin ignores stale server updates when version is older', async () => {
    useOnlineStore.setState({
      isOnline: true,
      status: 'connecting',
      stateVersion: 10,
      room: { roomCode: 'ABCDEF', hostId: 'p1', status: 'playing', players: [], settings: { teamCount: 2, maxPlayers: 2 }, createdAt: Date.now() },
      playerId: 'player-1',
      reconnectToken: 'token-123',
      gameState: {
        roomCode: 'ABCDEF',
        version: 10,
        phase: 'playing',
        board: [],
        currentPlayerIndex: 0,
        turnPlayerId: 'player-1',
        hand: [{ id: 'card-current', suit: 'hearts', rank: '5' }],
        players: [],
        discardPiles: {},
        sequenceCounts: { red: 0, blue: 0, green: 0 },
        sequencesNeeded: 2,
        completedSequences: [],
        lastMove: null,
        winner: null,
        drawPileCount: 90,
      },
    });

    mockSocketEmit.mockImplementation((event: string, payload: any, callback?: Function) => {
      if (event === 'rejoin' && callback) {
        callback({
          success: true,
          room: { roomCode: 'ABCDEF', hostId: 'p1', status: 'playing', players: [], settings: { teamCount: 2, maxPlayers: 2 }, createdAt: Date.now() },
          gameState: {
            roomCode: 'ABCDEF',
            version: 8, // Stale version!
            phase: 'playing',
            board: [],
            currentPlayerIndex: 1,
            turnPlayerId: 'player-2',
            hand: [{ id: 'card-stale', suit: 'clubs', rank: 'K' }],
            players: [],
            discardPiles: {},
            sequenceCounts: { red: 0, blue: 0, green: 0 },
            sequencesNeeded: 2,
            completedSequences: [],
            lastMove: null,
            winner: null,
            drawPileCount: 89,
          },
        });
      }
    });

    await useOnlineStore.getState().rejoinCurrentRoom();

    const state = useOnlineStore.getState();
    expect(state.stateVersion).toBe(10); // Not overwritten by stale version 8
    expect(state.gameState?.hand[0].id).toBe('card-current');
  });

  test('when room no longer exists (server restarted), sets clear error message and disconnected status', async () => {
    useOnlineStore.setState({
      isOnline: true,
      status: 'connecting',
      room: { roomCode: 'DEADRM', hostId: 'p1', status: 'playing', players: [], settings: { teamCount: 2, maxPlayers: 2 }, createdAt: Date.now() },
      playerId: 'player-1',
      reconnectToken: 'token-123',
    });

    mockSocketEmit.mockImplementation((event: string, payload: any, callback?: Function) => {
      if (event === 'rejoin' && callback) {
        callback({
          success: false,
          error: 'Room DEADRM does not exist.',
        });
      }
    });

    const res = await useOnlineStore.getState().rejoinCurrentRoom();
    expect(res).toBe(false);

    const state = useOnlineStore.getState();
    expect(state.status).toBe('disconnected');
    expect(state.errorMessage).toContain('Match has ended or server restarted');
  });
});
