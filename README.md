# Sequence – Casino Edition Mobile Game & Multiplayer Server

A premium mobile implementation of the classic **Sequence** board game, built with **React Native**, **Expo (TypeScript)**, **Zustand**, **React Native Reanimated (60fps)**, **React Native Gesture Handler**, **Expo Haptics**, and **Expo AV**, paired with an authoritative **Node.js + TypeScript Socket.io** multiplayer game server.

---

## 🎯 Game Rules Summary

- **10×10 Grid**: 96 card spaces (2 decks minus 8 Jacks) plus 4 neutral wild corner spaces (`[0,0]`, `[0,9]`, `[9,0]`, `[9,9]`).
- **Teams & Win Targets**:
  - **2 Teams** (Red vs. Blue): 2 Sequences required to win.
  - **3 Teams** (Red vs. Blue vs. Green): 1 Sequence required to win.
- **Sequence Definition**: An unbroken straight line of 5 chips of your team color (horizontal, vertical, or diagonal).
- **Corner Spaces**: Count as wild bonus spaces for all teams simultaneously (e.g. 4 chips + 1 corner = Sequence).
- **Shared-Chip Rule**: Two sequences of the same team may share at most ONE chip in common.
- **Jacks**:
  - **Two-Eyed Jacks** (Diamonds ♦, Clubs ♣): **WILD** — Place a chip on any empty space.
  - **One-Eyed Jacks** (Spades ♠, Hearts ♥): **REMOVE** — Remove any opponent chip that is not locked in an already completed sequence.
- **Dead Cards**: If both board spaces for a card in hand are already covered by chips, the card is automatically detected as DEAD. Tap *"Discard & Draw"* to discard it and draw a fresh replacement card.
- **Player Counts & Hand Sizes**:
  - 2 players: 7 cards each
  - 3–4 players: 6 cards each
  - 6 players: 5 cards each
  - 8–9 players: 4 cards each
  - 10 or 12 players: 3 cards each

---

## 🏗️ Architecture & Project Structure

The project shares a single source of truth for the game engine and network protocol between the mobile client and backend server:

```text
relief/
├── shared/                  # Single source of truth for pure TS engine & socket protocol
│   ├── engine/              # Pure TypeScript game engine (0 UI / Node imports)
│   │   ├── types.ts         # Suit, Rank, Card, Cell, TeamId
│   │   ├── boardLayout.json # 10x10 standard Sequence board grid layout
│   │   ├── board.ts         # Board creation, cell lookup, dead-card validator
│   │   ├── deck.ts          # 104-card double deck, Jacks logic, Fisher-Yates shuffle
│   │   ├── sequenceDetector.ts # 5-in-a-row detection, shared-chip rules, locking
│   │   ├── gameReducer.ts   # State machine, alternate seating, "cut the deck", reshuffle
│   │   ├── bot.ts           # Easy, Medium, and Hard heuristic AI with lookahead
│   │   └── index.ts         # Engine barrel export
│   ├── protocol/            # Socket.io event interfaces and payload types
│   │   ├── events.ts        # ClientToServerEvents & ServerToClientEvents
│   │   ├── room.ts          # RoomState, RoomPlayer, PlayerGameState
│   │   └── index.ts         # Protocol barrel export
│   └── index.ts             # Re-exports engine & protocol
│
├── server/                  # Authoritative Node.js + TypeScript Socket.io game server
│   ├── src/
│   │   ├── index.ts         # Express server, health-check endpoint (/health), Socket.io
│   │   ├── roomManager.ts   # In-memory room manager, alternate seating, secret hand masking
│   │   ├── socketHandlers.ts# Event handlers: createRoom, joinRoom, startGame, playMove, etc.
│   │   └── __tests__/       # Server unit tests for room lifecycle and game flow
│   ├── package.json         # Express, Socket.io, tsx, jest
│   └── tsconfig.json        # TypeScript configuration resolving @shared
│
├── src/                     # Expo Mobile Client
│   ├── engine/              # Seamless bridge re-exporting from /shared/engine
│   │   └── __tests__/       # 60+ Jest tests passing 100%
│   ├── store/               # Zustand state stores (local match, settings, stats)
│   ├── screens/             # UI Screens (Home, BotSetup, PlayerSetup, Game, Result, etc.)
│   ├── components/          # 60fps Reanimated UI components & board views
│   ├── utils/               # Audio synthesizers, responsive layout, storage
│   └── theme/               # Casino green felt & midnight navy gradient palette
```

---

## 🌐 Online Multiplayer Protocol

The server is the authoritative single source of truth. Players' secret hands are masked so no player can inspect another player's cards.

### Client-to-Server Events
- `createRoom({ playerName, settings }, callback)`: Creates a room with a 5-character room code.
- `joinRoom({ roomCode, playerName }, callback)`: Joins lobby with automatic alternate team assignment.
- `startGame({ roomCode, playerId }, callback)`: Host initiates match with cut-the-deck dealer reveal.
- `playMove({ roomCode, playerId, cell, cardId }, callback)`: Validates turn and executes move.
- `discardDeadCard({ roomCode, playerId, cardId }, callback)`: Validates dead card, discards & draws.
- `rejoin({ roomCode, playerId }, callback)`: Reconnects player after a temporary network drop.

### Server-to-Client Events
- `roomUpdated(RoomState)`: Emitted on lobby updates (player joins, seating, host change).
- `gameStateUpdated(PlayerGameState)`: Emitted to each player with their own secret hand and masked opponent counts.
- `error({ message, code })`: Alerts client of invalid actions or room errors.

