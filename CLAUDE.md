# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev servers (run in separate terminals)
npm run dev:server        # server on port 3001 (tsx watch)
npm run dev:client        # client on port 5173 (Vite)

# Tests
npm test                  # all tests (node + jsdom suites)
npm run test:server       # server unit + integration + e2e only
npm run test:client       # client unit tests only
npm run test:watch        # watch mode
npm run test:coverage     # with coverage

# Run a single test file
npx vitest run tests/unit/server/Room.test.ts
npx vitest run tests/integration/server.test.ts

# Build
npm run build:server      # tsup → server/dist/
npm run build:client      # tsc + vite build → client/dist/
```

## Architecture

### Monorepo layout

```
client/     Vite + React 18 + TypeScript + Tailwind
server/     Node.js + Express + Socket.io + TypeScript
shared/     types.ts — imported by both sides via path aliases
tests/      all tests at root level (Vitest workspace)
```

`shared/types.ts` is the contract between client and server. It defines all socket event payloads (`ClientToServerEvents`, `ServerToClientEvents`), `RoomState`, `Player`, `GamePhase`, etc. Both sides import it via TypeScript path aliases — `../../shared/types` is aliased in `client/tsconfig.json`, `server/tsconfig.json`, and `vitest.workspace.ts`.

### Server

**Entry**: `server/src/server.ts` — reads env vars, calls `createApp()`, starts listening.

**App factory**: `server/src/app.ts` — `createApp(clientOrigin)` returns `{ app, httpServer, io }`. Keeping the factory separate from the entry point is what allows integration and e2e tests to spin up in-process servers without port conflicts.

**Game state machine**: `server/src/game/Room.ts`
- One `Room` instance per active game room, keyed by a 4-char code in a `Map<string, Room>`.
- `phase` transitions: `WAITING_FOR_PLAYERS → IN_ROUND → ROUND_END → IN_ROUND → … → GAME_END`
- `ROUND_SCHEDULE` (array of 4 entries) drives who hints/guesses each round and which team plays. Rounds 3–4 swap roles within each team.
- Timer is a server-side `setInterval` (90 s). `startTimer()` is called by `startRound()`, and `stopTimer()` is called before any state that ends the round.
- `getState(socketId)` hides `currentWord` from everyone except the hinter — `broadcastState()` loops over all players and calls `getState` per-player.
- `handleReady()` collects a `Set` of socket IDs; when `readySet.size >= players.size`, the next round starts (or the game ends if it was round 4).

**Hint validation**: `server/src/game/prefix.ts` — `sharesPrefix(hint, target)` strips diacritics, lowercases, then checks that the first `min(3, hint.len, target.len)` characters match. An invalid hint causes the word to auto-skip.

**Word pool**: `server/src/game/words.ts` — 758 words in `words.txt`, shuffled once at startup. `dealWords(n)` slices the next `n` words from a global cursor. In the production bundle (`tsup --out-dir dist`), `__dirname` is `dist/`, so the build script copies `words.txt` there.

### Client

**Socket singleton**: `client/src/hooks/useSocket.ts` — creates one `socket.io-client` instance in a `useRef`, wires all server→client event listeners, and exposes `state` + helpers (`clearHintRejection`, etc.). `myId` is kept in state because `socket.id` is only stable after `connect`.

**Phase routing**: `client/src/App.tsx` renders `<Home>` (no room), `<Lobby>` (`WAITING_FOR_PLAYERS`), or `<GameBoard>` (all other phases) based on `roomState.phase`.

**Role detection**: Components check `myId === roomState.currentRound?.hinterId` / `guesserId` to decide which sub-view to render (`HinterView`, `GuesserView`, `SpectatorView`).

**Env var**: `VITE_SERVER_URL` (default `http://localhost:3001`). In dev, Vite proxies `/socket.io` to `localhost:3001`, so the env var is only needed in production.

### Tests

Two Vitest environments defined in `vitest.workspace.ts`:
- `node` project: `tests/unit/server/**`, `tests/integration/**`, `tests/e2e/**`
- `jsdom` project: `tests/unit/client/**` (needs `globals: true` for `@testing-library/jest-dom`)

**Fake timers**: Tests that advance the 90 s round timer must call `vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })` **before** `startGame()` / `makeReadyRoom()`, because `setInterval` is captured at the moment `startTimer()` runs. Using `{ toFake: [...] }` (not the default) avoids faking `setTimeout`, which socket.io internals rely on.

**E2e race condition**: Register `room_state` listeners before emitting events that trigger them. Use the `captureNextCurrentWord()` helper pattern (registers a persistent listener first, then resolves when the state arrives).

**Mock io (Room unit tests)**: `makeMockIo()` returns a minimal object with `to(id).emit(event, payload)` that records calls. Assertions check `emitted[socketId]` arrays.

### Deployment

| Service | Trigger | Notes |
|---------|---------|-------|
| Fly.io (server) | push to `main` when `server/**` or `shared/**` changed | `flyctl deploy --remote-only`; secret `FLY_API_TOKEN` |
| Vercel (client) | automatic; skipped when neither `client/**` nor `shared/**` changed | `ignoreCommand` in `vercel.json` |

CI on PRs: `test-server` and `test-client` are path-filtered — changes to `tests/unit/server/` do not trigger `test-client`, and vice versa. Both are required status checks; skipped jobs count as passing.

### Key env vars

| Var | Where | Default |
|-----|-------|---------|
| `PORT` | server | `3001` |
| `CLIENT_ORIGIN` | server | `http://localhost:5173` |
| `VITE_SERVER_URL` | client build | `http://localhost:3001` |
