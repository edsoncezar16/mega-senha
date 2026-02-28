import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Room } from '../../../server/src/game/Room';
import type { Server } from 'socket.io';

// ---------------------------------------------------------------------------
// Mock socket.io Server
// Captures all .to(id).emit(event, payload) calls.
// ---------------------------------------------------------------------------

interface Emission {
  to: string;
  event: string;
  payload: unknown;
}

function makeMockIo() {
  const emitted: Emission[] = [];

  const io = {
    to: (id: string) => ({
      emit: (ev: string, pl: unknown) => {
        emitted.push({ to: id, event: ev, payload: pl });
      },
    }),
  } as unknown as Server;

  return {
    io,
    emitted,
    find: (event: string, toId?: string) =>
      emitted.filter(
        (e) => e.event === event && (toId === undefined || e.to === toId)
      ),
    clear: () => { emitted.length = 0; },
  };
}

// ---------------------------------------------------------------------------
// Helper: build a room with 4 players (2 per team) ready to start
// ---------------------------------------------------------------------------

function makeReadyRoom() {
  const mock = makeMockIo();
  const room = new Room('TEST', mock.io);

  room.addPlayer('p1', 'Ana');    // host
  room.addPlayer('p2', 'Bia');
  room.addPlayer('p3', 'Carlos');
  room.addPlayer('p4', 'Dani');

  // Team A: p1, p2  |  Team B: p3, p4
  room.setTeam('p1', 'A');
  room.setTeam('p2', 'A');
  room.setTeam('p3', 'B');
  room.setTeam('p4', 'B');

  return { room, mock };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Room.addPlayer', () => {
  it('first player becomes host', () => {
    const { io } = makeMockIo();
    const room = new Room('TEST', io);
    const p = room.addPlayer('s1', 'Ana');
    expect(p.isHost).toBe(true);
  });

  it('subsequent players are not host', () => {
    const { io } = makeMockIo();
    const room = new Room('TEST', io);
    room.addPlayer('s1', 'Ana');
    const p = room.addPlayer('s2', 'Bia');
    expect(p.isHost).toBe(false);
  });
});

describe('Room.canStart', () => {
  it('returns false with fewer than 2 players per team', () => {
    const { io } = makeMockIo();
    const room = new Room('TEST', io);
    room.addPlayer('p1', 'Ana');
    room.setTeam('p1', 'A');
    expect(room.canStart()).toBe(false);
  });

  it('returns true with exactly 2 players per team', () => {
    const { room } = makeReadyRoom();
    expect(room.canStart()).toBe(true);
  });

  it('returns false when teams are unbalanced', () => {
    const { io } = makeMockIo();
    const room = new Room('TEST', io);
    room.addPlayer('p1', 'Ana');
    room.addPlayer('p2', 'Bia');
    room.addPlayer('p3', 'Carlos');
    room.setTeam('p1', 'A');
    room.setTeam('p2', 'A');
    room.setTeam('p3', 'B');
    expect(room.canStart()).toBe(false);
  });
});

