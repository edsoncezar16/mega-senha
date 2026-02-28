import React from 'react';
import { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, RoomState } from '../types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RoundEndProps {
  socket: AppSocket;
  roomState: RoomState;
  myId: string;
}

export default function RoundEnd({ socket, roomState, myId }: RoundEndProps) {
  function ready() {
    socket.emit('ready');
  }

  const round = roomState.currentRound?.round ?? 0;
  const isLastRound = round >= 4;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h2 className="text-3xl font-extrabold text-yellow-400">
          {isLastRound ? 'Fim de Jogo!' : `Fim do Round ${round}`}
        </h2>

        <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
          <p className="text-gray-400 text-sm uppercase tracking-wide">Pontuação do round</p>
          <div className="grid grid-cols-2 gap-4">
            {(['A', 'B'] as const).map((team) => (
              <div
                key={team}
                className={`rounded-xl p-4 ${
                  team === 'A' ? 'bg-blue-950 border border-blue-700' : 'bg-green-950 border border-green-700'
                }`}
              >
                <p className={`text-xs uppercase ${team === 'A' ? 'text-blue-400' : 'text-green-400'}`}>
                  Time {team}
                </p>
                <p className="text-4xl font-extrabold text-white mt-1">
                  {roomState.roundScores[team]}
                </p>
                <p className="text-xs text-gray-500">neste round</p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-gray-400 text-sm uppercase tracking-wide mb-3">Total</p>
            <div className="grid grid-cols-2 gap-4">
              {(['A', 'B'] as const).map((team) => (
                <div key={team} className="text-center">
                  <p className={`text-xs ${team === 'A' ? 'text-blue-400' : 'text-green-400'}`}>
                    Time {team}
                  </p>
                  <p className="text-2xl font-bold text-white">{roomState.scores[team]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={ready}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold text-lg rounded-xl py-4 transition-colors"
        >
          {isLastRound ? 'Ver resultado final' : 'Próximo round'}
        </button>
      </div>
    </div>
  );
}