---

## ⚡ How to Run the Server Locally & Connect Your Phone

### Step 1: Start the Server
From the project root:
```bash
npm run server:dev
```
Or directly inside `/server`:
```bash
cd server
npm run dev
```
The server will start on port `3001`:
```text
👑 ============================================
   Sequence Game Server running on port 3001
   Health check: http://localhost:3001/health
   Listening for connections on 0.0.0.0:3001
============================================
```

### Step 2: Verify Health Check
Open your browser or run:
```bash
curl http://localhost:3001/health
```
Expected response:
```json
{
  "status": "ok",
  "uptime": 12,
  "activeRooms": 0,
  "connectedSockets": 0,
  "service": "Sequence Multiplayer Game Server"
}
```

### Step 3: Find Your Computer's Local IP Address
Ensure your phone and computer are connected to the **same local Wi-Fi network**.
- **Windows**: Run `ipconfig` in Command Prompt / PowerShell. Look for **IPv4 Address** (e.g. `192.168.1.150`).
- **macOS / Linux**: Run `ipconfig getifaddr en0` or `ip a` (e.g. `192.168.1.150`).

### Step 4: Connecting from the Mobile Phone
In your Expo app or mobile browser:
1. Connect Socket.io client to `http://<YOUR_LOCAL_IP>:3001` (e.g., `http://192.168.1.150:3001`).
2. Test connectivity directly in your phone's browser by visiting `http://192.168.1.150:3001/health`. If the JSON response appears, your phone can reach your computer.
3. *Windows Firewall Note*: If the page fails to load on your phone, allow Node.js through Windows Defender Firewall for Private Networks.

---

## 🧪 Testing

Run all unit tests across app, shared engine, and server:
```bash
npm test
```
Run type-checking:
```bash
npx tsc --noEmit
```
Run server unit tests only:
```bash
npm run server:test
```

---

## ☁️ Render Free Tier Keep-Alive (UptimeRobot Setup)

Render's free tier automatically spins down web services after **15 minutes of inactivity**, causing the next connection to experience a 30–60 second cold-start delay.

The server provides two ultra-lightweight keep-alive endpoints:
- `GET /health` / `HEAD /health`: Returns JSON with uptime and server health without querying databases or heavy computations.
- `GET /ping`: Returns plain-text `pong` with `Cache-Control: no-cache`.

### How to Ping with UptimeRobot (100% Free)
To keep your free Render instance permanently awake without paying for a paid tier:

1. **Sign up for a free UptimeRobot account** at [uptimerobot.com](https://uptimerobot.com) (free tier allows up to 50 monitors).
2. Click **"+ Add New Monitor"** in the dashboard.
3. Configure the monitor:
   - **Monitor Type:** `HTTP(s)` (or `HEAD`)
   - **Friendly Name:** `Sequence Server Keep-Alive`
   - **URL (or IP):** `https://<YOUR-APP-NAME>.onrender.com/health`
   - **Monitoring Interval:** `Every 10 minutes` (must be under 15 minutes to prevent sleep)
   - **Monitor Timeout:** `30 seconds`
4. Click **"Create Monitor"**.
5. UptimeRobot will now ping your server's `/health` endpoint every 10 minutes. Because traffic is received before the 15-minute inactivity window expires, your free Render container **never spins down**.

### In-App Cold-Start Resilience
If the server does cold-start (e.g. initial deploy or manual restart), the mobile app detects connection delays over **5 seconds** and displays a sleek **"Waking up the server..."** status screen with live elapsed counter, status phases, and a manual **"Retry Connection"** button, automatically navigating back to the lobby once the server responds.

---

## 🃏 Playing Card Design

All cards (hand, board, discard piles, deal animation) use a custom **`<PlayingCard>`** SVG component built with `react-native-svg`. The design draws inspiration from [**"Vector Playing Cards" by Byron Knoll**](https://code.google.com/archive/p/vector-playing-cards/) (public domain).

### Card Component Architecture (`src/components/PlayingCard.tsx`)

| Feature | Implementation |
|---|---|
| **Standard card face** | White rounded rect, crisp rank + suit in top-left and rotated bottom-right corners |
| **Number pips (2–10)** | Traditional pip layouts in the correct positions; bottom-half pips rotated 180° |
| **Ace** | Large centered suit pip |
| **Face cards (J, Q, K)** | Ornate illustrated court panels with stylised figures, gold sash dividers, and crown/tiara details |
| **Two-eyed Jacks** (♦, ♣) | Gold **★ WILD ★** badge overlay |
| **One-eyed Jacks** (♠, ♥) | Red **✕ REMOVE ✕** badge overlay |
| **Card back** | Navy & gold ornate pattern with diamond lattice, gold starburst medallion, and filigree corners |
| **Compact mode** | For board cells < 48px: rank + single large suit pip for crisp readability |
| **Performance** | `React.memo` wrapper; static SVG paths avoid unnecessary re-renders |

### Card Asset Files (`src/assets/cards/`)

- **`suitPaths.ts`** — SVG path data and canonical colors for ♠ ♥ ♦ ♣ (24×24 coordinate box)
- **`faceCards.tsx`** — Court card figures (King, Queen, Two-Eyed Jack, One-Eyed Jack) with mirrored upper/lower halves
- **`cardBack.tsx`** — Ornate navy & gold card back SVG

### Attribution

Playing card court figure designs inspired by the public-domain **"Vector Playing Cards"** set by Byron Knoll. All SVG artwork in this project is custom-drawn vector art.

