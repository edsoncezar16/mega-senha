/**
 * End-to-end test: drives a complete 4-round Mega Senha game from lobby to game_ended.
 *
 * Timer strategy: vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
 *   - Only fakes setInterval/clearInterval (used by Room.ts for the 90-second timer)
 *   - Leaves setTimeout real so socket.io connection and message delivery work normally
 *
 * Race-condition fix: room_state listeners are always registered BEFORE the emit
 * that triggers them, so we never miss an event.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { io as ioc, Socket } from 'socket.io-client';
import type { AddressInfo } from 'net';
import { createApp } from '../../server/src/app';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  RoomState,
  RoundStartedPayload,
  HintAcceptedPayload,
  GuessResultPayload,
  RoundEndedPayload,
  GameEndedPayload,
} from '../../shared/types';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function waitFor<T>(socket: TestSocket, event: keyof ServerToClientEvents): Promise<T> {
  return new Promise((resolve) => socket.once(event as string, resolve as () => void));
}

function waitForAll<T>(sockets: TestSocket[], event: keyof ServerToClientEvents): Promise<T[]> {
  return Promise.all(sockets.map((s) => waitFor<T>(s, event)));
}

function connectSocket(port: number): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const socket: TestSocket = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/**
 * Registers room_state listeners on ALL sockets BEFORE a trigger is fired.
 * Resolves with the first non-null currentWord seen (the hinter's personalised state).
 * Must be called before emitting the event that causes the state broadcast.
 */
function captureNextCurrentWord(sockets: TestSocket[]): Promise<string> {
  return new Promise<string>((resolve) => {
    const handler = (state: RoomState) => {
      if (state.currentWord !== null) {
        sockets.forEach((s) => (s as any).off('room_state', handler));
        resolve(state.currentWord);
      }
    };
    sockets.forEach((s) => (s as any).on('room_state', handler));
  });
}

/**
 * Returns a single-word hint that is guaranteed not to share a 3-char prefix
 * with `word` after diacritic normalization.
 */
