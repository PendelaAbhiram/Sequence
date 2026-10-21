// ─────────────────────────────────────────────────────────────────────────────
// Sequence Server – Socket.io Smoke Test Script
// Connects 2 clients: Client 1 creates a room, Client 2 joins,
// Host picks 2 teams, starts the game, and prints room states.
// ─────────────────────────────────────────────────────────────────────────────

import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  PlayerGameState,
} from '../../shared/protocol';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

function printHeader(title: string) {
  console.log(`\n================================================================`);
  console.log(`  ${title}`);
  console.log(`================================================================`);
}

function printRoomState(label: string, room: RoomState) {
  console.log(`\n--- [Room State: ${label}] ---`);
  console.log(`  Room Code : ${room.roomCode}`);
  console.log(`  Status    : ${room.status}`);
  console.log(`  Host ID   : ${room.hostId}`);
  console.log(`  Settings  : Team Count = ${room.settings.teamCount}, Max Players = ${room.settings.maxPlayers}`);
  console.log(`  Players (${room.players.length}):`);
  room.players.forEach((p) => {
    console.log(
      `    • Seat ${p.seat}: ${p.name} [ID: ${p.id}] (Team: ${p.teamId.toUpperCase()}, Host: ${p.isHost}, Connected: ${p.isConnected})`
    );
  });
  console.log(`----------------------------------------------------------------\n`);
}

function connectClient(clientLabel: string): Promise<TypedSocket> {
  return new Promise((resolve, reject) => {
    const socket: TypedSocket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Connection timed out for ${clientLabel} to ${SERVER_URL}`));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runSmokeTest() {
  printHeader(`Sequence Server Smoke Test -> Connecting to ${SERVER_URL}`);

  let client1: TypedSocket | null = null;
  let client2: TypedSocket | null = null;

  try {
    // ── STEP 1: Connect Client 1 (Host: Alice) ───────────────────────────────
    console.log(`[Step 1] Connecting Client 1 (Alice)...`);
    client1 = await connectClient('Client 1 (Alice)');
    console.log(`✓ Client 1 connected (socket ID: ${client1.id})`);

    // ── STEP 2: Client 1 creates a room ──────────────────────────────────────
    console.log(`\n[Step 2] Client 1 creating room with playerName='Alice'...`);
    const createResult = await new Promise<{
      success: boolean;
      room?: RoomState;
      playerId?: string;
      reconnectToken?: string;
      error?: string;
    }>((resolve) => {
      client1!.emit(
        'createRoom',
        { playerName: 'Alice', settings: { teamCount: 2, maxPlayers: 2 } },
        (res) => resolve(res)
      );
    });

    if (!createResult.success || !createResult.room) {
      throw new Error(`Failed to create room: ${createResult.error}`);
    }

    const roomCode = createResult.room.roomCode;
    const hostPlayerId = createResult.playerId!;
    console.log(`✓ Room created successfully! Code: ${roomCode}`);
    console.log(`  Host Player ID: ${hostPlayerId}`);
    console.log(`  Private Reconnect Token: ${createResult.reconnectToken ? '[RECEIVED]' : '[MISSING]'}`);
    printRoomState('After Room Creation', createResult.room);

    // ── STEP 3: Connect Client 2 (Player: Bob) ───────────────────────────────
    console.log(`[Step 3] Connecting Client 2 (Bob)...`);
    client2 = await connectClient('Client 2 (Bob)');
    console.log(`✓ Client 2 connected (socket ID: ${client2.id})`);

    // Listen for room updates on Client 1
    let latestRoomOnClient1: RoomState = createResult.room;
    client1.on('roomUpdated', (updatedRoom) => {
      latestRoomOnClient1 = updatedRoom;
    });

    // ── STEP 4: Client 2 joins with room code ────────────────────────────────
    console.log(`\n[Step 4] Client 2 joining room '${roomCode}' with playerName='Bob'...`);
    const joinResult = await new Promise<{
      success: boolean;
      room?: RoomState;
      playerId?: string;
      reconnectToken?: string;
      error?: string;
    }>((resolve) => {
      client2!.emit('joinRoom', { roomCode, playerName: 'Bob' }, (res) => resolve(res));
    });

    if (!joinResult.success || !joinResult.room) {
      throw new Error(`Failed to join room: ${joinResult.error}`);
    }

    const bobPlayerId = joinResult.playerId!;
    console.log(`✓ Client 2 joined successfully!`);
    console.log(`  Bob Player ID: ${bobPlayerId}`);
    console.log(`  Private Reconnect Token: ${joinResult.reconnectToken ? '[RECEIVED]' : '[MISSING]'}`);
    printRoomState('After Client 2 Joined', joinResult.room);

    // ── STEP 5: Host chooses 2 teams ─────────────────────────────────────────
    console.log(`[Step 5] Host (Alice) explicitly selecting 2 teams...`);
    const setTeamsResult = await new Promise<{
      success: boolean;
      room?: RoomState;
      error?: string;
    }>((resolve) => {
      client1!.emit(
        'setTeamCount',
        { roomCode, playerId: hostPlayerId, teamCount: 2 },
        (res) => resolve(res)
      );
    });

    if (!setTeamsResult.success || !setTeamsResult.room) {
      throw new Error(`Failed to set team count: ${setTeamsResult.error}`);
    }

    console.log(`✓ Team count set to 2.`);
    printRoomState('After Selecting 2 Teams', setTeamsResult.room);

    // ── STEP 6: Host starts the game ─────────────────────────────────────────
    console.log(`[Step 6] Host (Alice) starting match...`);

    const gameStatePromise1 = new Promise<PlayerGameState>((resolve) => {
      client1!.once('gameStateUpdated', (state) => resolve(state));
    });
    const gameStatePromise2 = new Promise<PlayerGameState>((resolve) => {
      client2!.once('gameStateUpdated', (state) => resolve(state));
    });

    const startResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      client1!.emit('startGame', { roomCode, playerId: hostPlayerId }, (res) => resolve(res));
    });

    if (!startResult.success) {
      throw new Error(`Failed to start game: ${startResult.error}`);
    }

    console.log(`✓ Match started successfully!`);

    // Await game states dispatched to both players
    const [gameState1, gameState2] = await Promise.all([gameStatePromise1, gameStatePromise2]);

    console.log(`\n--- [Game State Broadcast Verification] ---`);
    console.log(`  Phase             : ${gameState1.phase}`);
    console.log(`  Turn Player ID    : ${gameState1.turnPlayerId}`);
    console.log(`  Sequences Needed  : ${gameState1.sequencesNeeded}`);
    console.log(`  Alice's Hand Size : ${gameState1.hand.length} cards (private secret cards)`);
    console.log(`  Bob's Hand Size   : ${gameState2.hand.length} cards (private secret cards)`);
    console.log(`  Draw Pile Count   : ${gameState1.drawPileCount}`);
    console.log(`----------------------------------------------------------------\n`);

    printHeader('🎉 SMOKE TEST PASSED: All steps completed successfully!');
  } catch (err: any) {
    console.error(`\n❌ Smoke test failed:`, err?.message || err);
    process.exitCode = 1;
  } finally {
    if (client1) client1.disconnect();
    if (client2) client2.disconnect();
    // Allow sockets a moment to close cleanly
    setTimeout(() => {
      process.exit(process.exitCode ?? 0);
    }, 200);
  }
}

runSmokeTest();
