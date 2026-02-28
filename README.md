# Mega Senha

A real-time multiplayer word-guessing game for 4 players, inspired by the TV show *Senha*. Two teams of two take turns: one player gives single-word clues, the other guesses. Four rounds, 90 seconds each.

## Stack

| Layer | Technology |
|-------|-----------|
| Client | React 18 + TypeScript + Vite + Tailwind CSS |
| Server | Node.js + Express + Socket.io + TypeScript |
| Shared types | `shared/types.ts` (imported by both sides) |
| Tests | Vitest (unit + integration + e2e) |
| Server deploy | [Fly.io](https://fly.io) (scale-to-zero, São Paulo region) |
| Client deploy | [Vercel](https://vercel.com) (static) |

## Project structure

```
mega-senha/
├── client/          # Vite + React app
├── server/          # Express + Socket.io server
├── shared/          # Types shared between client and server
│   └── types.ts
├── tests/           # All tests (root-level)
│   ├── unit/
│   │   ├── server/  # prefix.test.ts, Room.test.ts
│   │   └── client/  # Timer.test.tsx, Home.test.tsx
│   ├── integration/ # server.test.ts (in-process socket.io)
│   └── e2e/         # full-game.test.ts (complete 4-round game)
└── vitest.workspace.ts
```

## Running locally

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Dev servers

```bash
# Terminal 1 — server (port 3001)
npm run dev:server

# Terminal 2 — client (port 5173)
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173). The client proxies `/socket.io` to `localhost:3001` automatically.

## Running tests

```bash
# Run all tests once
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

The suite has **89 tests** across 6 files:

| File | Tests | What it covers |
|------|-------|----------------|
| `tests/unit/server/prefix.test.ts` | 19 | `sharesPrefix()` — diacritics, case, edge cases |
| `tests/unit/server/Room.test.ts` | 29 | Room state machine with mock socket.io |
| `tests/integration/server.test.ts` | 15 | Every socket event against a real in-process server |
| `tests/e2e/full-game.test.ts` | 1 | Complete 4-round game from lobby to `game_ended` |
| `tests/unit/client/Timer.test.tsx` | 12 | SVG timer colours and arc offsets |
| `tests/unit/client/Home.test.tsx` | 13 | Home screen interactions and form validation |

## Game rules

- 4 players split into **Team A** and **Team B** (2 players each)
- 4 rounds, fixed schedule:
  - Round 1: Team A — player 0 hints, player 1 guesses
  - Round 2: Team B — player 0 hints, player 1 guesses
  - Round 3: Team A — player 1 hints, player 0 guesses *(roles swap)*
  - Round 4: Team B — player 1 hints, player 0 guesses *(roles swap)*
- Each round lasts **90 seconds**
- A hint is **invalid** if it shares a 3-character prefix with the target word (after stripping diacritics). Invalid hints auto-skip the word.
- Skipping is allowed with no penalty.
- All 4 players must click **Ready** between rounds.
- Highest score after 4 rounds wins; equal scores = tie.

## Deployment

### Server (Fly.io)

```bash
fly deploy
```

The `fly.toml` targets the `gru` (São Paulo) region, 256 MB shared VM, scale-to-zero.

Set these secrets:

```bash
fly secrets set CLIENT_ORIGIN=https://your-vercel-app.vercel.app
```

### Client (Vercel)

Set the environment variable:

```
VITE_SERVER_URL=https://your-fly-app.fly.dev
```

Then deploy via the Vercel dashboard or CLI.

## License

MIT — see [LICENSE](LICENSE).
