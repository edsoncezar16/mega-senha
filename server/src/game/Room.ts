import { Server } from 'socket.io';
import {
  Player,
  RoomState,
  TeamId,
  TeamScores,
  RoundInfo,
  GamePhase,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../../../shared/types';
import { sharesPrefix } from './prefix';
import { dealWords } from './words';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

// How many words to pre-deal per room
const WORDS_PER_ROOM = 200;
const ROUND_SECONDS = 90;
const TOTAL_ROUNDS = 4;

// Round schedule: [teamId, hinterIndex, guesserIndex]
const ROUND_SCHEDULE: Array<[TeamId, 0 | 1, 0 | 1]> = [
  ['A', 0, 1],
  ['B', 0, 1],
  ['A', 1, 0],
  ['B', 1, 0],
];

export class Room {
  readonly code: string;
  private io: IO;

  private players: Map<string, Player> = new Map();
  private phase: GamePhase = 'WAITING_FOR_PLAYERS';
  private scores: TeamScores = { A: 0, B: 0 };
  private roundScores: TeamScores = { A: 0, B: 0 };
  private currentRound: RoundInfo | null = null;
  private hints: string[] = [];
  private wordPool: string[] = [];
  private wordIndex = 0;
  private currentWord = '';
  private timeRemaining = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private readySet: Set<string> = new Set();

  constructor(code: string, io: IO) {
    this.code = code;
    this.io = io;
    this.wordPool = dealWords(WORDS_PER_ROOM);
  }

  // ── Player management ────────────────────────────────────────────────────

  addPlayer(id: string, name: string): Player {
    const isHost = this.players.size === 0;
    const player: Player = { id, name, team: null, isHost };
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  hasPlayer(id: string): boolean {
    return this.players.has(id);
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  setTeam(id: string, team: TeamId): void {
    const p = this.players.get(id);
    if (p) p.team = team;
  }

  // ── Game flow ────────────────────────────────────────────────────────────

  canStart(): boolean {
    const players = [...this.players.values()];
    const teamA = players.filter((p) => p.team === 'A');
    const teamB = players.filter((p) => p.team === 'B');
    return teamA.length === 2 && teamB.length === 2;
  }

  startGame(): void {
    this.phase = 'IN_ROUND';
    this.scores = { A: 0, B: 0 };
    this.wordIndex = 0;
    this.startRound(1);
  }

  private startRound(round: number): void {
    const [teamId, hIdx, gIdx] = ROUND_SCHEDULE[round - 1];
    const teamPlayers = [...this.players.values()].filter(
      (p) => p.team === teamId
    );

    if (teamPlayers.length < 2) {
      // fallback — shouldn't happen if canStart() passed
      return;
    }

    const hinter = teamPlayers[hIdx];
    const guesser = teamPlayers[gIdx];

    this.currentRound = {
      round,
      hinterId: hinter.id,
      guesserId: guesser.id,
      teamId,
    };

    this.hints = [];
    this.roundScores = { A: 0, B: 0 };
    this.phase = 'IN_ROUND';
    this.nextWord();
    this.timeRemaining = ROUND_SECONDS;

    this.broadcast('round_started', {
      round,
      hinterId: hinter.id,
      guesserId: guesser.id,
      teamId,
    });

    this.broadcastState();
    this.startTimer();
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      this.broadcast('timer_tick', { remaining: this.timeRemaining });

      if (this.timeRemaining <= 0) {
        this.endRound();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private endRound(): void {
    this.stopTimer();
    this.phase = 'ROUND_END';
    this.readySet.clear();

    const round = this.currentRound!.round;
    this.scores.A += this.roundScores.A;
    this.scores.B += this.roundScores.B;

    this.broadcast('round_ended', {
      scores: { ...this.scores },
      roundScores: { ...this.roundScores },
    });
    this.broadcastState();

    if (round >= TOTAL_ROUNDS) {
      this.endGame();
    }
  }

  private endGame(): void {
    this.phase = 'GAME_END';
    let winner: TeamId | 'tie';
    if (this.scores.A > this.scores.B) winner = 'A';
    else if (this.scores.B > this.scores.A) winner = 'B';
    else winner = 'tie';

    this.broadcast('game_ended', { winner, scores: { ...this.scores } });
    this.broadcastState();
  }

  private nextWord(): void {
    this.currentWord = this.wordPool[this.wordIndex % this.wordPool.length];
    this.wordIndex++;
    this.hints = [];
  }

  // ── Game actions ──────────────────────────────────────────────────────────

  handleHint(socketId: string, hint: string): void {
    if (this.phase !== 'IN_ROUND') return;
    if (this.currentRound?.hinterId !== socketId) return;

    const trimmed = hint.trim();

    // Hint must be a single word
    if (!trimmed || /\s/.test(trimmed)) {
      this.io.to(socketId).emit('hint_rejected', { reason: 'Dica deve ser uma única palavra.' });
      return;
    }

    if (sharesPrefix(trimmed, this.currentWord)) {
      // Invalid hint → penalty: word is auto-skipped
      this.io.to(socketId).emit('hint_rejected', {
        reason: `Dica inválida — compartilha prefixo com a palavra. Palavra pulada.`,
      });
      const skipped = this.currentWord;
      this.nextWord();
      this.broadcast('word_skipped', { word: skipped });
      this.broadcastState();
      return;
    }

    this.hints.push(trimmed);
    this.broadcast('hint_accepted', { hints: [...this.hints] });
    this.broadcastState();
  }

  handleGuess(socketId: string, guess: string): void {
    if (this.phase !== 'IN_ROUND') return;
    if (this.currentRound?.guesserId !== socketId) return;

    const trimmed = guess.trim().toLowerCase();
    const target = this.currentWord.toLowerCase();

    if (trimmed === target) {
      const teamId = this.currentRound.teamId;
      this.roundScores[teamId]++;
      this.broadcast('guess_result', { correct: true, word: this.currentWord });
      this.nextWord();
      this.broadcastState();
    } else {
      this.broadcast('guess_result', { correct: false });
    }
  }

  handleSkip(socketId: string): void {
    if (this.phase !== 'IN_ROUND') return;
    if (this.currentRound?.hinterId !== socketId) return;

    const skipped = this.currentWord;
    this.nextWord();
    this.broadcast('word_skipped', { word: skipped });
    this.broadcastState();
  }

  handleReady(socketId: string): void {
    if (this.phase !== 'ROUND_END') return;
    this.readySet.add(socketId);

    const playerCount = this.players.size;
    if (this.readySet.size >= playerCount) {
      const nextRound = (this.currentRound?.round ?? 0) + 1;
      if (nextRound <= TOTAL_ROUNDS) {
        this.startRound(nextRound);
      }
      // else endGame was already called
    }
  }

  // ── State snapshot ────────────────────────────────────────────────────────

  /**
   * Builds the RoomState. `forSocketId` determines whether currentWord is
   * included (only the hinter sees it).
   */
  getState(forSocketId: string): RoomState {
    const isHinter = this.currentRound?.hinterId === forSocketId;
    return {
      roomCode: this.code,
      phase: this.phase,
      players: [...this.players.values()],
      currentRound: this.currentRound,
      hints: [...this.hints],
      scores: { ...this.scores },
      roundScores: { ...this.roundScores },
      timeRemaining: this.timeRemaining,
      currentWord: isHinter ? this.currentWord : null,
      wordsGuessed: this.scores.A + this.scores.B,
      wordsSkipped: 0, // tracked via events
    };
  }

  /** Broadcasts room_state to each player individually (word hidden). */
  broadcastState(): void {
    for (const [socketId] of this.players) {
      this.io.to(socketId).emit('room_state', this.getState(socketId));
    }
  }

  private broadcast<K extends keyof ServerToClientEvents>(
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.io.to(this.code) as any).emit(event, payload);
  }

  destroy(): void {
    this.stopTimer();
  }
}
