import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager } from '@parlor/multiplayer';
import type { QuixxEngine } from './QuixxEngine.js';
import { chooseBotPhase1Action, chooseBotPhase2Action } from './botStrategy.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const botTimers = new Map<string, ReturnType<typeof setTimeout>>();

function randomDelay(): number {
  return 700 + Math.random() * 500;
}

export function clearBotTimers(roomCode: string): void {
  const existing = botTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    botTimers.delete(roomCode);
  }
}

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  const players = roomManager.getPlayersInRoom(roomCode);
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
}

export function scheduleBotActions(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  if (engine.isGameOver()) return;

  const botIds = engine.getBotPlayerIds();
  if (botIds.length === 0) return;

  // Prevent double-firing
  clearBotTimers(roomCode);

  const phase = engine.getPhase();

  if (phase === 'rolling') {
    const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
    if (!activePlayer.isBot) return;

    // Bot is active player and needs to roll (only relevant if not auto-roll)
    if (!engine.shouldAutoRoll()) {
      botTimers.set(
        roomCode,
        setTimeout(() => {
          botTimers.delete(roomCode);
          if (engine.getPhase() !== 'rolling' || engine.isGameOver()) return;
          try {
            engine.rollDice();
            broadcastViews(io, roomCode, engine, roomManager);
            scheduleBotActions(io, roomCode, engine, roomManager);
          } catch {
            // Phase changed
          }
        }, randomDelay()),
      );
    }
    return;
  }

  if (phase === 'phase1') {
    // Submit phase1 decisions for all bots that haven't decided yet
    const players = engine.getPlayers();
    const botsNeeding = players.filter(
      (p) => p.isBot && p.phase1Decision === null,
    );
    if (botsNeeding.length === 0) return;

    botTimers.set(
      roomCode,
      setTimeout(() => {
        botTimers.delete(roomCode);
        if (engine.getPhase() !== 'phase1' || engine.isGameOver()) return;

        for (const bot of botsNeeding) {
          if (bot.phase1Decision !== null) continue;
          try {
            const action = chooseBotPhase1Action(
              bot.sheet,
              engine.getDice(),
              engine.getLockedRows(),
            );
            engine.submitPhase1(bot.id, action);
          } catch {
            // Already submitted
          }
        }

        broadcastViews(io, roomCode, engine, roomManager);

        if (engine.allPhase1Submitted()) {
          engine.resolvePhase1();
          broadcastViews(io, roomCode, engine, roomManager);
          if (!engine.isGameOver()) {
            scheduleBotActions(io, roomCode, engine, roomManager);
          }
        }
      }, randomDelay()),
    );
    return;
  }

  if (phase === 'phase2') {
    const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
    if (!activePlayer.isBot) return;

    botTimers.set(
      roomCode,
      setTimeout(() => {
        botTimers.delete(roomCode);
        if (engine.getPhase() !== 'phase2' || engine.isGameOver()) return;

        try {
          const action = chooseBotPhase2Action(
            activePlayer.sheet,
            engine.getDice(),
            engine.getLockedRows(),
            engine.getRemovedDice(),
          );
          engine.submitPhase2(activePlayer.id, action);

          if (engine.isGameOver()) {
            broadcastViews(io, roomCode, engine, roomManager);
          } else {
            engine.advanceTurn();
            broadcastViews(io, roomCode, engine, roomManager);

            if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) {
              // Auto-roll handles itself, but we need to schedule bot actions after
              setTimeout(() => {
                scheduleBotActions(io, roomCode, engine, roomManager);
              }, 600);
            } else {
              scheduleBotActions(io, roomCode, engine, roomManager);
            }
          }
        } catch {
          // Phase changed
        }
      }, randomDelay()),
    );
    return;
  }
}
