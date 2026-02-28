import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { Room } from './game/Room';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/types';

export function createApp(clientOrigin = 'http://localhost:5173') {
  const app = express();
  const httpServer = http.createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: [clientOrigin, 'http://localhost:5173'],
      methods: ['GET', 'POST'],
    },
  });

  // ── Room registry ──────────────────────────────────────────────────────────

  const rooms = new Map<string, Room>();

  function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 4 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
    } while (rooms.has(code));
    return code;
  }

  function getOrError(roomCode: string, socketId: string): Room | null {
    const room = rooms.get(roomCode);
    if (!room) {
      io.to(socketId).emit('error', { message: 'Sala não encontrada.' });
      return null;
    }
    return room;
  }

  // ── Socket.io events ────────────────────────────────────────────────────────

  io.on('connection', (socket) => {
    let currentRoomCode: string | null = null;

    function leaveCurrentRoom() {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.removePlayer(socket.id);
        socket.leave(currentRoomCode);
        if (room.isEmpty()) {
          room.destroy();
          rooms.delete(currentRoomCode);
        } else {
          room.broadcastState();
        }
      }
      currentRoomCode = null;
    }

    socket.on('create_room', ({ playerName }) => {
      const code = generateCode();
      const room = new Room(code, io);
      rooms.set(code, room);
      const player = room.addPlayer(socket.id, playerName.trim() || 'Jogador');
      socket.join(code);
      currentRoomCode = code;
      socket.emit('room_state', room.getState(socket.id));
      console.log(`[${code}] created by ${player.name} (${socket.id})`);
    });

    socket.on('join_room', ({ roomCode, playerName }) => {
      const code = roomCode.trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        socket.emit('error', { message: 'Sala não encontrada.' });
        return;
      }
      if (room.hasPlayer(socket.id)) {
        socket.emit('error', { message: 'Você já está nessa sala.' });
        return;
      }
      leaveCurrentRoom();
      const player = room.addPlayer(socket.id, playerName.trim() || 'Jogador');
      socket.join(code);
      currentRoomCode = code;
      room.broadcastState();
      console.log(`[${code}] ${player.name} (${socket.id}) joined`);
    });

    socket.on('choose_team', ({ team }) => {
      if (!currentRoomCode) return;
      const room = getOrError(currentRoomCode, socket.id);
      if (!room) return;
      room.setTeam(socket.id, team);
      room.broadcastState();
    });

    socket.on('start_game', () => {
      if (!currentRoomCode) return;
      const room = getOrError(currentRoomCode, socket.id);
      if (!room) return;
      const player = room.getPlayer(socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: 'Apenas o host pode iniciar.' });
        return;
      }
      if (!room.canStart()) {
        socket.emit('error', {
          message: 'São necessários 2 jogadores em cada time.',
        });
        return;
      }
      room.startGame();
    });

    socket.on('submit_hint', ({ hint }) => {
      if (!currentRoomCode) return;
      const room = getOrError(currentRoomCode, socket.id);
      if (!room) return;
      room.handleHint(socket.id, hint);
    });

    socket.on('submit_guess', ({ guess }) => {
      if (!currentRoomCode) return;
      const room = getOrError(currentRoomCode, socket.id);
      if (!room) return;
      room.handleGuess(socket.id, guess);
    });

    socket.on('skip_word', () => {
      if (!currentRoomCode) return;
      const room = getOrError(currentRoomCode, socket.id);
      if (!room) return;
      room.handleSkip(socket.id);
    });

    socket.on('ready', () => {
      if (!currentRoomCode) return;
      const room = getOrError(currentRoomCode, socket.id);
      if (!room) return;
      room.handleReady(socket.id);
    });

    socket.on('disconnect', () => {
      leaveCurrentRoom();
      console.log(`disconnected: ${socket.id}`);
    });
  });

  // ── Health check ────────────────────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  return { app, httpServer, io };
}
