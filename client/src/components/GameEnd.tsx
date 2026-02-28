import React from 'react';
import { GameEndedPayload } from '../types';

interface GameEndProps {
  payload: GameEndedPayload;
}

export default function GameEnd({ payload }: GameEndProps) {
  const { winner, scores } = payload;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-gray-400 text-sm uppercase tracking-widest">Fim de Jogo</p>
          {winner === 'tie' ? (
            <h2 className="text-4xl font-extrabold text-yellow-400">Empate!</h2>
          ) : (
            <>
              <h2 className="text-4xl font-extrabold text-yellow-400">
                Time {winner} venceu!
              </h2>
              <div className="text-6xl">
                {winner === 'A' ? '🔵' : '🟢'}
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-900 rounded-2xl p-6">
          <p className="text-gray-500 text-sm uppercase tracking-wide mb-4">Placar final</p>
          <div className="grid grid-cols-2 gap-4">
            {(['A', 'B'] as const).map((team) => (
              <div
                key={team}
                className={`rounded-xl p-5 border-2 ${
                  winner === team
                    ? team === 'A'
                      ? 'border-blue-500 bg-blue-950'
                      : 'border-green-500 bg-green-950'
                    : 'border-gray-700 bg-gray-800'
                }`}
              >
                <p
                  className={`text-xs uppercase tracking-wide font-semibold ${
                    team === 'A' ? 'text-blue-400' : 'text-green-400'
                  }`}
                >
                  Time {team}
                  {winner === team && ' ★'}
                </p>
                <p className="text-5xl font-extrabold text-white mt-2">
                  {scores[team]}
                </p>
                <p className="text-xs text-gray-500">palavras</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold text-lg rounded-xl py-4 transition-colors"
        >
          Jogar novamente
        </button>
      </div>
    </div>
  );
}
