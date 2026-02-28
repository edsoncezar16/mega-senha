import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  GuessResultPayload,
} from '../types';
import Timer from './Timer';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface GuesserViewProps {
  socket: AppSocket;
  roomState: RoomState;
  lastGuessResult: GuessResultPayload | null;
  lastWordSkipped: string | null;
  onClearGuessResult: () => void;
}

export default function GuesserView({
  socket,
  roomState,
  lastGuessResult,
  lastWordSkipped,
  onClearGuessResult,
}: GuesserViewProps) {
  const [guess, setGuess] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{
    type: 'correct' | 'wrong' | 'skipped';
    word?: string;
  } | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [roomState.hints.length]);

  useEffect(() => {
    if (lastGuessResult) {
      setFeedback(lastGuessResult.correct ? { type: 'correct', word: lastGuessResult.word } : { type: 'wrong' });
      setGuess('');
      const t = setTimeout(() => {
        setFeedback(null);
        onClearGuessResult();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [lastGuessResult, onClearGuessResult]);

  useEffect(() => {
    if (lastWordSkipped) {
      setFeedback({ type: 'skipped', word: lastWordSkipped });
      const t = setTimeout(() => setFeedback(null), 2000);
      return () => clearTimeout(t);
    }
  }, [lastWordSkipped]);

  function submitGuess() {
    const trimmed = guess.trim();
    if (!trimmed) return;
    socket.emit('submit_guess', { guess: trimmed });
    setGuess('');
  }

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
        <span className="text-purple-400 font-bold text-sm uppercase tracking-widest">
          Você é o Adivinhador
        </span>
      </div>

      {/* Feedback overlay */}
      {feedback && (
        <div
          className={`w-full max-w-lg rounded-2xl px-6 py-4 text-center text-2xl font-extrabold transition-all ${
            feedback.type === 'correct'
              ? 'bg-green-600 text-white'
              : feedback.type === 'skipped'
              ? 'bg-yellow-700 text-white'
              : 'bg-red-700 text-white'
          }`}
        >
          {feedback.type === 'correct' && `Correto! "${feedback.word}"`}
          {feedback.type === 'wrong' && 'Errado, tente de novo!'}
          {feedback.type === 'skipped' && `Pulado: "${feedback.word}"`}
        </div>
      )}

      {/* Hints */}
      <div className="w-full max-w-lg bg-gray-900 rounded-2xl p-5 min-h-[120px]">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Dicas recebidas</p>
        {roomState.hints.length === 0 ? (
          <p className="text-gray-600 text-sm">Aguardando a primeira dica…</p>
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

      {/* Guess input */}
      <div className="w-full max-w-lg flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
          placeholder="Sua resposta…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={submitGuess}
          disabled={!guess.trim()}
          className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white font-bold px-5 rounded-xl transition-colors"
        >
          Adivinhar
        </button>
      </div>

      <div className="text-xs text-gray-600 text-center">
        Round {roomState.currentRound?.round}/4 · Pontos neste round: {roomState.roundScores[roomState.currentRound?.teamId ?? 'A']}
      </div>
    </div>
  );
}