describe('Room.startGame — round schedule', () => {
  it('round 1: Team A, hinter=A[0], guesser=A[1]', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();

    const rs = mock.find('round_started', 'TEST');
    expect(rs).toHaveLength(1);
    const payload = rs[0].payload as { round: number; hinterId: string; guesserId: string; teamId: string };
    expect(payload.round).toBe(1);
    expect(payload.teamId).toBe('A');
    expect(payload.hinterId).toBe('p1');
    expect(payload.guesserId).toBe('p2');
  });

  it('round 2: Team B, hinter=B[0], guesser=B[1]', () => {
    vi.useFakeTimers();
    const { room, mock } = makeReadyRoom();
    room.startGame();

    // End round 1 by expiring the timer, then send ready from all players
    vi.advanceTimersByTime(90_000);
    mock.clear();
    room.handleReady('p1');
    room.handleReady('p2');
    room.handleReady('p3');
    room.handleReady('p4');

    const rs = mock.find('round_started', 'TEST');
    expect(rs.length).toBeGreaterThanOrEqual(1);
    const last = rs[rs.length - 1].payload as { round: number; hinterId: string; guesserId: string; teamId: string };
    expect(last.round).toBe(2);
    expect(last.teamId).toBe('B');
    expect(last.hinterId).toBe('p3');
    expect(last.guesserId).toBe('p4');
  });

  it('round 3: Team A, hinter=A[1], guesser=A[0] (swapped)', () => {
    vi.useFakeTimers();
    const { room, mock } = makeReadyRoom();
    room.startGame();

    // Complete rounds 1 and 2
    for (let r = 0; r < 2; r++) {
      vi.advanceTimersByTime(90_000);
      mock.clear();
      ['p1', 'p2', 'p3', 'p4'].forEach((id) => room.handleReady(id));
    }

    const rs = mock.find('round_started', 'TEST');
    const last = rs[rs.length - 1].payload as { round: number; hinterId: string; guesserId: string; teamId: string };
    expect(last.round).toBe(3);
    expect(last.teamId).toBe('A');
    expect(last.hinterId).toBe('p2');
    expect(last.guesserId).toBe('p1');
  });

  it('round 4: Team B, hinter=B[1], guesser=B[0] (swapped)', () => {
    vi.useFakeTimers();
    const { room, mock } = makeReadyRoom();
    room.startGame();

    for (let r = 0; r < 3; r++) {
      vi.advanceTimersByTime(90_000);
      mock.clear();
      ['p1', 'p2', 'p3', 'p4'].forEach((id) => room.handleReady(id));
    }

    const rs = mock.find('round_started', 'TEST');
    const last = rs[rs.length - 1].payload as { round: number; hinterId: string; guesserId: string; teamId: string };
    expect(last.round).toBe(4);
    expect(last.teamId).toBe('B');
    expect(last.hinterId).toBe('p4');
    expect(last.guesserId).toBe('p3');
  });
});

describe('Room.handleHint', () => {
  it('valid hint → emits hint_accepted with hints array', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();
    mock.clear();

    // p1 is hinter in round 1
    // Pick a hint that definitely does not share a prefix with the current word
    const state = room.getState('p1');
    const currentWord = state.currentWord!;
    // Choose a hint that starts very differently
    const hint = currentWord.startsWith('z') ? 'abacate' : 'zebra';

    room.handleHint('p1', hint);

    const accepted = mock.find('hint_accepted', 'TEST');
    expect(accepted).toHaveLength(1);
    const payload = accepted[0].payload as { hints: string[] };
    expect(payload.hints).toContain(hint);
  });

  it('empty/whitespace hint → emits hint_rejected to hinter only, word not skipped', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();
    const wordBefore = room.getState('p1').currentWord;
    mock.clear();

    room.handleHint('p1', '   ');

    expect(mock.find('hint_rejected', 'p1')).toHaveLength(1);
    expect(mock.find('word_skipped', 'TEST')).toHaveLength(0);
    expect(room.getState('p1').currentWord).toBe(wordBefore);
  });

  it('multi-word hint → emits hint_rejected to hinter, word not skipped', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();
    const wordBefore = room.getState('p1').currentWord;
    mock.clear();

    room.handleHint('p1', 'dois palavras');

    expect(mock.find('hint_rejected', 'p1')).toHaveLength(1);
    expect(mock.find('word_skipped', 'TEST')).toHaveLength(0);
    expect(room.getState('p1').currentWord).toBe(wordBefore);
  });

  it('prefix-violating hint → emits hint_rejected and word_skipped, advances word', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();

    const state = room.getState('p1');
    const currentWord = state.currentWord!;
    // Craft a hint that shares the first 3 chars of the current word
    const badHint = currentWord.slice(0, 3) + 'xyz';
    mock.clear();

    room.handleHint('p1', badHint);

    expect(mock.find('hint_rejected', 'p1')).toHaveLength(1);
    expect(mock.find('word_skipped', 'TEST')).toHaveLength(1);
    // Word should have advanced
    expect(room.getState('p1').currentWord).not.toBe(currentWord);
  });

  it('hint from wrong player → ignored', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();
    mock.clear();

    // p2 is the guesser in round 1, not the hinter
    room.handleHint('p2', 'zebra');

    expect(mock.find('hint_accepted')).toHaveLength(0);
    expect(mock.find('hint_rejected')).toHaveLength(0);
  });
});

