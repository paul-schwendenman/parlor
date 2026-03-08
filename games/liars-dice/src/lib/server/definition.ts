import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import type { ServerGameDefinition, AppServer } from '@parlor/multiplayer';
import { RoomManager } from '@parlor/multiplayer';
import { LiarsDiceEngine } from './game/LiarsDiceEngine.js';
import { createPlayer } from '../types/game.js';
import type { LiarsDiceAction } from '../types/game.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: LiarsDiceEngine,
  roomManager: RoomManager,
): void {
  engine.getNewLogEntries(); // advance log cursor

  const players = roomManager.getPlayersInRoom(roomCode);
  for (const player of players) {
    if (RoomManager.isBotPlayer(player.id)) continue;
    io.to(player.id).emit('game:state', engine.getPlayerView(player.id) as never);
  }

  const spectators = roomManager.getSpectatorsInRoom(roomCode);
  if (spectators.length > 0) {
    const spectatorView = engine.getSpectatorView();
    for (const spectatorId of spectators) {
      io.to(spectatorId).emit('game:state', spectatorView as never);
    }
  }
}

export const liarsDiceDefinition: ServerGameDefinition = {
  meta: {
    id: 'liars-dice',
    name: "Liar's Dice",
    description: 'A bluffing dice game — bid on hidden dice or call the bluff!',
    minPlayers: 2,
    maxPlayers: 6,
    estimatedMinutes: '15-30',
    tags: ['dice', 'bluffing', 'competitive'],
    displayModes: ['peer'],
  },

  createLobbyCallbacks: (roomManager: RoomManager, io: AppServer) => ({
    onGameStart: (roomCode, players) => {
      const gamePlayers = players.map((p) => createPlayer(p.id, p.name));
      const engine = new LiarsDiceEngine(gamePlayers, roomCode);
      roomManager.setGameData(roomCode, engine);

      for (const player of players) {
        if (RoomManager.isBotPlayer(player.id)) continue;
        const view = engine.getPlayerView(player.id);
        io.to(player.id).emit('game:state', view as never);
      }

      const spectators = roomManager.getSpectatorsInRoom(roomCode);
      if (spectators.length > 0) {
        const spectatorView = engine.getSpectatorView();
        for (const spectatorId of spectators) {
          io.to(spectatorId).emit('game:state', spectatorView as never);
        }
      }
    },

    onGameReset: (roomCode) => {
      roomManager.setGameData(roomCode, null);
    },

    onPlayerDisconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<LiarsDiceEngine>(roomCode);
      if (!engine) return;

      const state = engine.getState();
      const activePlayer = state.players[state.activePlayerIndex];

      // If the disconnected player is the active bidder, auto-challenge
      if (activePlayer.id === playerId && state.phase === 'bidding' && state.currentBid) {
        try {
          engine.challenge(playerId);
          broadcastViews(io, roomCode, engine, roomManager);

          // Auto-advance to next round after a delay
          if (!state.gameOver) {
            setTimeout(() => {
              try {
                engine.startNextRound();
                broadcastViews(io, roomCode, engine, roomManager);
              } catch {
                // game may have ended
              }
            }, 3000);
          }
        } catch {
          // ignore errors
        }
      }
    },

    onPlayerReconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<LiarsDiceEngine>(roomCode);
      if (!engine) return;
      io.to(playerId).emit('game:state', engine.getPlayerView(playerId) as never);
    },
  }),

  handleGameAction: (
    io: AppServer,
    socket: AppSocket,
    roomManager: RoomManager,
    rawAction: Record<string, unknown>,
  ) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const engine = roomManager.getGameData<LiarsDiceEngine>(roomCode);
    if (!engine) return;

    const action = rawAction as unknown as LiarsDiceAction;

    try {
      switch (action.type) {
        case 'bid': {
          if (typeof action.quantity !== 'number' || typeof action.faceValue !== 'number') {
            socket.emit('error', 'Invalid bid');
            return;
          }
          engine.placeBid(socket.id, action.quantity, action.faceValue);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'challenge': {
          engine.challenge(socket.id);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'spot-on': {
          engine.spotOn(socket.id);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'nextRound': {
          engine.startNextRound();
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      socket.emit('error', message);
    }
  },
};
