# Copilot Instructions for Mega Senha

## What This Project Does

Mega Senha is a real-time multiplayer word-guessing game designed for two teams of two (4 active players), inspired by the Brazilian TV show *Senha*. The server requires exactly 2 players per team to start a game but does not cap the total number of connected users — additional players remain without an active role. Two teams of two take turns — one player gives single-word clues, the other guesses — over 4 rounds of 90 seconds each.

## Repository Layout

```
mega-senha/
├── client/          # Vite + React 18 + TypeScript + Tailwind (port 5173)
│   └── src/
│       ├── App.tsx               # Phase-based router
│       ├── components/           # Home, Lobby, GameBoard, HinterView, GuesserView, SpectatorView, RoundEnd, GameEnd, Timer
│       └── hooks/useSocket.ts    # Socket.io singleton + all server→client listeners
├── server/          # Node.js + Express + Socket.io + TypeScript (port 3001)
│   └── src/
│       ├── server.ts             # Entry point (reads env vars, starts listener)
│       ├── app.ts                # createApp() factory (socket event handlers)
│       └── game/
│           ├── Room.ts           # Game state machine
│           ├── prefix.ts         # sharesPrefix() hint validation
│           ├── words.ts          # dealWords(), word pool loaded/shuffled from words.txt (filtered to length >= 4)
│           └── words.txt         # Word list (copied to dist/ at build time)
├── shared/
│   └── types.ts     # Single source of truth — ALL socket payloads, RoomState, Player, GamePhase
├── tests/           # Root-level Vitest workspace (node + jsdom environments)
│   ├── unit/server/ # prefix.test.ts, Room.test.ts — core server game logic tests
│   ├── unit/client/ # Timer.test.tsx, Home.test.tsx — core client UI + timer tests
│   ├── integration/ # server.test.ts — real in-process Socket.io integration tests
│   └── e2e/         # full-game.test.ts — complete 4-round game end-to-end test
├── vitest.workspace.ts
├── CLAUDE.md        # Extended architecture notes (read this too)
└── README.md
```

## Essential Commands

```bash
# Install everything (root-level; npm workspaces cover client + server)
npm install

# Dev (run in separate terminals)
npm run dev:server   # tsx watch → port 3001
npm run dev:client   # vite     → port 5173

# Tests
npm test                     # all tests (node + jsdom projects)
npm run test:server          # server unit + integration + e2e
npm run test:client          # client unit tests (jsdom)
npm run test:watch           # watch mode
npm run test:coverage        # with coverage report
npx vitest --workspace vitest.workspace.ts run <path>   # single file

# Build
npm run build:server         # tsup → server/dist/
npm run build:client         # tsc + vite build → client/dist/
```

## Shared Types Contract

`shared/types.ts` is the **only** place that defines the network contract. **Never** copy its types into client or server.

In **client application code and jsdom-based tests**, import shared types from the local barrel file `client/src/types.ts` (for example, `import { RoomState } from '../types';`). That barrel file re-exports everything from `../../shared/types` and is the **only** client file that should import from `../../shared/types` directly.

The `../../shared/types` alias used by `client/src/types.ts` is configured in:

- `client/tsconfig.json`
- `client/vite.config.ts` (Vite needs its own alias; it does not read TS `paths` automatically)
- the Vitest jsdom project configuration (see `vitest.workspace.ts`)

On the **server** side, import from `shared/types.ts` using normal relative paths; there is no path alias configured in `server/tsconfig.json`.

Key types to know:

| Type | Purpose |
|------|---------|
| `GamePhase` | `WAITING_FOR_PLAYERS \| IN_ROUND \| ROUND_END \| GAME_END` |
| `RoomState` | Full snapshot broadcast on discrete state changes (not every timer tick) |
| `Player` | `{ id, name, team, isHost }` |
| `ClientToServerEvents` | All events a browser can emit |
| `ServerToClientEvents` | All events the server can emit |

## Architecture Patterns

### Server

- **`createApp(clientOrigin)`** in `app.ts` returns `{ app, httpServer, io }`. Tests use this to spin up in-process servers — **do not** import from `server.ts` in tests.
- **`Room`** is the state machine. One instance per 4-char room code, stored in a `Map<string, Room>`.
- `getState(socketId)` hides `currentWord` from everyone except the hinter. `broadcastState()` calls `getState` per player — **always use `broadcastState()`**, never send raw state.
- The 90 s timer is a server-side `setInterval`. `startTimer()` runs inside `startRound()`; `stopTimer()` must be called before any transition that ends the round.
- `ROUND_SCHEDULE` (4 entries) drives which team plays and who hints/guesses. Rounds 3–4 swap roles within each team.
- `handleReady()` collects a `readySet`; when `readySet.size >= players.size` the next round starts (or the game ends after round 4).

