import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { SplendorGame } from './game.js';
import { executeAutoMove } from './autoMove.js';
import { RoomManager, LOCAL_ROOM_ID, canResetRoom } from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const roomManager = new RoomManager();

// Helper to get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // family can be 'IPv4' or 4 depending on node version
      const isIPv4 = iface.family === 'IPv4' || iface.family === 4;
      if (isIPv4 && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();

// Helper to get game state masked for a specific player inside a room
function getMaskedState(room, playerId = null) {
  const game = room.game;
  const state = {
    roomId: room.id,
    status: game.status,
    currentPlayerIndex: game.currentPlayerIndex,
    turnSequence: game.turnSequence,
    turnDurationMs: game.turnDurationMs,
    turnStartedAt: game.turnStartedAt,
    turnDeadlineAt: game.turnDeadlineAt,
    serverNow: Date.now(),
    nobles: game.nobles,
    board: game.board,
    deckCounts: {
      1: game.decks[1]?.length || 0,
      2: game.decks[2]?.length || 0,
      3: game.decks[3]?.length || 0
    },
    gems: game.gems,
    logs: game.logs,
    winner: game.winner,
    focusMap: game.focusMap || {},
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      gems: { ...p.gems },
      discounts: { ...p.discounts },
      points: p.points,
      nobles: p.nobles,
      requiresGemReturn: p.requiresGemReturn,
      autoMode: Boolean(p.autoMode),
      isAi: p.isAi,
      aiActive: p.aiActive,
      // Hide reserved card details if this is not the owning player and not sandbox
      reserved: (playerId === 'sandbox' || p.id === playerId)
        ? p.reserved
        : p.reserved.map(c => ({ id: 'secret', level: c.level, color: 'secret' })),
      reservedCount: p.reserved.length,
      cardCount: p.cards.length
    })),
    localIp: LOCAL_IP,
    port: PORT
  };
  return state;
}

function getRoomSocketCount(roomId) {
  const members = io.sockets.adapter.rooms.get(roomId);
  return members ? members.size : 0;
}

function detachSocketFromSandbox(socket) {
  const prevSandboxRoomId = socket.data.sandboxRoomId;
  if (!prevSandboxRoomId) return;
  socket.leave(prevSandboxRoomId);
  socket.data.sandboxRoomId = null;

  const prevRoom = roomManager.getRoom(prevSandboxRoomId);
  if (prevRoom && getRoomSocketCount(prevSandboxRoomId) === 0) {
    roomManager.clearTurnTimers(prevRoom);
  }
}

function attachSocketToSandbox(socket, roomId) {
  if (socket.data.sandboxRoomId && socket.data.sandboxRoomId !== roomId) {
    detachSocketFromSandbox(socket);
  }
  socket.leave('tv');
  socket.join(roomId);
  socket.data.sandboxRoomId = roomId;
  socket.data.roomId = roomId;
}

function getActiveRoomForSocket(socket) {
  const roomId = socket.data.roomId || LOCAL_ROOM_ID;
  const room = roomManager.getRoom(roomId);
  if (room) return room;
  if (roomId === LOCAL_ROOM_ID) return roomManager.getLocalRoom();
  return null;
}

// Re-sync requesting client whenever an action is rejected to self-heal any stale turn state
function emitActionRejection(socket, room, playerId, reason) {
  socket.emit('error-message', reason);
  const maskTarget = room.kind === 'sandbox' ? 'sandbox' : (playerId || null);
  socket.emit('state-update', getMaskedState(room, maskTarget));
}

function emitTimeoutToRoom(room, payload) {
  if (room.kind === 'sandbox') {
    io.to(room.id).emit('turn-timeout', payload);
    return;
  }
  io.to('tv').emit('turn-timeout', payload);
  for (const [, session] of room.sessions.entries()) {
    if (session.socketId) {
      io.to(session.socketId).emit('turn-timeout', payload);
    }
  }
}

