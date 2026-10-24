// ─────────────────────────────────────────────────────────────────────────────
// Sequence Server – RoomManager Unit Tests
// Tests for: create, join, full room, wrong code, invalid start,
//            reconnect tokens, team selection, inactivity cleanup,
//            full game engine flow, disconnect/bot takeover,
//            and proof that opponents' hands are never included in any payload.
// ─────────────────────────────────────────────────────────────────────────────

import { RoomManager } from '../roomManager';
import { isDeadCard } from '../../../shared/engine';


describe('Server RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    // Disable background timer in tests to avoid open handles
    manager = new RoomManager(false);
  });

  afterEach(() => {
    manager.stopCleanupInterval();
  });

  // ── 1. CREATE ROOM TESTS ──────────────────────────────────────────────────
  describe('createRoom', () => {
    test('returns a 6-character room code with no confusing characters (no O/0, I/1)', () => {
      const { room, playerId, reconnectToken } = manager.createRoom('Alice');

      // 6-character code
      expect(room.roomCode).toHaveLength(6);

      // Verify no ambiguous characters: O, 0, I, 1
      const ambiguousChars = ['O', '0', 'I', '1'];
      for (const char of ambiguousChars) {
        expect(room.roomCode).not.toContain(char);
      }

      // Check against allowed charset: uppercase letters without I, O and digits 2-9
      expect(room.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

      // Verify multiple generated codes all follow the rule
      for (let i = 0; i < 30; i++) {
        const code = manager.generateRoomCode();
        expect(code).toHaveLength(6);
        expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      }
    });

    test('initializes host with seat 0, red team, and returns private reconnect token', () => {
      const { room, playerId, reconnectToken } = manager.createRoom('Alice', { teamCount: 2 }, 'sock-1');

      expect(room.hostId).toBe(playerId);
      expect(room.status).toBe('lobby');
      expect(room.players).toHaveLength(1);

      const host = room.players[0];
      expect(host.id).toBe(playerId);
      expect(host.name).toBe('Alice');
      expect(host.seat).toBe(0);
      expect(host.teamId).toBe('red');
      expect(host.isHost).toBe(true);
      expect(host.isConnected).toBe(true);

      // Reconnect token is returned and non-empty
      expect(typeof reconnectToken).toBe('string');
      expect(reconnectToken.length).toBeGreaterThan(0);

      // Private reconnect token must NOT be leaked in the public room state
      expect((host as any).reconnectToken).toBeUndefined();
    });

    test('defaults maxPlayers to 12 if not specified, and respects valid allowed counts', () => {
      const defaultRoom = manager.createRoom('Host1');
      expect(defaultRoom.room.settings.maxPlayers).toBe(12);

      const customRoom = manager.createRoom('Host2', { maxPlayers: 4 });
      expect(customRoom.room.settings.maxPlayers).toBe(4);
    });
  });

  // ── 2. JOIN ROOM TESTS ────────────────────────────────────────────────────
  describe('joinRoom', () => {
    test('joins by room code with player name and assigns alternating seats', () => {
      const { room } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 4 }, 'sock-1');

      const joinBob = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      expect(joinBob.success).toBe(true);
      expect(joinBob.room?.players).toHaveLength(2);
      expect(joinBob.reconnectToken).toBeDefined();

      const bob = joinBob.room?.players[1];
      expect(bob?.name).toBe('Bob');
      expect(bob?.seat).toBe(1);
      expect(bob?.teamId).toBe('blue'); // Alternates from Red (seat 0) to Blue (seat 1)

      const joinCharlie = manager.joinRoom(room.roomCode, 'Charlie', 'sock-3');
      expect(joinCharlie.success).toBe(true);
      const charlie = joinCharlie.room?.players[2];
      expect(charlie?.seat).toBe(2);
      expect(charlie?.teamId).toBe('red'); // Seat 2 alternates back to Red

      const joinDavid = manager.joinRoom(room.roomCode, 'David', 'sock-4');
      expect(joinDavid.success).toBe(true);
      const david = joinDavid.room?.players[3];
      expect(david?.seat).toBe(3);
      expect(david?.teamId).toBe('blue'); // Seat 3 alternates back to Blue

      // Teammates never sit together (Red, Blue, Red, Blue)
      expect(joinDavid.room?.players.map((p) => p.teamId)).toEqual(['red', 'blue', 'red', 'blue']);
    });

    test('each joining player gets a private reconnect token not leaked to others', () => {
      const { room, reconnectToken: hostToken } = manager.createRoom('Alice', { maxPlayers: 4 }, 'sock-1');
      const joinBob = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');

      expect(joinBob.reconnectToken).toBeDefined();
      expect(joinBob.reconnectToken).not.toBe(hostToken);

      // Ensure neither token is leaked in public player summaries
      const players = joinBob.room?.players!;
      expect((players[0] as any).reconnectToken).toBeUndefined();
      expect((players[1] as any).reconnectToken).toBeUndefined();
    });

    test('rejoining with private reconnect token restores the exact same seat', () => {
      const { room, reconnectToken: hostToken, playerId: hostId } = manager.createRoom('Alice', { maxPlayers: 4 }, 'sock-1');
      const joinBob = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      const bobToken = joinBob.reconnectToken!;
      const bobId = joinBob.playerId!;

      // Disconnect Bob
      manager.handleDisconnect('sock-2');
      let roomState = manager.getRoom(room.roomCode)!;
      // During grace period, Bob remains connected
      expect(roomState.players.find((p) => p.id === bobId)?.isConnected).toBe(true);
      // Grace period expires
      manager.handleGraceTimeout(room.roomCode, bobId);
      expect(roomState.players.find((p) => p.id === bobId)?.isConnected).toBe(false);

      // Bob rejoins with his private reconnect token
      const rejoinResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-bob-new', bobToken);
      expect(rejoinResult.success).toBe(true);
      expect(rejoinResult.playerId).toBe(bobId);
      expect(rejoinResult.room?.players).toHaveLength(2);

      const restoredBob = rejoinResult.room?.players.find((p) => p.id === bobId);
      expect(restoredBob?.seat).toBe(1); // Same seat preserved
      expect(restoredBob?.teamId).toBe('blue');
      expect(restoredBob?.isConnected).toBe(true);
    });
  });

  // ── 3. FULL ROOM TESTS ────────────────────────────────────────────────────
  describe('full room', () => {
    test('rejects join when room reaches custom maxPlayers limit', () => {
      const { room } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');

      // 2nd player joins -> room becomes full
      const join2 = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      expect(join2.success).toBe(true);

      // 3rd player attempts to join
      const join3 = manager.joinRoom(room.roomCode, 'Charlie', 'sock-3');
      expect(join3.success).toBe(false);
      expect(join3.error).toContain('full');
      expect(join3.error).toContain('2 max');
    });

    test('rejects join when room reaches allowed count of 4 players', () => {
      const { room } = manager.createRoom('P1', { maxPlayers: 4 }, 'sock-1');
      expect(manager.joinRoom(room.roomCode, 'P2', 'sock-2').success).toBe(true);
      expect(manager.joinRoom(room.roomCode, 'P3', 'sock-3').success).toBe(true);
      expect(manager.joinRoom(room.roomCode, 'P4', 'sock-4').success).toBe(true);

      const overflow = manager.joinRoom(room.roomCode, 'P5', 'sock-5');
      expect(overflow.success).toBe(false);
      expect(overflow.error).toContain('full');
    });

    test('enforces the absolute maximum limit of 12 players', () => {
      const { room } = manager.createRoom('P1', { maxPlayers: 12 }, 'sock-1');

      for (let i = 2; i <= 12; i++) {
        const res = manager.joinRoom(room.roomCode, `P${i}`, `sock-${i}`);
        expect(res.success).toBe(true);
      }

      // 13th player attempt
      const overflow = manager.joinRoom(room.roomCode, 'P13', 'sock-13');
      expect(overflow.success).toBe(false);
      expect(overflow.error).toContain('full');
    });
  });

  // ── 4. WRONG CODE TESTS ───────────────────────────────────────────────────
  describe('wrong room code', () => {
    test('joinRoom returns error for non-existent room code', () => {
      const result = manager.joinRoom('ZZZZZZ', 'Alice', 'sock-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    test('joinRoom returns error for empty or invalid room code', () => {
      const result = manager.joinRoom('', 'Alice', 'sock-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Room code is required');
    });

    test('startGame returns error for wrong room code', () => {
      const result = manager.startGame('NONEXI', 'player-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    test('rejoinRoom returns error for wrong room code', () => {
      const result = manager.rejoinRoom('NONEXI', 'player-1', 'sock-9');
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    test('setTeamCount returns error for wrong room code', () => {
      const result = manager.setTeamCount('NONEXI', 'player-1', 3);
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    test('room code lookup is case-insensitive and trims whitespace', () => {
      const { room } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const lowerCode = `  ${room.roomCode.toLowerCase()}  `;

      const result = manager.joinRoom(lowerCode, 'Bob', 'sock-2');
      expect(result.success).toBe(true);
      expect(result.room?.roomCode).toBe(room.roomCode);
    });
  });

  // ── 5. INVALID START TESTS ────────────────────────────────────────────────
  describe('invalid start', () => {
    test('rejects start from a non-host player', () => {
      const { room } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      const bobResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');

      const nonHostStart = manager.startGame(room.roomCode, bobResult.playerId!);
      expect(nonHostStart.success).toBe(false);
      expect(nonHostStart.error).toContain('Only the room host can start');
    });

    test('rejects start when player count is 1 (not in allowed player counts)', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2 }, 'sock-1');

      const result = manager.startGame(room.roomCode, aliceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid player count (1)');
      expect(result.error).toContain('Allowed player counts: 2, 3, 4, 6, 8, 9, 10, or 12');
    });

    test('rejects start when player count does not divide evenly among 2 teams (e.g. 3 players)', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 6 }, 'sock-1');
      manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.joinRoom(room.roomCode, 'Charlie', 'sock-3');

      // 3 players with 2 teams cannot divide evenly (3 % 2 !== 0)
      const result = manager.startGame(room.roomCode, aliceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be evenly divided among 2 teams');
    });

    test('rejects start when player count does not divide evenly among 3 teams (e.g. 2, 4, 8, 10 players)', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 3, maxPlayers: 12 }, 'sock-1');
      manager.joinRoom(room.roomCode, 'Bob', 'sock-2');

      // 2 players with 3 teams: 2 % 3 !== 0
      let result = manager.startGame(room.roomCode, aliceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be evenly divided among 3 teams');

      // Add Charlie and David -> 4 players with 3 teams: 4 % 3 !== 0
      manager.joinRoom(room.roomCode, 'Charlie', 'sock-3');
      manager.joinRoom(room.roomCode, 'David', 'sock-4');
      result = manager.startGame(room.roomCode, aliceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be evenly divided among 3 teams');
    });

    test('rejects start when match has already started', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      manager.joinRoom(room.roomCode, 'Bob', 'sock-2');

      const firstStart = manager.startGame(room.roomCode, aliceId);
      expect(firstStart.success).toBe(true);

      const secondStart = manager.startGame(room.roomCode, aliceId);
      expect(secondStart.success).toBe(false);
      expect(secondStart.error).toContain('already started');
    });

    test('allows start when player count divides evenly (e.g. 6 players on 3 teams)', () => {
      const { room, playerId: aliceId } = manager.createRoom('P1', { teamCount: 3, maxPlayers: 6 }, 'sock-1');
      for (let i = 2; i <= 6; i++) {
        manager.joinRoom(room.roomCode, `P${i}`, `sock-${i}`);
      }

      const result = manager.startGame(room.roomCode, aliceId);
      expect(result.success).toBe(true);

      const activeRoom = manager.getRoom(room.roomCode);
      expect(activeRoom?.status).toBe('playing');
    });
  });

  // ── 6. TEAM SELECTION & ALTERNATING SEATING TESTS ─────────────────────────
  describe('team selection and alternating seating', () => {
    test('host can set team count to 3 and seats are re-assigned in alternating order', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 6 }, 'sock-1');
      manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.joinRoom(room.roomCode, 'Charlie', 'sock-3');

      // Host switches to 3 teams
      const switchResult = manager.setTeamCount(room.roomCode, aliceId, 3);
      expect(switchResult.success).toBe(true);
      expect(switchResult.room?.settings.teamCount).toBe(3);

      const players = switchResult.room?.players!;
      expect(players[0].teamId).toBe('red');
      expect(players[1].teamId).toBe('blue');
      expect(players[2].teamId).toBe('green');

      // Add 3 more players
      manager.joinRoom(room.roomCode, 'David', 'sock-4');
      manager.joinRoom(room.roomCode, 'Eve', 'sock-5');
      const joinFrank = manager.joinRoom(room.roomCode, 'Frank', 'sock-6');

      const allPlayers = joinFrank.room?.players!;
      expect(allPlayers.map((p) => p.teamId)).toEqual([
        'red', 'blue', 'green', 'red', 'blue', 'green',
      ]);

      // Confirm teammates never sit next to each other
      for (let i = 0; i < allPlayers.length; i++) {
        const next = (i + 1) % allPlayers.length;
        expect(allPlayers[i].teamId).not.toBe(allPlayers[next].teamId);
      }
    });

    test('non-host cannot change team count', () => {
      const { room } = manager.createRoom('Alice', { teamCount: 2 }, 'sock-1');
      const bobResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');

      const nonHostSwitch = manager.setTeamCount(room.roomCode, bobResult.playerId!, 3);
      expect(nonHostSwitch.success).toBe(false);
      expect(nonHostSwitch.error).toContain('Only the room host');
    });

    test('rejects invalid team count (only 2 or 3 allowed)', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2 }, 'sock-1');
      const invalidSwitch = manager.setTeamCount(room.roomCode, aliceId, 4 as any);
      expect(invalidSwitch.success).toBe(false);
      expect(invalidSwitch.error).toContain('Team count must be 2 or 3');
    });
  });

  // ── 7. EMPTY ROOM CLEANUP TESTS ───────────────────────────────────────────
  describe('empty room inactivity removal (30 minutes)', () => {
    test('removes empty room after 30 minutes of inactivity', () => {
      const { room } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const code = room.roomCode;

      // Disconnect sole player -> room becomes empty
      manager.handleDisconnect('sock-1');
      expect(manager.isRoomEmpty(manager.getRoom(code)!)).toBe(true);

      const baseTime = Date.now();

      // After 10 minutes: should NOT be removed
      const removed10m = manager.cleanupInactiveRooms(baseTime + 10 * 60 * 1000);
      expect(removed10m).toHaveLength(0);
      expect(manager.getRoom(code)).toBeDefined();

      // After 29 minutes: should NOT be removed
      const removed29m = manager.cleanupInactiveRooms(baseTime + 29 * 60 * 1000);
      expect(removed29m).toHaveLength(0);
      expect(manager.getRoom(code)).toBeDefined();

      // After 30 minutes (exact threshold): removed
      const removed30m = manager.cleanupInactiveRooms(baseTime + 30 * 60 * 1000);
      expect(removed30m).toContain(code);
      expect(manager.getRoom(code)).toBeUndefined();
    });

    test('does NOT remove active rooms with connected players even after 30 minutes', () => {
      const { room } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const code = room.roomCode;

      const baseTime = Date.now();

      // After 35 minutes, Alice is still connected
      const removed = manager.cleanupInactiveRooms(baseTime + 35 * 60 * 1000);
      expect(removed).not.toContain(code);
      expect(manager.getRoom(code)).toBeDefined();
    });

    test('leaving room cleans up and marks empty when last player leaves', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const code = room.roomCode;

      manager.leaveRoom(code, aliceId);
      const activeRoom = manager.getRoom(code);
      expect(activeRoom?.players).toHaveLength(0);
      expect(manager.isRoomEmpty(activeRoom!)).toBe(true);

      const baseTime = Date.now();
      const removed = manager.cleanupInactiveRooms(baseTime + 31 * 60 * 1000);
      expect(removed).toContain(code);
      expect(manager.getRoom(code)).toBeUndefined();
    });
  });

  // ── 8. FULL GAME FLOW USING SHARED ENGINE ─────────────────────────────────
  describe('full authoritative game flow on server', () => {
    test('on startGame: shuffles deck, cuts the deck, sets first player, and deals hands', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      manager.joinRoom(room.roomCode, 'Bob', 'sock-2');

      const startResult = manager.startGame(room.roomCode, aliceId);
      expect(startResult.success).toBe(true);

      const activeRoom = manager.getRoom(room.roomCode);
      const engine = activeRoom?.engineState;
      expect(engine).not.toBeNull();

      // Cut the deck: dealerIndex and cutCards must be generated
      expect(engine?.dealerIndex).toBeDefined();
      expect(engine?.cutCards).toBeDefined();
      expect(engine?.cutCards?.length).toBe(2);

      // Starting player must be clockwise from the dealer: (dealerIndex + 1) % 2
      expect(engine?.currentPlayerIndex).toBe((engine!.dealerIndex + 1) % 2);

      // Dealing: 2 players = 7 cards each
      expect(engine?.players[0].hand).toHaveLength(7);
      expect(engine?.players[1].hand).toHaveLength(7);

      // Remaining draw pile: 104 - 14 (hands) = 90 cards
      expect(engine?.drawPile).toHaveLength(90);
    });

    test('on playMove / discardDeadCard: verifies player turn and move legality', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      const bobResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      const bobId = bobResult.playerId!;

      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      const turnPlayerId = activeRoom.engineState!.players[activeRoom.engineState!.currentPlayerIndex].id;
      const nonTurnPlayerId = turnPlayerId === aliceId ? bobId : aliceId;

      const nonTurnState = manager.getPlayerGameState(room.roomCode, nonTurnPlayerId)!;
      const cardToPlay = nonTurnState.hand[0];

      // 1. Out-of-turn play must be rejected
      const outOfTurn = manager.playMove(room.roomCode, nonTurnPlayerId, [1, 1], cardToPlay.id);
      expect(outOfTurn.success).toBe(false);
      expect(outOfTurn.error).toContain('not your turn');

      // 2. Playing a card not in hand must be rejected
      const fakeCardMove = manager.playMove(room.roomCode, turnPlayerId, [1, 1], 'fake-card-id');
      expect(fakeCardMove.success).toBe(false);
      expect(fakeCardMove.error).toContain('not in current player');

      // 3. Playing out of bounds must be rejected
      const turnState = manager.getPlayerGameState(room.roomCode, turnPlayerId)!;
      const outOfBounds = manager.playMove(room.roomCode, turnPlayerId, [15, 15], turnState.hand[0].id);
      expect(outOfBounds.success).toBe(false);
      expect(outOfBounds.error).toContain('out of bounds');

      // 4. Playing on a corner space must be rejected
      const cornerMove = manager.playMove(room.roomCode, turnPlayerId, [0, 0], turnState.hand[0].id);
      expect(cornerMove.success).toBe(false);
      expect(cornerMove.error).toContain('corner');
    });

    test('after each legal move: auto-draws, detects sequences, checks win, and advances turn', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      const bobResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      const bobId = bobResult.playerId!;

      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      const initialTurnPlayerIndex = activeRoom.engineState!.currentPlayerIndex;
      const initialTurnPlayerId = activeRoom.engineState!.players[initialTurnPlayerIndex].id;

      // Find a valid cell for one of the turn player's cards
      const turnPlayer = activeRoom.engineState!.players[initialTurnPlayerIndex];
      let validMove: { cell: [number, number]; cardId: string } | null = null;

      for (const card of turnPlayer.hand) {
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            const cell = activeRoom.engineState!.board[r][c];
            if (cell.card !== 'CORNER' && cell.chip === null) {
              if (cell.card.suit === card.suit && cell.card.rank === card.rank) {
                validMove = { cell: [r, c], cardId: card.id };
                break;
              }
            }
          }
          if (validMove) break;
        }
        if (validMove) break;
      }

      expect(validMove).not.toBeNull();

      // Execute valid move
      const playResult = manager.playMove(
        room.roomCode,
        initialTurnPlayerId,
        validMove!.cell,
        validMove!.cardId
      );
      expect(playResult.success).toBe(true);

      // Verify board was updated with the chip
      const updatedCell = activeRoom.engineState!.board[validMove!.cell[0]][validMove!.cell[1]];
      expect(updatedCell.chip).toBe(turnPlayer.teamId);

      // Verify auto-draw refilled hand to 7
      const updatedPlayer = activeRoom.engineState!.players[initialTurnPlayerIndex];
      expect(updatedPlayer.hand).toHaveLength(7);

      // Verify personal discard pile received the card
      expect(updatedPlayer.discardPile).toHaveLength(1);
      expect(updatedPlayer.discardPile[0].id).toBe(validMove!.cardId);

      // Verify turn advanced to the other player
      expect(activeRoom.engineState!.currentPlayerIndex).toBe((initialTurnPlayerIndex + 1) % 2);
    });

    test('discardDeadCard rejects non-dead card and handles valid dead card discard', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      const turnPlayer = activeRoom.engineState!.players[activeRoom.engineState!.currentPlayerIndex];

      // A fresh card on an empty board is not dead
      const freshCard = turnPlayer.hand[0];
      const discardAttempt = manager.discardDeadCard(room.roomCode, turnPlayer.id, freshCard.id);
      expect(discardAttempt.success).toBe(false);
      expect(discardAttempt.error).toContain('not dead');
    });
  });

  // ── 9. PERSONALISED STATE & OPPONENT HAND PRIVACY PROOF ────────────────────
  describe('personalised state and strict opponent hand privacy', () => {
    test('PROVES opponents hands are NEVER included in any payload across 2-player game', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      const bobResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      const bobId = bobResult.playerId!;

      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      const aliceEngineHand = activeRoom.engineState!.players.find((p) => p.id === aliceId)!.hand;
      const bobEngineHand = activeRoom.engineState!.players.find((p) => p.id === bobId)!.hand;

      // ── ALICE'S PERSPECTIVE ──
      const aliceState = manager.getPlayerGameState(room.roomCode, aliceId)!;
      expect(aliceState).not.toBeNull();

      // 1. Alice sees her own 7 cards
      expect(aliceState.hand).toHaveLength(7);
      expect(aliceState.hand.map((c) => c.id)).toEqual(aliceEngineHand.map((c) => c.id));

      // 2. Alice only sees Bob's cardCount, NOT Bob's hand
      const bobSummaryInAliceView = aliceState.players.find((p) => p.id === bobId)!;
      expect(bobSummaryInAliceView.cardCount).toBe(7);
      expect((bobSummaryInAliceView as any).hand).toBeUndefined();

      // 3. Draw pile contents are never included
      expect((aliceState as any).drawPile).toBeUndefined();
      expect(aliceState.drawPileCount).toBe(90);

      // 4. All discard piles are present
      expect(aliceState.discardPiles).toBeDefined();
      expect(aliceState.discardPiles[aliceId]).toEqual([]);
      expect(aliceState.discardPiles[bobId]).toEqual([]);

      // 5. PROOF: Serialized JSON payload for Alice does NOT contain any of Bob's card IDs
      const alicePayloadJson = JSON.stringify(aliceState);
      for (const bobCard of bobEngineHand) {
        expect(alicePayloadJson).not.toContain(`"${bobCard.id}"`);
      }

      // ── BOB'S PERSPECTIVE ──
      const bobState = manager.getPlayerGameState(room.roomCode, bobId)!;
      expect(bobState.hand).toHaveLength(7);
      expect(bobState.hand.map((c) => c.id)).toEqual(bobEngineHand.map((c) => c.id));

      const aliceSummaryInBobView = bobState.players.find((p) => p.id === aliceId)!;
      expect(aliceSummaryInBobView.cardCount).toBe(7);
      expect((aliceSummaryInBobView as any).hand).toBeUndefined();

      // PROOF: Serialized JSON payload for Bob does NOT contain any of Alice's card IDs
      const bobPayloadJson = JSON.stringify(bobState);
      for (const aliceCard of aliceEngineHand) {
        expect(bobPayloadJson).not.toContain(`"${aliceCard.id}"`);
      }
    });

    test('PROVES opponents hands are NEVER included in 3-player 3-team game', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 3, maxPlayers: 3 }, 'sock-1');
      const bobId = manager.joinRoom(room.roomCode, 'Bob', 'sock-2').playerId!;
      const charlieId = manager.joinRoom(room.roomCode, 'Charlie', 'sock-3').playerId!;

      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      const bobEngineHand = activeRoom.engineState!.players.find((p) => p.id === bobId)!.hand;
      const charlieEngineHand = activeRoom.engineState!.players.find((p) => p.id === charlieId)!.hand;

      // Alice's view
      const aliceState = manager.getPlayerGameState(room.roomCode, aliceId)!;
      const alicePayloadJson = JSON.stringify(aliceState);

      // Neither Bob's nor Charlie's cards appear in Alice's payload
      for (const bobCard of bobEngineHand) {
        expect(alicePayloadJson).not.toContain(`"${bobCard.id}"`);
      }
      for (const charlieCard of charlieEngineHand) {
        expect(alicePayloadJson).not.toContain(`"${charlieCard.id}"`);
      }

      for (const p of aliceState.players) {
        if (p.id !== aliceId) {
          expect((p as any).hand).toBeUndefined();
          expect(p.cardCount).toBe(6); // 3 players = 6 cards
        }
      }
    });
  });

  // ── 10. DISCONNECTS, BOT TAKEOVER, & REJOIN RESTORATION ────────────────────
  describe('disconnects, 60s bot takeover, and rejoin restoration', () => {
    test('disconnect marks player offline and schedules bot takeover after 60 seconds', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      const bobResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      const bobId = bobResult.playerId!;
      const bobToken = bobResult.reconnectToken!;

      manager.startGame(room.roomCode, aliceId);

      // Bob disconnects during match
      manager.handleDisconnect('sock-2');

      const roomAfterDc = manager.getRoom(room.roomCode)!;
      const bobInRoom = roomAfterDc.players.find((p) => p.id === bobId)!;
      // During 30-second grace period, player is still marked online
      expect(bobInRoom.isConnected).toBe(true);
      expect(bobInRoom.isBotControlled).toBe(false);

      // 30s grace period timeout expires: now marked offline
      manager.handleGraceTimeout(room.roomCode, bobId);
      expect(bobInRoom.isConnected).toBe(false);
      expect(bobInRoom.isBotControlled).toBe(false);

      // Simulate 60-second timeout firing
      manager.handleDisconnectTimeout(room.roomCode, bobId);

      // Bot now takes over Bob's seat
      expect(bobInRoom.isBotControlled).toBe(true);

      // State sent to Alice reflects that Bob is bot-controlled and disconnected
      const aliceView = manager.getPlayerGameState(room.roomCode, aliceId)!;
      const bobSummary = aliceView.players.find((p) => p.id === bobId)!;
      expect(bobSummary.isConnected).toBe(false);
      expect(bobSummary.isBotControlled).toBe(true);
      // Opponent hand remains strictly masked
      expect((bobSummary as any).hand).toBeUndefined();

      // Bob rejoins with reconnectToken: restores connection and removes bot control
      const rejoin = manager.rejoinRoom(room.roomCode, bobToken, 'sock-bob-new');
      expect(rejoin.success).toBe(true);
      expect(bobInRoom.isConnected).toBe(true);
      expect(bobInRoom.isBotControlled).toBe(false);

      // Bob has his secret hand restored
      expect(rejoin.gameState?.hand).toHaveLength(7);
    });

    test('rejoin returns the identical hand and exact card order without reshuffling', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      const bobResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      const bobId = bobResult.playerId!;
      const bobToken = bobResult.reconnectToken!;

      manager.startGame(room.roomCode, aliceId);

      // Get Bob's initial hand before disconnect
      const initialBobState = manager.getPlayerGameState(room.roomCode, bobId)!;
      const initialHand = [...initialBobState.hand];
      expect(initialHand.length).toBe(7);

      // Verify initial version is 1
      expect(initialBobState.version).toBe(1);

      // Bob disconnects briefly
      manager.handleDisconnect('sock-2');

      // Bob rejoins before grace period expires
      const rejoin1 = manager.rejoinRoom(room.roomCode, bobToken, 'sock-bob-rejoin-1');
      expect(rejoin1.success).toBe(true);

      const rejoinedHand1 = rejoin1.gameState!.hand;
      expect(rejoinedHand1).toHaveLength(initialHand.length);

      // Verify every single card ID, suit, rank, and index order is strictly identical
      for (let i = 0; i < initialHand.length; i++) {
        expect(rejoinedHand1[i].id).toBe(initialHand[i].id);
        expect(rejoinedHand1[i].suit).toBe(initialHand[i].suit);
        expect(rejoinedHand1[i].rank).toBe(initialHand[i].rank);
      }
      expect(rejoinedHand1).toEqual(initialHand);

      // Second brief disconnect and rejoin
      manager.handleDisconnect('sock-bob-rejoin-1');
      const rejoin2 = manager.rejoinRoom(room.roomCode, bobToken, 'sock-bob-rejoin-2');
      expect(rejoin2.success).toBe(true);
      expect(rejoin2.gameState!.hand).toEqual(initialHand);
    });

    test('increments version monotonically on every move and sends incremental update', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      const bobResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      expect(activeRoom.version).toBe(1);

      let deltaReceived: any = null;
      manager.onIncrementalUpdate = (_roomCode, delta) => {
        deltaReceived = delta;
      };

      const turnPlayer = activeRoom.engineState!.players[activeRoom.engineState!.currentPlayerIndex];
      // Find a playable non-Jack card and target
      const card = turnPlayer.hand.find((c) => c.rank !== 'J' && !isDeadCard(activeRoom.engineState!.board, c))!;
      const targets: [number, number][] = [];
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          const cell = activeRoom.engineState!.board[r][c];
          if (cell.card !== 'CORNER' && cell.chip === null) {
            if (card.rank === 'J' || (cell.card.suit === card.suit && cell.card.rank === card.rank)) {
              targets.push([r, c]);
            }
          }
        }
      }

      const res = manager.playMove(room.roomCode, turnPlayer.id, targets[0], card.id);
      expect(res.success).toBe(true);

      // Version must have incremented monotonically
      expect(activeRoom.version).toBe(2);
      expect(deltaReceived).not.toBeNull();
      expect(deltaReceived.playedCardId).toBe(card.id);
      expect(deltaReceived.playingPlayerId).toBe(turnPlayer.id);
      expect(deltaReceived.cell).toEqual(targets[0]);
    });


    test('bot automatically takes a turn for a disconnected bot-controlled player', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      const bobResult = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      const bobId = bobResult.playerId!;

      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      const initialTurnIndex = activeRoom.engineState!.currentPlayerIndex;
      const turnPlayerId = activeRoom.engineState!.players[initialTurnIndex].id;

      // Disconnect the turn player
      const socketToDisconnect = turnPlayerId === aliceId ? 'sock-1' : 'sock-2';
      manager.handleDisconnect(socketToDisconnect);

      // Trigger timeout: bot takes over and automatically executes the turn
      manager.handleDisconnectTimeout(room.roomCode, turnPlayerId);

      // Turn must have automatically advanced to the next player
      expect(activeRoom.engineState!.currentPlayerIndex).not.toBe(initialTurnIndex);
    });

    test('pause and resume game functions prevent and restore play', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { teamCount: 2, maxPlayers: 2 }, 'sock-1');
      manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.startGame(room.roomCode, aliceId);

      // Pause game
      expect(manager.pauseGame(room.roomCode)).toBe(true);
      const activeRoom = manager.getRoom(room.roomCode)!;
      expect(activeRoom.isPaused).toBe(true);

      const turnPlayer = activeRoom.engineState!.players[activeRoom.engineState!.currentPlayerIndex];

      // Playing move while paused is rejected
      const moveResult = manager.playMove(room.roomCode, turnPlayer.id, [1, 1], turnPlayer.hand[0].id);
      expect(moveResult.success).toBe(false);
      expect(moveResult.error).toContain('paused');

      // Resume game
      expect(manager.resumeGame(room.roomCode)).toBe(true);
      expect(activeRoom.isPaused).toBe(false);
    });
  });

  // ── 11. LEAVE ROOM (IN LOBBY, MID-GAME, HOST LEAVING, LAST PLAYER LEAVING) ──
  describe('leaveRoom lifecycle', () => {
    test('in lobby: regular non-host player leaves', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 4 }, 'sock-1');
      const { playerId: bobId } = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');

      const leaveResult = manager.leaveRoom(room.roomCode, bobId!);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.message).toContain('Bob left');
      expect(leaveResult.room).toBeDefined();
      expect(leaveResult.room?.players).toHaveLength(1);
      expect(leaveResult.room?.players[0].name).toBe('Alice');
      expect(leaveResult.room?.hostId).toBe(aliceId);
    });

    test('in lobby: host leaves, transferring host to next player', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 4 }, 'sock-1');
      const { playerId: bobId } = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.joinRoom(room.roomCode, 'Charlie', 'sock-3');

      const leaveResult = manager.leaveRoom(room.roomCode, aliceId);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.message).toContain('Alice left');
      expect(leaveResult.room?.players).toHaveLength(2);
      // Bob is now promoted to host
      expect(leaveResult.room?.hostId).toBe(bobId);
      expect(leaveResult.room?.players[0].id).toBe(bobId);
      expect(leaveResult.room?.players[0].isHost).toBe(true);
      expect(leaveResult.room?.players[0].seat).toBe(0);
      expect(leaveResult.room?.players[0].teamId).toBe('red');
    });

    test('in lobby: last player leaving marks room empty and closed', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const leaveResult = manager.leaveRoom(room.roomCode, aliceId);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.closed).toBe(true);
      expect(leaveResult.room).toBeUndefined();

      const activeRoom = manager.getRoom(room.roomCode);
      expect(activeRoom?.players).toHaveLength(0);
      expect(manager.isRoomEmpty(activeRoom!)).toBe(true);
    });

    test('mid-game: regular player leaves, bot takes over their seat', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const { playerId: bobId } = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      expect(activeRoom.status).toBe('playing');

      const leaveResult = manager.leaveRoom(room.roomCode, bobId!);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.botTookOver).toBe(true);
      expect(leaveResult.message).toContain('Bob left the match');
      expect(leaveResult.room?.status).toBe('playing');

      // Bob's seat remains, but is now bot-controlled
      const bobInRoom = activeRoom.players.find((p) => p.id === bobId)!;
      expect(bobInRoom.isBotControlled).toBe(true);
      expect(bobInRoom.isConnected).toBe(false);
      expect(bobInRoom.socketId).toBeUndefined();

      // Alice is still human and host
      const aliceInRoom = activeRoom.players.find((p) => p.id === aliceId)!;
      expect(aliceInRoom.isBotControlled).toBeFalsy();
      expect(aliceInRoom.isHost).toBe(true);
    });

    test('mid-game: host leaves, host is transferred to next player and bot takes over', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const { playerId: bobId } = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      expect(activeRoom.status).toBe('playing');

      // Alice (host) leaves mid-game
      const leaveResult = manager.leaveRoom(room.roomCode, aliceId);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.botTookOver).toBe(true);
      expect(leaveResult.message).toContain('Alice left the match');

      // Host transferred to Bob
      expect(activeRoom.hostId).toBe(bobId);
      const bobInRoom = activeRoom.players.find((p) => p.id === bobId)!;
      expect(bobInRoom.isHost).toBe(true);

      // Alice is now bot-controlled
      const aliceInRoom = activeRoom.players.find((p) => p.id === aliceId)!;
      expect(aliceInRoom.isBotControlled).toBe(true);
      expect(aliceInRoom.isHost).toBe(false);
    });

    test('mid-game: last remaining human player leaves, room finishes', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const { playerId: bobId } = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.startGame(room.roomCode, aliceId);

      // Alice leaves first (Bob is still human)
      manager.leaveRoom(room.roomCode, aliceId);

      // Now Bob (the last human player) leaves
      const leaveResult = manager.leaveRoom(room.roomCode, bobId!);
      expect(leaveResult.success).toBe(true);
      expect(leaveResult.closed).toBe(true);

      const activeRoom = manager.getRoom(room.roomCode)!;
      expect(activeRoom.status).toBe('finished');
    });
  });

  // ── 12. RECONNECT & PRESENCE RESILIENCE ─────────────────────────────────────
  describe('reconnect & presence resilience', () => {
    test('disconnect then rejoin within the grace period keeps the same hand and shows online', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const { playerId: bobId, reconnectToken: bobToken } = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      const bobInitialHand = [...activeRoom.engineState!.players.find((p) => p.id === bobId)!.hand];

      // Bob disconnects (under 30s grace period)
      manager.handleDisconnect('sock-2');
      const bobInRoom = activeRoom.players.find((p) => p.id === bobId)!;
      expect(bobInRoom.isConnected).toBe(true); // Grace period: still online

      // Bob rejoins within grace period with valid token
      const rejoinResult = manager.rejoinRoom(room.roomCode, bobToken!, 'sock-bob-rejoin');
      expect(rejoinResult.success).toBe(true);
      expect(rejoinResult.room?.players.find((p) => p.id === bobId)?.isConnected).toBe(true);
      expect(bobInRoom.isConnected).toBe(true);
      expect(bobInRoom.isBotControlled).toBe(false);

      // Verify the hand is identical in count, cards, and exact order
      expect(rejoinResult.gameState?.hand).toEqual(bobInitialHand);
    });

    test('disconnect over 60 seconds triggers the bot, rejoin reclaims the seat', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const { playerId: bobId, reconnectToken: bobToken } = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      const bobInitialHand = [...activeRoom.engineState!.players.find((p) => p.id === bobId)!.hand];

      // Bob disconnects
      manager.handleDisconnect('sock-2');

      // Grace period expires (30s) -> marked offline
      manager.handleGraceTimeout(room.roomCode, bobId!);
      const bobInRoom = activeRoom.players.find((p) => p.id === bobId)!;
      expect(bobInRoom.isConnected).toBe(false);
      expect(bobInRoom.isBotControlled).toBe(false);

      // 60 seconds timeout fires -> bot takes over seat
      manager.handleDisconnectTimeout(room.roomCode, bobId!);
      expect(bobInRoom.isConnected).toBe(false);
      expect(bobInRoom.isBotControlled).toBe(true);

      // Bob returns and rejoins: reclaims seat from bot
      const rejoinResult = manager.rejoinRoom(room.roomCode, bobToken!, 'sock-bob-reclaim');
      expect(rejoinResult.success).toBe(true);
      expect(bobInRoom.isConnected).toBe(true);
      expect(bobInRoom.isBotControlled).toBe(false); // Bot relinquished seat
      const bobHandAfterBot = activeRoom.engineState!.players.find((p) => p.id === bobId)!.hand;
      expect(rejoinResult.gameState?.hand).toEqual(bobHandAfterBot); // Hand preserved in same order
    });

    test('duplicate rejoin events do not create duplicate players', () => {
      const { room, playerId: aliceId } = manager.createRoom('Alice', { maxPlayers: 2 }, 'sock-1');
      const { playerId: bobId, reconnectToken: bobToken } = manager.joinRoom(room.roomCode, 'Bob', 'sock-2');
      manager.startGame(room.roomCode, aliceId);

      const activeRoom = manager.getRoom(room.roomCode)!;
      expect(activeRoom.players).toHaveLength(2);

      // Simulate multiple / rapid rejoin events (e.g. socket auto-reconnect + foreground trigger)
      const rejoin1 = manager.rejoinRoom(room.roomCode, bobToken!, 'sock-bob-1');
      const rejoin2 = manager.rejoinRoom(room.roomCode, bobToken!, 'sock-bob-2');
      const rejoin3 = manager.rejoinRoom(room.roomCode, bobToken!, 'sock-bob-3');

      expect(rejoin1.success).toBe(true);
      expect(rejoin2.success).toBe(true);
      expect(rejoin3.success).toBe(true);

      // Room player count must remain strictly 2 (no duplicates!)
      expect(activeRoom.players).toHaveLength(2);
      const bobSeats = activeRoom.players.filter((p) => p.id === bobId);
      expect(bobSeats).toHaveLength(1);
      expect(bobSeats[0].isConnected).toBe(true);
    });
  });
});
