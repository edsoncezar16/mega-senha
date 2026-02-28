import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface HomeProps {
  socket: AppSocket;
  serverError: string | null;
  onClearError: () => void;
}

export default function Home({ socket, serverError, onClearError }: HomeProps) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');

  function handleCreate() {
    if (!name.trim()) return;
    socket.emit('create_room', { playerName: name.trim() });
  }

  function handleJoin() {
    if (!name.trim() || !joinCode.trim()) return;
    socket.emit('join_room', { roomCode: joinCode.trim().toUpperCase(), playerName: name.trim() });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-5xl font-extrabold tracking-tight text-yellow-400">
            Mega Senha
          </h1>
          <p className="text-gray-400 text-sm">Jogo de pistas em família</p>
        </div>

        {serverError && (
          <div className="bg-red-900/60 border border-red-600 rounded-lg px-4 py-3 text-red-300 text-sm flex justify-between items-center">
            <span>{serverError}</span>
            <button onClick={onClearError} className="ml-2 text-red-400 hover:text-white">✕</button>
          </div>
        )}

        <div className="bg-gray-900 rounded-2xl p-6 space-y-4 shadow-xl">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Seu nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria"
              maxLength={20}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          {mode === 'home' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('create')}
                className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg py-3 transition-colors"
              >
                Criar sala
              </button>
              <button
                onClick={() => setMode('join')}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg py-3 transition-colors"
              >
                Entrar
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-3">
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-900 font-bold rounded-lg py-3 transition-colors"
              >
                Criar sala
              </button>
              <button
                onClick={() => setMode('home')}
                className="w-full text-gray-400 hover:text-white text-sm py-1"
              >
                Voltar
              </button>
            </div>
          )}

          {mode === 'join' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Código da sala
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ex: ABCD"
                  maxLength={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 uppercase tracking-widest text-lg text-center"
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={!name.trim() || joinCode.length < 4}
                className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-900 font-bold rounded-lg py-3 transition-colors"
              >
                Entrar na sala
              </button>
              <button
                onClick={() => setMode('home')}
                className="w-full text-gray-400 hover:text-white text-sm py-1"
              >
                Voltar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
