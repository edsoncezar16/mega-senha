import React from 'react';
import { useSocket } from './hooks/useSocket';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

export default function App() {
  const { state, clearHintRejection, clearGuessResult, clearServerError } = useSocket();
  const { socket, connected, roomState, myId, lastHintRejection, lastGuessResult, lastWordSkipped, lastGameEnded, serverError } = state;

  if (!socket || !connected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">Conectando…</div>
      </div>
    );
  }

  // No room yet → Home screen
  if (!roomState) {
    return (
      <Home
        socket={socket}
        serverError={serverError}
        onClearError={clearServerError}
      />
    );
  }

  const effectiveMyId = myId ?? socket.id ?? '';

  // In lobby
  if (roomState.phase === 'WAITING_FOR_PLAYERS') {
    return (
      <Lobby socket={socket} roomState={roomState} myId={effectiveMyId} />
    );
  }

  // In game
  return (
    <GameBoard
      socket={socket}
      roomState={roomState}
      myId={effectiveMyId}
      hintRejection={lastHintRejection}
      lastGuessResult={lastGuessResult}
      lastWordSkipped={lastWordSkipped}
      lastGameEnded={lastGameEnded}
      onClearHintRejection={clearHintRejection}
      onClearGuessResult={clearGuessResult}
    />
  );
}
