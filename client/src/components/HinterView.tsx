import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, RoomState } from '../types';
import Timer from './Timer';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface HinterViewProps {
  socket: AppSocket;
  roomState: RoomState;
  hintRejection: string | null;
  onClearRejection: () => void;
}

export default function HinterView({
  socket,
  roomState,
  hintRejection,
  onClearRejection,
}: HinterViewProps) {
  const [hint, setHint] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [roomState.hints.length]);

  useEffect(() => {
    if (hintRejection) {
      setHint('');
      inputRef.current?.focus();
      const t = setTimeout(onClearRejection, 3000);
      return () => clearTimeout(t);
    }
  }, [hintRejection, onClearRejection]);

  function submitHint() {
    const trimmed = hint.trim();
    if (!trimmed) return;
    socket.emit('submit_hint', { hint: trimmed });
    setHint('');
  }

  function skip() {
    socket.emit('skip_word');
  }

  const word = roomState.currentWord ?? '';
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

      {/* Role label */}
      <div className="text-center">
        <span className="text-yellow-400 font-bold text-sm uppercase tracking-widest">
          Você é o Dador de Dicas
        </span>
      </div>

      {/* Target word */}
      <div className="w-full max-w-lg bg-yellow-500 rounded-2xl p-6 text-center shadow-xl">
        <p className="text-xs text-yellow-900 uppercase tracking-widest mb-1 font-semibold">
          Palavra secreta
        </p>
        <p className="text-5xl font-extrabold text-gray-900 tracking-tight uppercase">
          {word}
        </p>
      </div>

      {/* Hint rejection notice */}
      {hintRejection && (
        <div className="w-full max-w-lg bg-red-900/70 border border-red-600 rounded-xl px-4 py-3 text-red-300 text-sm">
          {hintRejection}
        </div>
      )}

      {/* Hints given so far */}
      {roomState.hints.length > 0 && (
        <div className="w-full max-w-lg">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Dicas dadas</p>
          <div className="flex flex-wrap gap-2">
            {roomState.hints.map((h, i) => (
              <span
                key={i}
                className="bg-gray-800 text-gray-200 px-3 py-1 rounded-full text-sm"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hint input */}
      <div className="w-full max-w-lg flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitHint()}
          placeholder="Digite uma dica (uma palavra)…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
        <button
          onClick={submitHint}
          disabled={!hint.trim()}
          className="bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 text-gray-900 font-bold px-5 rounded-xl transition-colors"
        >
          Enviar
        </button>
      </div>

      {/* Skip */}
      <button
        onClick={skip}
        className="text-gray-500 hover:text-gray-300 text-sm underline"
      >
        Pular palavra
      </button>

      <div className="text-xs text-gray-600 text-center max-w-xs">
        A dica não pode começar com as mesmas 3 letras da palavra.
        Dica inválida = palavra pulada automaticamente.
      </div>
    </div>
  );
}
