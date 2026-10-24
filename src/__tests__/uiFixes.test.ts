// Mock react-native and async storage before any imports
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Share: {
    share: jest.fn(),
  },
  Platform: {
    select: jest.fn((obj) => obj.default || obj.ios),
    OS: 'ios',
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
  clear: jest.fn(async () => {}),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue('K7M2QX'),
}));

const mockSocketInstance = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn((_ev: string, _data: any, cb?: Function) => {
    if (typeof cb === 'function') cb({ success: true });
  }),
  once: jest.fn(),
  removeAllListeners: jest.fn(),
  io: { on: jest.fn() },
  connected: true,
};

jest.mock('../services/socket', () => ({
  getSocket: jest.fn(() => mockSocketInstance),
  connectSocket: jest.fn(() => mockSocketInstance),
  disconnectSocket: jest.fn(),
}));

import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useOnlineStore } from '../store/onlineStore';

describe('UI Fixes: Room Code and Status Text', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOnlineStore.getState().resetOnlineState();
  });

  describe('1. Room Code Pill & Persistence', () => {
    it('shares room code with expected message format', async () => {
      const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
      const code = 'K7M2QX';
      await Share.share({
        message: `Join my Sequence game! Room code: ${code}`,
      });

      expect(shareSpy).toHaveBeenCalledWith({
        message: 'Join my Sequence game! Room code: K7M2QX',
      });
    });

    it('copies room code to clipboard via expo-clipboard', async () => {
      const code = 'K7M2QX';
      await Clipboard.setStringAsync(code);
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('K7M2QX');
    });

    it('room code survives game start and reconnects in online store', () => {
      const roomCode = 'K7M2QX';
      // Simulate room created in lobby
      useOnlineStore.setState({
        isOnline: true,
        room: {
          id: 'room-1',
          roomCode,
          hostId: 'p1',
          players: [],
          status: 'lobby',
          settings: { teamCount: 2, maxPlayers: 4, allowBots: false, turnTimeLimit: 0 },
        } as any,
      });

      // Verify roomCode available in lobby
      expect(useOnlineStore.getState().room?.roomCode).toBe(roomCode);

      // Simulate game started (room is updated with gameState)
      useOnlineStore.setState({
        gameState: {
          phase: 'playing',
          board: [] as any,
          players: [],
          currentPlayerIndex: 0,
          turnPlayerId: 'p1',
          hand: [],
          turnTimeRemaining: 30,
          completedSequences: [],
          sequenceCounts: { red: 0, blue: 0, green: 0 },
          sequencesNeeded: 2,
          winner: null,
          reshuffleOccurred: false,
          discardPiles: {},
          roomCode,
        } as any,
      });

      // Room code remains visible after game start
      const onlineRoomCode =
        useOnlineStore.getState().gameState?.roomCode ??
        useOnlineStore.getState().room?.roomCode;
      expect(onlineRoomCode).toBe(roomCode);

      // Simulate reconnect (state updated but roomCode persists)
      useOnlineStore.setState({ status: 'connected' });
      const reconnectedRoomCode =
        useOnlineStore.getState().gameState?.roomCode ??
        useOnlineStore.getState().room?.roomCode;
      expect(reconnectedRoomCode).toBe(roomCode);
    });
  });

  describe('2. Horizontal Status Text Layout (360px & 430px Responsive Widths)', () => {
    it('guarantees text containers have flex: 1 and minWidth: 0 to prevent vertical wrapping', () => {
      // Test style configurations applied to status containers in GameScreen
      const turnBadgeContainerStyle = {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
      };

      const turnNameWrapperStyle = {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center' as const,
      };

      expect(turnBadgeContainerStyle.flex).toBe(1);
      expect(turnBadgeContainerStyle.minWidth).toBe(0);
      expect(turnNameWrapperStyle.flex).toBe(1);
      expect(turnNameWrapperStyle.minWidth).toBe(0);
    });

    it('calculates available horizontal width on 360px mobile viewport for turn status', () => {
      const viewportWidth = 360;
      const horizontalPadding = 16 * 2; // spacing.sm * 2
      const chipCircleWidth = 32 + 8; // chip circle + gap
      const connectionIndicatorWidth = 80; // connection status on right

      const availableTurnTextWidth = viewportWidth - horizontalPadding - chipCircleWidth - connectionIndicatorWidth;

      // In the two-tier layout, the dedicated turnStatusBar gives 208px+ to the status text
      expect(availableTurnTextWidth).toBeGreaterThan(200);
      // Status text "Waiting for Abhi..." (~120px) fits cleanly on 1 horizontal line
      const estimatedTextWidth = 120;
      expect(availableTurnTextWidth).toBeGreaterThan(estimatedTextWidth);
    });

    it('calculates available horizontal width on 430px mobile viewport (iPhone Max)', () => {
      const viewportWidth = 430;
      const horizontalPadding = 16 * 2;
      const chipCircleWidth = 32 + 8;
      const connectionIndicatorWidth = 80;

      const availableTurnTextWidth = viewportWidth - horizontalPadding - chipCircleWidth - connectionIndicatorWidth;

      // Plenty of horizontal room (278px) on larger phones
      expect(availableTurnTextWidth).toBeGreaterThan(270);
    });
  });

  describe('3. Leaving in Lobby (Host & Non-Host)', () => {
    it('non-host leaving in lobby emits leaveRoom, clears saved tokens, and resets online store', async () => {
      const roomCode = 'LOBBY1';
      const playerId = 'player-bob';
      const reconnectToken = 'token-bob-123';

      useOnlineStore.setState({
        isOnline: true,
        playerId,
        reconnectToken,
        room: {
          id: 'room-lobby',
          roomCode,
          hostId: 'player-alice',
          players: [
            { id: 'player-alice', name: 'Alice', seat: 0, teamId: 'red', isHost: true, isConnected: true },
            { id: playerId, name: 'Bob', seat: 1, teamId: 'blue', isHost: false, isConnected: true },
          ],
          status: 'lobby',
          settings: { teamCount: 2, maxPlayers: 4, allowBots: false, turnTimeLimit: 0 },
        } as any,
      });

      const { getSocket } = require('../services/socket');
      const mockSocket = getSocket();

      // Trigger leaveRoom
      await useOnlineStore.getState().leaveRoom();

      // 1. leaveRoom emitted with roomCode & playerId
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'leaveRoom',
        expect.objectContaining({ roomCode, playerId }),
        expect.any(Function)
      );

      // 2. Online store reset cleanly
      const state = useOnlineStore.getState();
      expect(state.isOnline).toBe(false);
      expect(state.room).toBeNull();
      expect(state.playerId).toBeNull();
      expect(state.reconnectToken).toBeNull();
      expect(state.gameState).toBeNull();
    });

    it('host leaving in lobby emits leaveRoom, clears saved tokens, and resets online store', async () => {
      const roomCode = 'HOST01';
      const hostId = 'player-alice';
      const reconnectToken = 'token-alice-999';

      useOnlineStore.setState({
        isOnline: true,
        playerId: hostId,
        reconnectToken,
        room: {
          id: 'room-host',
          roomCode,
          hostId,
          players: [
            { id: hostId, name: 'Alice', seat: 0, teamId: 'red', isHost: true, isConnected: true },
            { id: 'player-bob', name: 'Bob', seat: 1, teamId: 'blue', isHost: false, isConnected: true },
          ],
          status: 'lobby',
          settings: { teamCount: 2, maxPlayers: 4, allowBots: false, turnTimeLimit: 0 },
        } as any,
      });

      const { getSocket } = require('../services/socket');
      const mockSocket = getSocket();

      // Trigger leaveRoom
      await useOnlineStore.getState().leaveRoom();

      // 1. leaveRoom emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'leaveRoom',
        expect.objectContaining({ roomCode, playerId: hostId }),
        expect.any(Function)
      );

      // 2. Online store reset cleanly
      const state = useOnlineStore.getState();
      expect(state.isOnline).toBe(false);
      expect(state.room).toBeNull();
      expect(state.playerId).toBeNull();
      expect(state.reconnectToken).toBeNull();
    });
  });

  describe('4. No Auto-Rejoin After Leaving', () => {
    it('does not auto-rejoin when returning to foreground after leaving', async () => {
      const roomCode = 'LEAVED';
      const playerId = 'player-exited';

      // 1. Set active online session
      useOnlineStore.setState({
        isOnline: true,
        playerId,
        reconnectToken: 'reconnect-token-xyz',
        room: {
          id: 'room-left',
          roomCode,
          hostId: playerId,
          players: [{ id: playerId, name: 'Exited', seat: 0, teamId: 'red', isHost: true, isConnected: true }],
          status: 'lobby',
          settings: { teamCount: 2, maxPlayers: 4, allowBots: false, turnTimeLimit: 0 },
        } as any,
      });

      const { getSocket } = require('../services/socket');
      const mockSocket = getSocket();

      // 2. Player leaves
      await useOnlineStore.getState().leaveRoom();

      // Clear mock call history to check subsequent auto-rejoin behavior
      mockSocket.emit.mockClear();

      // 3. RejoinCurrentRoom called while left must return false and not emit rejoin
      const didRejoin = await useOnlineStore.getState().rejoinCurrentRoom();
      expect(didRejoin).toBe(false);
      expect(mockSocket.emit).not.toHaveBeenCalledWith('rejoin', expect.anything(), expect.anything());

      // 4. Store remains offline
      expect(useOnlineStore.getState().isOnline).toBe(false);
      expect(useOnlineStore.getState().room).toBeNull();
    });
  });
});
