// Shared types for Mega Senha — used by both client and server

export type TeamId = 'A' | 'B';
export type GamePhase = 'WAITING_FOR_PLAYERS' | 'IN_ROUND' | 'ROUND_END' | 'GAME_END';

export interface Player {
  id: string;
  name: string;
  team: TeamId | null;
  isHost: boolean;
}

export interface TeamScores {
  A: number;
  B: number;
}

export interface RoundInfo {
  round: number;       // 1-based, 1–4
  hinterId: string;
  guesserId: string;
  teamId: TeamId;
}

export interface RoomState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  currentRound: RoundInfo | null;
  hints: string[];
  scores: TeamScores;
  roundScores: TeamScores;   // points scored in the current round
  timeRemaining: number;     // seconds
  currentWord: string | null; // only sent to hinter
  wordsGuessed: number;
  wordsSkipped: number;
}

// ── Client → Server ──────────────────────────────────────────────────────────

export interface CreateRoomPayload {
  playerName: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
}

export interface ChooseTeamPayload {
  team: TeamId;
}

export interface SubmitHintPayload {
  hint: string;
}

export interface SubmitGuessPayload {
  guess: string;
}

// ── Server → Client ──────────────────────────────────────────────────────────

export interface RoundStartedPayload {
  round: number;
  hinterId: string;
  guesserId: string;
  teamId: TeamId;
}

export interface HintAcceptedPayload {
  hints: string[];
}

export interface HintRejectedPayload {
  reason: string;
}

export interface GuessResultPayload {
  correct: boolean;
  word?: string;
}

export interface WordSkippedPayload {
  word: string;
}

export interface TimerTickPayload {
  remaining: number;
}

export interface RoundEndedPayload {
  scores: TeamScores;
  roundScores: TeamScores;
}

export interface GameEndedPayload {
  winner: TeamId | 'tie';
  scores: TeamScores;
}

export interface ErrorPayload {
  message: string;
}

// ── Socket event maps (for typing socket.on / socket.emit) ───────────────────

export interface ServerToClientEvents {
  room_state: (state: RoomState) => void;
  round_started: (payload: RoundStartedPayload) => void;
  hint_accepted: (payload: HintAcceptedPayload) => void;
  hint_rejected: (payload: HintRejectedPayload) => void;
  guess_result: (payload: GuessResultPayload) => void;
  word_skipped: (payload: WordSkippedPayload) => void;
  timer_tick: (payload: TimerTickPayload) => void;
  round_ended: (payload: RoundEndedPayload) => void;
  game_ended: (payload: GameEndedPayload) => void;
  error: (payload: ErrorPayload) => void;
}

export interface ClientToServerEvents {
  create_room: (payload: CreateRoomPayload) => void;
  join_room: (payload: JoinRoomPayload) => void;
  choose_team: (payload: ChooseTeamPayload) => void;
  start_game: () => void;
  submit_hint: (payload: SubmitHintPayload) => void;
  submit_guess: (payload: SubmitGuessPayload) => void;
  skip_word: () => void;
  ready: () => void;
}