// Schedule authoritative AI & 30s turn timeout timers exclusively for this room
function scheduleRoomTimers(room) {
  const game = room.game;
  if (game.status !== 'playing') {
    roomManager.clearTurnTimers(room);
    return;
  }

  // Do not run background timers on an empty sandbox room
  if (room.kind === 'sandbox' && getRoomSocketCount(room.id) === 0) {
    roomManager.clearTurnTimers(room);
    return;
  }

  const currentPlayer = game.getCurrentPlayer();
  if (!currentPlayer) {
    roomManager.clearTurnTimers(room);
    return;
  }

  const expectedGame = game;
  const expectedSeq = game.turnSequence;
  const expectedPlayerId = currentPlayer.id;
  const turnKey = `${expectedSeq}:${expectedPlayerId}:${currentPlayer.requiresGemReturn ? 'ret' : 'act'}`;

  // 1. Schedule AI move if active merchant is an AI
  if (currentPlayer.isAi) {
    if (room.scheduledAiKey !== turnKey) {
      roomManager.clearAiTimer(room);
      room.scheduledAiKey = turnKey;
      currentPlayer.aiActive = true;
      room.aiTurnTimer = setTimeout(() => {
        room.aiTurnTimer = null;
        room.scheduledAiKey = null;
        if (
          room.game !== expectedGame ||
          room.game.status !== 'playing' ||
          room.game.turnSequence !== expectedSeq ||
          room.game.getCurrentPlayer()?.id !== expectedPlayerId
        ) {
          return;
        }
        executeAutoMove(room.game, expectedPlayerId, { isTimeout: false });
        broadcastRoomState(room);
      }, 1500);
    }
  } else {
    roomManager.clearAiTimer(room);
  }

  // 2. Schedule authoritative turn deadline (30s normal / 10s AUTO mode)
  const timeoutKey = `${expectedSeq}:${expectedPlayerId}:${game.turnDeadlineAt || 0}`;
  if (room.scheduledTimeoutKey !== timeoutKey) {
    roomManager.clearTimeoutTimer(room);
    room.scheduledTimeoutKey = timeoutKey;
    const remainingMs = Math.max(
      120,
      (game.turnDeadlineAt || Date.now() + game.turnDurationMs) - Date.now()
    );
    room.turnTimeoutTimer = setTimeout(() => {
      room.turnTimeoutTimer = null;
      room.scheduledTimeoutKey = null;
      if (
        room.game !== expectedGame ||
        room.game.status !== 'playing' ||
        room.game.turnSequence !== expectedSeq ||
        room.game.getCurrentPlayer()?.id !== expectedPlayerId
      ) {
        return;
      }
      const actor = room.game.getCurrentPlayer();
      const result = executeAutoMove(room.game, expectedPlayerId, { isTimeout: true });
      if (result.success) {
        emitTimeoutToRoom(room, {
          playerId: expectedPlayerId,
          playerName: actor?.name || '',
          turnSequence: expectedSeq,
          action: result.move?.type || 'auto',
          autoModeEnabled: Boolean(result.autoModeEnabled),
          wasAlreadyAuto: Boolean(result.wasAlreadyAuto),
        });
        broadcastRoomState(room);
      }
    }, remainingMs);
  }
}

// Broadcast game state ONLY to clients belonging to this room
function broadcastRoomState(room) {
  room.lastActivityAt = Date.now();

  if (room.kind === 'sandbox') {
    io.to(room.id).emit('state-update', getMaskedState(room, 'sandbox'));
  } else {
    // Local TV + Mobile multiplayer room
    io.to('tv').emit('state-update', getMaskedState(room, null));
    for (const [pId, session] of room.sessions.entries()) {
      if (session.socketId) {
        io.to(session.socketId).emit('state-update', getMaskedState(room, pId));
      }
    }
  }

  scheduleRoomTimers(room);
}