### Client

- `useSocket.ts` creates one Socket.io client in a `useRef` and is the single place all `on()` listeners are registered.
- `App.tsx` routes by `roomState.phase`: no room → `<Home>`, `WAITING_FOR_PLAYERS` → `<Lobby>`, everything else → `<GameBoard>`.
- Role detection: compare `myId === roomState.currentRound?.hinterId` (or `guesserId`) to pick `HinterView`, `GuesserView`, or `SpectatorView`.
- `myId` is stored in React state (not read directly from `socket.id`) because `socket.id` is only stable after the `connect` event.

### Hint Validation (`prefix.ts`)

`sharesPrefix(hint, target)` normalises both strings (strip diacritics via NFD, lowercase), then checks whether the first `min(3, hint.length, target.length)` characters match. An invalid hint auto-skips the current word.

## Test Patterns — Critical Details

### Fake Timers

Tests that advance the 90 s round timer **must** call `vi.useFakeTimers` **before** `startGame()` / `makeReadyRoom()` is called, because `setInterval` is captured at the moment `startTimer()` runs inside `startRound()`.

```ts
// CORRECT
vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
room.startGame();
vi.advanceTimersByTime(90_000);

// WRONG — faking after startRound() is a no-op
room.startGame();
vi.useFakeTimers(...);
```

In **integration/E2E tests that use real Socket.io clients**, use `{ toFake: ['setInterval', 'clearInterval'] }` (not the bare default) — faking `setTimeout` breaks Socket.io internals. Server **unit** tests (which use a mock IO) can safely use bare `vi.useFakeTimers()`.

### E2E Race Condition

Register `room_state` listeners **before** emitting the event that triggers them. Use the `captureNextCurrentWord()` helper pattern (a persistent listener that resolves when state arrives):

```ts
// CORRECT
const wordPromise = captureNextCurrentWord(players);
players[0].emit('start_game');
const word = await wordPromise;
```

### Mock IO (Room Unit Tests)

`makeMockIo()` returns a `{ io, emitted, find, clear }` helper for unit-testing the `Room` class. `emitted` is a flat `Emission[]` array of all calls; use the `find` and `clear` helpers:

```ts
const { io, emitted, find, clear } = makeMockIo();
const room = new Room('ABCD', io as any);
// ...
expect(find('room_state', socketId).length).toBeGreaterThan(0);
// clear(); // optionally reset between assertions
```

## Environment Variables

| Variable | Side | Default | Notes |
|----------|------|---------|-------|
| `PORT` | server | `3001` | HTTP listen port |
| `CLIENT_ORIGIN` | server | `http://localhost:5173` | CORS allowed origin |
| `VITE_SERVER_URL` | client build | `http://localhost:3001` | WebSocket server URL used in both dev and production; if unset, the client connects to `http://localhost:3001` |

## CI / CD

Two GitHub Actions checks run on PRs: `Test server` and `Test client`. Each job only runs when relevant paths change:

| Changed paths | Job triggered |
|---------------|---------------|
| `server/**`, `shared/**`, `tests/unit/server/**`, `tests/integration/**`, `tests/e2e/**` | `Test server` |
| `client/**`, `shared/**`, `tests/unit/client/**`, `tests/integration/**`, `tests/e2e/**` | `Test client` |

Merges to `main` auto-deploy: server → Fly.io (`FLY_API_TOKEN` secret required), client → Vercel.

## Common Pitfalls

1. **words.txt not found in production**: The build step copies `server/src/game/words.txt` to `server/dist/`. If you add other static assets to `server/src/game/`, copy them in the build script too.
2. **Shared type changes**: Any change to `shared/types.ts` affects both sides. Run `npm run test:server` **and** `npm run test:client` when modifying it.
3. **Socket event naming**: Event names are string literals in `types.ts` (`ClientToServerEvents`/`ServerToClientEvents`). Keep client `emit` names and server `on` names in sync — TypeScript will catch most mismatches, but only if both sides use the typed `Socket` generics.
4. **Room code collisions**: Room codes are 4 characters drawn from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (letters + digits, excluding ambiguous chars). The server retries in a loop until it finds an unused code, but you still shouldn't rely on collisions being impossible.
5. **`socket.id` stability**: `socket.id` is `undefined` before `connect`. Always use the `myId` state value from `useSocket` in client components.