describe('Room.handleGuess', () => {
  it('correct guess → score incremented, guess_result correct=true, word advances', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();

    const currentWord = room.getState('p1').currentWord!;
    mock.clear();

    // p2 is the guesser
    room.handleGuess('p2', currentWord);

    const results = mock.find('guess_result', 'TEST');
    expect(results).toHaveLength(1);
    expect((results[0].payload as { correct: boolean }).correct).toBe(true);

    // Score for team A should now be 1
    const state = room.getState('p1');
    expect(state.roundScores.A).toBe(1);

    // Word should have changed
    expect(state.currentWord).not.toBe(currentWord);
  });

  it('correct guess is case-insensitive', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();

    const currentWord = room.getState('p1').currentWord!;
    mock.clear();

    room.handleGuess('p2', currentWord.toUpperCase());

    const results = mock.find('guess_result', 'TEST');
    expect((results[0].payload as { correct: boolean }).correct).toBe(true);
  });

  it('wrong guess → guess_result correct=false, same word kept', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();

    const currentWord = room.getState('p1').currentWord!;
    mock.clear();

    room.handleGuess('p2', 'completamente_errado_xyz');

    const results = mock.find('guess_result', 'TEST');
    expect(results).toHaveLength(1);
    expect((results[0].payload as { correct: boolean }).correct).toBe(false);
    expect(room.getState('p1').currentWord).toBe(currentWord);
  });

  it('guess from wrong player → ignored', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();
    mock.clear();

    // p1 is the hinter, not the guesser
    room.handleGuess('p1', 'qualquercoisa');

    expect(mock.find('guess_result')).toHaveLength(0);
  });
});

describe('Room.handleSkip', () => {
  it('skip → emits word_skipped, advances word, no score change', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();

    const wordBefore = room.getState('p1').currentWord!;
    const scoresBefore = room.getState('p1').roundScores;
    mock.clear();

    // p1 is hinter
    room.handleSkip('p1');

    expect(mock.find('word_skipped', 'TEST')).toHaveLength(1);
    expect(room.getState('p1').currentWord).not.toBe(wordBefore);
    expect(room.getState('p1').roundScores).toEqual(scoresBefore);
  });

  it('skip from wrong player → ignored', () => {
    const { room, mock } = makeReadyRoom();
    room.startGame();
    const wordBefore = room.getState('p1').currentWord!;
    mock.clear();

    // p2 is guesser, not hinter
    room.handleSkip('p2');

    expect(mock.find('word_skipped')).toHaveLength(0);
    expect(room.getState('p1').currentWord).toBe(wordBefore);
  });
});

describe('Room timer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('after 90 s → round_ended emitted and phase transitions to ROUND_END', () => {
    vi.useFakeTimers();

    const { room, mock } = makeReadyRoom();
    room.startGame();
    mock.clear();

    vi.advanceTimersByTime(90_000);

    const roundEnded = mock.find('round_ended', 'TEST');
    expect(roundEnded.length).toBeGreaterThanOrEqual(1);

    // State should be ROUND_END
    const state = room.getState('p1');
    expect(state.phase).toBe('ROUND_END');
  });

  it('scores accumulate into totals when round ends', () => {
    vi.useFakeTimers();

    const { room, mock } = makeReadyRoom();
    room.startGame();

    // Score 2 correct guesses for team A in round 1
    const w1 = room.getState('p1').currentWord!;
    room.handleGuess('p2', w1);
    const w2 = room.getState('p1').currentWord!;
    room.handleGuess('p2', w2);

    mock.clear();
    vi.advanceTimersByTime(90_000);

    const roundEnded = mock.find('round_ended', 'TEST');
    expect(roundEnded.length).toBeGreaterThanOrEqual(1);
    const payload = roundEnded[roundEnded.length - 1].payload as {
      scores: { A: number; B: number };
      roundScores: { A: number; B: number };
    };
    expect(payload.scores.A).toBe(2);
    expect(payload.roundScores.A).toBe(2);
  });
});

