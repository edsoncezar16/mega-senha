import React from 'react';
import { Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  GuessResultPayload,
  GameEndedPayload,
} from '../types';
import HinterView from './HinterView';
import GuesserView from './GuesserView';
import SpectatorView from './SpectatorView';
import RoundEnd from './RoundEnd';
import GameEnd from './GameEnd';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface GameBoardProps {
  socket: AppSocket;
  roomState: RoomState;
  myId: string;
  hintRejection: string | null;
  lastGuessResult: GuessResultPayload | null;
  lastWordSkipped: string | null;
  lastGameEnded: GameEndedPayload | null;
  onClearHintRejection: () => void;
  onClearGuessResult: () => void;
}

export default function GameBoard({
  socket,
  roomState,
  myId,
  hintRejection,
  lastGuessResult,
  lastWordSkipped,
  lastGameEnded,
  onClearHintRejection,
  onClearGuessResult,
}: GameBoardProps) {
  if (roomState.phase === 'GAME_END' && lastGameEnded) {
    return <GameEnd payload={lastGameEnded} />;
  }

  if (roomState.phase === 'ROUND_END') {
    return <RoundEnd socket={socket} roomState={roomState} myId={myId} />;
  }

  const isHinter = roomState.currentRound?.hinterId === myId;
  const isGuesser = roomState.currentRound?.guesserId === myId;

  if (isHinter) {
    return (
      <HinterView
        socket={socket}
        roomState={roomState}
        hintRejection={hintRejection}
        onClearRejection={onClearHintRejection}
      />
    );
  }

  if (isGuesser) {
    return (
      <GuesserView
        socket={socket}
        roomState={roomState}
        lastGuessResult={lastGuessResult}
        lastWordSkipped={lastWordSkipped}
        onClearGuessResult={onClearGuessResult}
      />
    );
  }

  return <SpectatorView roomState={roomState} myId={myId} />;
}