function safeHint(word: string): string {
  const normalize = (s: string) =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const prefix = normalize(word).slice(0, 3);
  const candidates = ['zebra', 'mango', 'piano', 'bolso', 'diabo', 'forno', 'hotel', 'janela'];
  return candidates.find((h) => h.slice(0, 3) !== prefix) ?? 'xpto';
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('E2E: complete 4-round game', () => {
  let port: number;
  let closeServer: () => Promise<void>;
  let players: TestSocket[];

  beforeAll(async () => {
    // Fake only setInterval/clearInterval — Room.ts uses setInterval for the round
    // timer; socket.io uses setTimeout for connection handling (left real).
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

    const { httpServer } = createApp();
    port = await new Promise<number>((resolve) => {
      httpServer.listen(0, () => {
        resolve((httpServer.address() as AddressInfo).port);
      });
    });
    closeServer = () =>
      new Promise<void>((resolve) => httpServer.close(() => resolve()));

    players = await Promise.all([
      connectSocket(port), // Ana   — index 0, host, Team A
      connectSocket(port), // Bia   — index 1, Team A
      connectSocket(port), // Carlos — index 2, Team B
      connectSocket(port), // Dani  — index 3, Team B
    ]);
  });

  afterAll(async () => {
    vi.useRealTimers();
    players.forEach((s) => s.disconnect());
    await closeServer();
  });

  it('plays through all 4 rounds and emits game_ended', async () => {
    const [ana, bia, carlos, dani] = players;

    // ── 1. Ana creates the room ─────────────────────────────────────────────
    const anaStateP = waitFor<RoomState>(ana, 'room_state');
    ana.emit('create_room', { playerName: 'Ana' });
    const anaState = await anaStateP;
    const code = anaState.roomCode;
    expect(code).toHaveLength(4);

    // ── 2. Others join ──────────────────────────────────────────────────────
    for (const [socket, name] of [
      [bia, 'Bia'], [carlos, 'Carlos'], [dani, 'Dani'],
    ] as [TestSocket, string][]) {
      await new Promise<void>((resolve) => {
        ana.once('room_state', () => resolve());
        socket.emit('join_room', { roomCode: code, playerName: name });
      });
    }

    // ── 3. Assign teams: Ana+Bia → A, Carlos+Dani → B ──────────────────────
    for (const [socket, team] of [
      [ana, 'A'], [bia, 'A'], [carlos, 'B'], [dani, 'B'],
    ] as [TestSocket, 'A' | 'B'][]) {
      await new Promise<void>((resolve) => {
        ana.once('room_state', () => resolve());
        socket.emit('choose_team', { team });
      });
    }

    // ── 4. Start the game ───────────────────────────────────────────────────
    // Register room_state listener BEFORE start_game so we never miss it
    const currentWordR1P = captureNextCurrentWord(players);
    const roundStartedR1P = waitForAll<RoundStartedPayload>(players, 'round_started');
    ana.emit('start_game');
    const [[rs1], currentWordR1] = await Promise.all([roundStartedR1P, currentWordR1P]);

    expect(rs1.round).toBe(1);
    expect(rs1.teamId).toBe('A');

    // ── Round helper ────────────────────────────────────────────────────────
    /**
     * Plays one round:
     *  1. Hinter submits a safe hint → all receive hint_accepted
     *  2. Guesser submits the correct word → all receive guess_result{correct:true}
     *  3. Timer advanced 90s → all receive round_ended
     * Returns the round_ended payload.
     */
    async function playRound(
      rs: RoundStartedPayload,
      currentWord: string,
    ): Promise<RoundEndedPayload> {
      // Identify hinter/guesser by socket.id (set by socket.io-client after connect)
      const hinterSocket = players.find((s) => s.id === rs.hinterId);
      const guesserSocket = players.find((s) => s.id === rs.guesserId);
      expect(hinterSocket).toBeDefined();
      expect(guesserSocket).toBeDefined();

      // Hint
      const hintAcceptedAll = waitForAll<HintAcceptedPayload>(players, 'hint_accepted');
      hinterSocket!.emit('submit_hint', { hint: safeHint(currentWord) });
      const [ha] = await hintAcceptedAll;
      expect(ha.hints).toHaveLength(1);

      // Correct guess
      const guessResultAll = waitForAll<GuessResultPayload>(players, 'guess_result');
      guesserSocket!.emit('submit_guess', { guess: currentWord });
      const [gr] = await guessResultAll;
      expect(gr.correct).toBe(true);

      // Expire the round timer
      const roundEndedAll = waitForAll<RoundEndedPayload>(players, 'round_ended');
      vi.advanceTimersByTime(90_000);
      const [re] = await roundEndedAll;
      return re;
    }

    // ── Round 1 (Team A) ────────────────────────────────────────────────────
    const re1 = await playRound(rs1, currentWordR1);
    expect(re1.scores.A).toBeGreaterThanOrEqual(1);

    // ── Round 2 (Team B) ────────────────────────────────────────────────────
    const currentWordR2P = captureNextCurrentWord(players);
    const roundStartedR2P = waitForAll<RoundStartedPayload>(players, 'round_started');
    players.forEach((s) => s.emit('ready'));
    const [[rs2], currentWordR2] = await Promise.all([roundStartedR2P, currentWordR2P]);

    expect(rs2.round).toBe(2);
    expect(rs2.teamId).toBe('B');
    const re2 = await playRound(rs2, currentWordR2);
    expect(re2.scores.B).toBeGreaterThanOrEqual(1);

    // ── Round 3 (Team A) ────────────────────────────────────────────────────
    const currentWordR3P = captureNextCurrentWord(players);
    const roundStartedR3P = waitForAll<RoundStartedPayload>(players, 'round_started');
    players.forEach((s) => s.emit('ready'));
    const [[rs3], currentWordR3] = await Promise.all([roundStartedR3P, currentWordR3P]);

    expect(rs3.round).toBe(3);
    expect(rs3.teamId).toBe('A');
    const re3 = await playRound(rs3, currentWordR3);
    expect(re3.scores.A).toBeGreaterThanOrEqual(re1.scores.A);

    // ── Round 4 (Team B) — game_ended fires after timer expires ────────────
    const currentWordR4P = captureNextCurrentWord(players);
    const roundStartedR4P = waitForAll<RoundStartedPayload>(players, 'round_started');
    players.forEach((s) => s.emit('ready'));
    const [[rs4], currentWordR4] = await Promise.all([roundStartedR4P, currentWordR4P]);

    expect(rs4.round).toBe(4);
    expect(rs4.teamId).toBe('B');

    // game_ended listener set up BEFORE playRound so we don't miss the emit
    const gameEndedAll = waitForAll<GameEndedPayload>(players, 'game_ended');
    const re4 = await playRound(rs4, currentWordR4);

    const [ge] = await gameEndedAll;

    // ── Final assertions ────────────────────────────────────────────────────
    expect(['A', 'B', 'tie']).toContain(ge.winner);
    expect(ge.scores.A).toBe(re4.scores.A);
    expect(ge.scores.B).toBe(re4.scores.B);

    if (ge.scores.A > ge.scores.B) expect(ge.winner).toBe('A');
    else if (ge.scores.B > ge.scores.A) expect(ge.winner).toBe('B');
    else expect(ge.winner).toBe('tie');
  }, 30_000); // 30s timeout — fake timers eliminate the actual 6 minutes
});
