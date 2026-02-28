import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  HintAcceptedPayload,
  HintRejectedPayload,
  GuessResultPayload,
  WordSkippedPayload,
  RoundEndedPayload,
  GameEndedPayload,
  RoundStartedPayload,
} from '../types';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface SocketState {
  socket: AppSocket | null;
  connected: boolean;
  roomState: RoomState | null;
  myId: string | null;
  lastHintRejection: string | null;
  lastGuessResult: GuessResultPayload | null;
  lastWordSkipped: string | null;
  lastRoundEnded: RoundEndedPayload | null;
  lastGameEnded: GameEndedPayload | null;
  lastRoundStarted: RoundStartedPayload | null;
  serverError: string | null;
}

export function useSocket() {
  const socketRef = useRef<AppSocket | null>(null);
  const [state, setState] = useState<SocketState>({
    socket: null,
    connected: false,
    roomState: null,
    myId: null,
    lastHintRejection: null,
    lastGuessResult: null,
    lastWordSkipped: null,
    lastRoundEnded: null,
    lastGameEnded: null,
    lastRoundStarted: null,
    serverError: null,
  });

  useEffect(() => {
    const socket: AppSocket = io(SERVER_URL, { autoConnect: true });
    socketRef.current = socket;

    setState((s) => ({ ...s, socket, myId: socket.id ?? null }));

    socket.on('connect', () => {
      setState((s) => ({ ...s, connected: true, myId: socket.id ?? null }));
    });

    socket.on('disconnect', () => {
      setState((s) => ({ ...s, connected: false }));
    });

    socket.on('room_state', (roomState) => {
      setState((s) => ({ ...s, roomState }));
    });

    socket.on('round_started', (payload) => {
      setState((s) => ({ ...s, lastRoundStarted: payload }));
    });

    socket.on('hint_accepted', (payload: HintAcceptedPayload) => {
      setState((s) => ({
        ...s,
        roomState: s.roomState ? { ...s.roomState, hints: payload.hints } : s.roomState,
        lastHintRejection: null,
      }));
    });

    socket.on('hint_rejected', (payload: HintRejectedPayload) => {
      setState((s) => ({ ...s, lastHintRejection: payload.reason }));
    });

    socket.on('guess_result', (payload: GuessResultPayload) => {
      setState((s) => ({ ...s, lastGuessResult: payload }));
    });

    socket.on('word_skipped', (payload: WordSkippedPayload) => {
      setState((s) => ({ ...s, lastWordSkipped: payload.word }));
    });

    socket.on('round_ended', (payload: RoundEndedPayload) => {
      setState((s) => ({ ...s, lastRoundEnded: payload }));
    });

    socket.on('game_ended', (payload: GameEndedPayload) => {
      setState((s) => ({ ...s, lastGameEnded: payload }));
    });

    socket.on('error', (payload) => {
      setState((s) => ({ ...s, serverError: payload.message }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function clearHintRejection() {
    setState((s) => ({ ...s, lastHintRejection: null }));
  }

  function clearGuessResult() {
    setState((s) => ({ ...s, lastGuessResult: null }));
  }

  function clearServerError() {
    setState((s) => ({ ...s, serverError: null }));
  }

  return { state, clearHintRejection, clearGuessResult, clearServerError };
}