describe('Room.handleReady', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('partial ready → no round transition', () => {
    vi.useFakeTimers();
    const { room, mock } = makeReadyRoom();
    room.startGame();
    vi.advanceTimersByTime(90_000);
    mock.clear();

    // Only 3 of 4 players ready
    room.handleReady('p1');
    room.handleReady('p2');
    room.handleReady('p3');

    expect(mock.find('round_started', 'TEST')).toHaveLength(0);
  });

  it('all players ready → next round starts', () => {
    vi.useFakeTimers();
    const { room, mock } = makeReadyRoom();
    room.startGame();
    vi.advanceTimersByTime(90_000);
    mock.clear();

    room.handleReady('p1');
    room.handleReady('p2');
    room.handleReady('p3');
    room.handleReady('p4');

    const rs = mock.find('round_started', 'TEST');
    expect(rs.length).toBeGreaterThanOrEqual(1);
    const payload = rs[rs.length - 1].payload as { round: number };
    expect(payload.round).toBe(2);
  });

  it('after round 4, all ready → game_ended emitted', () => {
    vi.useFakeTimers();
    const { room, mock } = makeReadyRoom();
    room.startGame();

    // Advance through rounds 1–3: expire timer, clear, send ready
    for (let r = 0; r < 3; r++) {
      vi.advanceTimersByTime(90_000);
      mock.clear();
      ['p1', 'p2', 'p3', 'p4'].forEach((id) => room.handleReady(id));
    }

    // Round 4: expire timer → endRound() calls endGame() immediately → game_ended
    vi.advanceTimersByTime(90_000);
    const gameEnded = mock.find('game_ended', 'TEST');
    expect(gameEnded.length).toBeGreaterThanOrEqual(1);
    const payload = gameEnded[gameEnded.length - 1].payload as {
      winner: string;
      scores: { A: number; B: number };
    };
    expect(['A', 'B', 'tie']).toContain(payload.winner);
  });
});

describe('Room.getState', () => {
  it('hinter sees currentWord', () => {
    const { room } = makeReadyRoom();
    room.startGame();
    const state = room.getState('p1');
    expect(state.currentWord).not.toBeNull();
    expect(typeof state.currentWord).toBe('string');
  });

  it('non-hinter gets currentWord=null', () => {
    const { room } = makeReadyRoom();
    room.startGame();
    // p2 is the guesser, not the hinter
    expect(room.getState('p2').currentWord).toBeNull();
    expect(room.getState('p3').currentWord).toBeNull();
    expect(room.getState('p4').currentWord).toBeNull();
  });
});

describe('Room winner logic', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('A > B → winner is A', () => {
    vi.useFakeTimers();
    const { room, mock } = makeReadyRoom();
    room.startGame();

    // Round 1 (Team A): score 1 correct, then expire timer, send ready
    const w = room.getState('p1').currentWord!;
    room.handleGuess('p2', w);
    vi.advanceTimersByTime(90_000);
    mock.clear();
    ['p1', 'p2', 'p3', 'p4'].forEach((id) => room.handleReady(id));

    // Rounds 2 and 3: no scoring
    for (let r = 0; r < 2; r++) {
      vi.advanceTimersByTime(90_000);
      mock.clear();
      ['p1', 'p2', 'p3', 'p4'].forEach((id) => room.handleReady(id));
    }

    // Round 4: expire timer → game_ended emitted
    vi.advanceTimersByTime(90_000);
    const gameEnded = mock.find('game_ended', 'TEST');
    const payload = gameEnded[gameEnded.length - 1].payload as {
      winner: string;
    };
    expect(payload.winner).toBe('A');
  });

  it('equal scores → winner is tie', () => {
    vi.useFakeTimers();
    const { room, mock } = makeReadyRoom();
    room.startGame();

    // Rounds 1–3: expire timer, clear, send ready
    for (let r = 0; r < 3; r++) {
      vi.advanceTimersByTime(90_000);
      mock.clear();
      ['p1', 'p2', 'p3', 'p4'].forEach((id) => room.handleReady(id));
    }

    // Round 4: expire timer → game_ended emitted (no mock.clear before check)
    vi.advanceTimersByTime(90_000);
    const gameEnded = mock.find('game_ended', 'TEST');
    const payload = gameEnded[gameEnded.length - 1].payload as {
      winner: string;
    };
    expect(payload.winner).toBe('tie');
  });
});
