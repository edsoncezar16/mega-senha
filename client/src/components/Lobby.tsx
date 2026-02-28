import React from 'react';
import { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, RoomState, TeamId } from '../types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface LobbyProps {
  socket: AppSocket;
  roomState: RoomState;
  myId: string;
}

export default function Lobby({ socket, roomState, myId }: LobbyProps) {
  const me = roomState.players.find((p) => p.id === myId);
  const teamA = roomState.players.filter((p) => p.team === 'A');
  const teamB = roomState.players.filter((p) => p.team === 'B');
  const unassigned = roomState.players.filter((p) => !p.team);

  function chooseTeam(team: TeamId) {
    socket.emit('choose_team', { team });
  }

  function startGame() {
    socket.emit('start_game');
  }

  const canStart =
    me?.isHost && teamA.length === 2 && teamB.length === 2;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-yellow-400">Mega Senha</h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-gray-400 text-sm">Código da sala:</span>
            <span className="font-mono text-2xl font-bold tracking-widest text-white bg-gray-800 px-3 py-1 rounded-lg">
              {roomState.roomCode}
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-1">Compartilhe com seus amigos</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Team A */}
          <div
            className={`rounded-2xl p-4 border-2 ${
              me?.team === 'A' ? 'border-blue-500 bg-blue-950' : 'border-gray-700 bg-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-blue-400 text-lg">Time A</h2>
              <span className="text-xs text-gray-500">{teamA.length}/2</span>
            </div>
            <ul className="space-y-1 min-h-[48px]">
              {teamA.map((p) => (
                <li key={p.id} className="text-sm text-white flex items-center gap-1">
                  {p.isHost && <span className="text-yellow-400 text-xs">★</span>}
                  {p.name}
                  {p.id === myId && <span className="text-gray-500 text-xs">(você)</span>}
                </li>
              ))}
            </ul>
            {me?.team !== 'A' && teamA.length < 2 && (
              <button
                onClick={() => chooseTeam('A')}
                className="mt-3 w-full bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
              >
                Entrar
              </button>
            )}
          </div>

          {/* Team B */}
          <div
            className={`rounded-2xl p-4 border-2 ${
              me?.team === 'B' ? 'border-green-500 bg-green-950' : 'border-gray-700 bg-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-green-400 text-lg">Time B</h2>
              <span className="text-xs text-gray-500">{teamB.length}/2</span>
            </div>
            <ul className="space-y-1 min-h-[48px]">
              {teamB.map((p) => (
                <li key={p.id} className="text-sm text-white flex items-center gap-1">
                  {p.isHost && <span className="text-yellow-400 text-xs">★</span>}
                  {p.name}
                  {p.id === myId && <span className="text-gray-500 text-xs">(você)</span>}
                </li>
              ))}
            </ul>
            {me?.team !== 'B' && teamB.length < 2 && (
              <button
                onClick={() => chooseTeam('B')}
                className="mt-3 w-full bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
              >
                Entrar
              </button>
            )}
          </div>
        </div>

        {unassigned.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Aguardando time</p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((p) => (
                <span key={p.id} className="text-sm text-gray-300 bg-gray-800 px-2 py-1 rounded">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {me?.isHost ? (
          <button
            onClick={startGame}
            disabled={!canStart}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-900 font-bold text-lg rounded-xl py-4 transition-colors"
          >
            {canStart ? 'Iniciar Jogo!' : 'Aguardando 2 jogadores por time…'}
          </button>
        ) : (
          <p className="text-center text-gray-500 text-sm">
            Aguardando o host iniciar o jogo…
          </p>
        )}
      </div>
    </div>
  );
}