// Periodically prune long-idle abandoned sandbox rooms
setInterval(() => {
  const activeIds = new Set();
  for (const [roomId, room] of roomManager.rooms.entries()) {
    if (room.kind === 'sandbox' && getRoomSocketCount(roomId) > 0) {
      activeIds.add(roomId);
    }
  }
  roomManager.pruneStaleSandboxRooms(activeIds);
}, 5 * 60 * 1000).unref();

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Register client as TV (dedicated local multiplayer room)
  socket.on('register-tv', () => {
    detachSocketFromSandbox(socket);
    const localRoom = roomManager.getLocalRoom();
    socket.join('tv');
    socket.data.roomId = LOCAL_ROOM_ID;
    socket.emit('state-update', getMaskedState(localRoom, null));
    console.log(`TV registered: ${socket.id}`);
  });

  // Re-attach client to its own private sandbox room (never another player's room)
  socket.on('register-sandbox', (payload) => {
    const pid = payload && typeof payload === 'object' ? payload.playerId : null;
    const rawRoomId = payload && typeof payload === 'object' ? payload.roomId : null;
    const resolvedRoomId = roomManager.resolveSandboxRoomId(rawRoomId, pid);
    const room = resolvedRoomId ? roomManager.getRoom(resolvedRoomId) : null;

    if (!room || room.kind !== 'sandbox' || room.game.status === 'lobby') {
      socket.emit('sandbox-session-missing', { roomId: rawRoomId || null });
      return;
    }

    // Verify ownership for PvE rooms so a client can never attach to a mismatched playerId
    if (room.mode === 'pve' && pid && !room.game.players.some((p) => p.id === pid)) {
      socket.emit('sandbox-session-missing', { roomId: rawRoomId || null });
      return;
    }

    attachSocketToSandbox(socket, room.id);
    roomManager.clearIdlePauseTimer(room);
    if (pid) {
      const existing = room.game.players.find((p) => p.id === pid);
      if (existing) {
        room.sessions.set(pid, { name: existing.name, socketId: socket.id });
      }
    }
    room.lastActivityAt = Date.now();
    socket.emit('state-update', getMaskedState(room, 'sandbox'));
    scheduleRoomTimers(room);
    console.log(`Sandbox re-attached: ${socket.id} -> ${room.id}`);
  });

  // Pause timers ONLY for this client's sandbox room when returning to title screen
  socket.on('leave-sandbox', () => {
    const prevSandboxRoomId = socket.data.sandboxRoomId;
    if (prevSandboxRoomId) {
      roomManager.markLeftToSetup(roomManager.getRoom(prevSandboxRoomId));
    }
    detachSocketFromSandbox(socket);
    if (socket.data.roomId && socket.data.roomId !== LOCAL_ROOM_ID) {
      socket.data.roomId = null;
    }
  });

  // Player joins or reconnects in local TV + Mobile room
  socket.on('join-game', ({ playerId, name, isAi }) => {
    if (!playerId || !name) return;

    detachSocketFromSandbox(socket);
    const localRoom = roomManager.getLocalRoom();
    const game = localRoom.game;
    socket.data.roomId = LOCAL_ROOM_ID;

    const existingPlayer = game.players.find((p) => p.id === playerId);

    if (existingPlayer) {
      localRoom.sessions.set(playerId, { name, socketId: socket.id });
      socket.join(`player-${playerId}`);
      console.log(`Player reconnected: ${name} (${playerId})`);
      game.log(`${name} reconnected.`);
    } else {
      if (game.status !== 'lobby') {
        socket.emit('error-message', '이미 진행 중인 게임입니다.');
        socket.emit('state-update', getMaskedState(localRoom, playerId));
        return;
      }
      if (game.players.length >= 4) {
        socket.emit('error-message', '최대 4인까지 참가할 수 있습니다.');
        return;
      }

      const success = game.addPlayer(playerId, name);
      if (success) {
        const added = game.players.find((p) => p.id === playerId);
        if (added) added.isAi = !!isAi;

        localRoom.sessions.set(playerId, { name, socketId: socket.id });
        socket.join(`player-${playerId}`);
        console.log(`Player joined: ${name} (${playerId}) ${isAi ? '[AI]' : ''}`);
      } else {
        socket.emit('error-message', '게임 참가에 실패했습니다.');
        return;
      }
    }

    broadcastRoomState(localRoom);
  });

  socket.on('start-game', () => {
    const localRoom = roomManager.getLocalRoom();
    roomManager.clearTurnTimers(localRoom);
    const success = localRoom.game.start();
    if (success) {
      broadcastRoomState(localRoom);
    } else {
      socket.emit('error-message', '게임을 시작하려면 2~4명의 상인이 필요합니다.');
    }
  });

  // User touched board/chips/badge to exit AUTO mode immediately
  socket.on('cancel-auto-mode', ({ playerId } = {}) => {
    const room = getActiveRoomForSocket(socket);
    if (!room || !playerId) return;
    const { changed } = room.game.disableAutoMode(playerId, { extendClock: true });
    if (changed) {
      broadcastRoomState(room);
    }
  });

  socket.on('take-gems', ({ playerId, colors }) => {
    const room = getActiveRoomForSocket(socket);
    if (!room) {
      socket.emit('sandbox-session-missing', {});
      return;
    }
    room.game.disableAutoMode(playerId, { extendClock: false });
    const res = room.game.takeThreeGems(playerId, colors);
    if (res.success) {
      broadcastRoomState(room);
    } else {
      emitActionRejection(socket, room, playerId, res.reason);
    }
  });

  socket.on('take-two-gems', ({ playerId, color }) => {
    const room = getActiveRoomForSocket(socket);
    if (!room) {
      socket.emit('sandbox-session-missing', {});
      return;
    }
    room.game.disableAutoMode(playerId, { extendClock: false });
    const res = room.game.takeTwoGems(playerId, color);
    if (res.success) {
      broadcastRoomState(room);
    } else {
      emitActionRejection(socket, room, playerId, res.reason);
    }
  });

  socket.on('reserve-card', ({ playerId, cardId, tier }) => {
    const room = getActiveRoomForSocket(socket);
    if (!room) {
      socket.emit('sandbox-session-missing', {});
      return;
    }
    room.game.disableAutoMode(playerId, { extendClock: false });
    const res = room.game.reserveCard(playerId, cardId, tier);
    if (res.success) {
      broadcastRoomState(room);
    } else {
      emitActionRejection(socket, room, playerId, res.reason);
    }
  });

  socket.on('buy-card', ({ playerId, cardId }) => {
    const room = getActiveRoomForSocket(socket);
    if (!room) {
      socket.emit('sandbox-session-missing', {});
      return;
    }
    room.game.disableAutoMode(playerId, { extendClock: false });
    const res = room.game.buyCard(playerId, cardId);
    if (res.success) {
      broadcastRoomState(room);
    } else {
      emitActionRejection(socket, room, playerId, res.reason);
    }
  });

  socket.on('focus-card', ({ playerId, cardId }) => {
    const room = getActiveRoomForSocket(socket);
    if (!room) return;
    room.game.setFocus(playerId, cardId);
    broadcastRoomState(room);
  });

  socket.on('unfocus-card', ({ playerId }) => {
    const room = getActiveRoomForSocket(socket);
    if (!room) return;
    room.game.clearFocus(playerId);
    broadcastRoomState(room);
  });

  socket.on('return-gems', ({ playerId, gemCounts }) => {
    const room = getActiveRoomForSocket(socket);
    if (!room) {
      socket.emit('sandbox-session-missing', {});
      return;
    }
    room.game.disableAutoMode(playerId, { extendClock: false });
    const res = room.game.returnGems(playerId, gemCounts);
    if (res.success) {
      broadcastRoomState(room);
    } else {
      emitActionRejection(socket, room, playerId, res.reason);
    }
  });

  socket.on('test-reset-game', ({ confirmed = false } = {}) => {
    const room = getActiveRoomForSocket(socket);
    if (!room) return;
    const guard = canResetRoom(room, {
      trigger: 'explicit-user-restart',
      explicitConfirm: Boolean(confirmed),
    });
    if (!guard.allowed) {
      socket.emit('state-update', getMaskedState(room, room.kind === 'sandbox' ? 'sandbox' : null));
      return;
    }
    roomManager.clearTurnTimers(room);
    room.game = new SplendorGame();
    room.sessions.clear();
    console.log(`Game state reset for room ${room.id}.`);
    broadcastRoomState(room);
  });

  socket.on(
    'start-sandbox',
    ({
      roomId: rawRoomId,
      mode = 'pve',
      count = 3,
      playerId: humanId,
      playerName: humanName,
      trigger = 'new-match-from-lobby',
      explicitConfirm = false,
    } = {}) => {
      const resolvedRoomId = roomManager.resolveSandboxRoomId(rawRoomId, humanId || socket.id);
      const { room, reset } = roomManager.createOrResetSandboxRoom(resolvedRoomId, {
        mode,
        count,
        playerId: humanId,
        playerName: humanName,
        socketId: socket.id,
        trigger,
        explicitConfirm: Boolean(explicitConfirm),
      });
      attachSocketToSandbox(socket, room.id);
      if (reset) {
        broadcastRoomState(room);
        console.log(`Sandbox match started: ${room.id} (${room.mode}, ${count}p)`);
      } else {
        // Active match preserved — resync client without resetting board or chips
        socket.emit('state-update', getMaskedState(room, 'sandbox'));
        scheduleRoomTimers(room);
      }
    }
  );

  socket.on('restart-game', ({ trigger = 'end-of-game', explicitConfirm = false } = {}) => {
    const room = getActiveRoomForSocket(socket);
    if (!room) {
      socket.emit('sandbox-session-missing', {});
      return;
    }
    const { reset } = roomManager.restartRoom(room, {
      trigger,
      explicitConfirm: Boolean(explicitConfirm),
    });
    if (reset) {
      broadcastRoomState(room);
    } else {
      emitActionRejection(socket, room, null, '진행 중인 대전을 임의로 초기화할 수 없습니다.');
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    const roomId = socket.data.roomId;
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    if (room.kind === 'sandbox') {
      for (const [playerId, session] of room.sessions.entries()) {
        if (session.socketId === socket.id) {
          room.sessions.set(playerId, { ...session, socketId: null });
          break;
        }
      }
      // Pause timers gracefully if no sockets remain after 15s (keeps state intact for quick reconnects)
      roomManager.clearIdlePauseTimer(room);
      room.idlePauseTimer = setTimeout(() => {
        room.idlePauseTimer = null;
        if (getRoomSocketCount(room.id) === 0) {
          roomManager.clearTurnTimers(room);
        }
      }, 15000);
      return;
    }

    // Local TV + Mobile room disconnect handling
    for (const [playerId, session] of room.sessions.entries()) {
      if (session.socketId === socket.id) {
        room.sessions.set(playerId, { ...session, socketId: null });

        if (room.game.status === 'lobby') {
          setTimeout(() => {
            const currentSession = room.sessions.get(playerId);
            if (currentSession && !currentSession.socketId) {
              room.game.removePlayer(playerId);
              room.sessions.delete(playerId);
              broadcastRoomState(room);
            }
          }, 10000);
        } else {
          room.game.log(`${session.name} disconnected.`);
          broadcastRoomState(room);
        }
        break;
      }
    }
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        cors: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`=============================================`);
    console.log(`Splendor Server is running (${isProd ? 'production' : 'development'})!`);
    console.log(`TV View: http://localhost:${PORT}`);
    console.log(`Mobile View: http://${LOCAL_IP}:${PORT}`);
    console.log(`=============================================`);
  });
}

startServer();
