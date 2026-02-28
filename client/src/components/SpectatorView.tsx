import React from 'react';
import { RoomState } from '../types';
import Timer from './Timer';

interface SpectatorViewProps {
  roomState: RoomState;
  myId: string;
}

export default function SpectatorView({ roomState, myId }: SpectatorViewProps) {
  const hinter = roomState.players.find((p) => p.id === roomState.currentRound?.hinterId);
  const guesser = roomState.players.find((p) => p.id === roomState.currentRound?.guesserId);
  const teamColor = roomState.currentRound?.teamId === 'A' ? 'text-blue-400' : 'text-green-400';

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 gap-4">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">Round</span>
          <span className="ml-2 font-bold text-white">{roomState.currentRound?.round}/4</span>
          <span className={`ml-3 text-sm font-semibold ${teamColor}`}>
            Time {roomState.currentRound?.teamId}
          </span>
        </div>
        <Timer remaining={roomState.timeRemaining} />
        <div className="text-right">
          <div className="text-xs text-gray-500">Placar</div>
          <div className="font-bold text-white">
            A {roomState.scores.A} · {roomState.scores.B} B
          </div>
        </div>
      </div>

      <div className="w-full max-w-lg text-center">
        <p className="text-gray-400 text-sm">
          <span className="text-yellow-400 font-semibold">{hinter?.name}</span> dá dicas para{' '}
          <span className="text-purple-400 font-semibold">{guesser?.name}</span>
        </p>
        <p className="text-xs text-gray-600 mt-1">Você é espectador neste round</p>
      </div>

      {/* Hints */}
      <div className="w-full max-w-lg bg-gray-900 rounded-2xl p-5 min-h-[120px]">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Dicas</p>
        {roomState.hints.length === 0 ? (
          <p className="text-gray-600 text-sm">Aguardando dicas…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {roomState.hints.map((h, i) => (
              <span
                key={i}
                className="bg-gray-700 text-white px-4 py-2 rounded-full text-base font-semibold"
              >
                {h}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-3">
        {(['A', 'B'] as const).map((team) => (
          <div
            key={team}
            className={`rounded-xl p-4 text-center ${
              team === 'A' ? 'bg-blue-950 border border-blue-800' : 'bg-green-950 border border-green-800'
            }`}
          >
            <p className={`text-xs uppercase tracking-wide mb-1 ${team === 'A' ? 'text-blue-400' : 'text-green-400'}`}>
              Time {team}
            </p>
            <p className="text-3xl font-extrabold text-white">{roomState.scores[team]}</p>
            <p className="text-xs text-gray-500">+{roomState.roundScores[team]} neste round</p>
          </div>
        ))}
      </div>
    </div>
  );
}
