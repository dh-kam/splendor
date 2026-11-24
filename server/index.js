import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { SplendorGame } from './game.js';
import { executeAutoMove } from './autoMove.js';

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
let game = new SplendorGame();

// Session mapping: playerId -> { name, socketId }
const sessions = new Map();

// Managed authoritative turn timers (always cleared on reset / restart / game end)
let aiTurnTimer = null;
let scheduledAiKey = null;
let turnTimeoutTimer = null;
let scheduledTimeoutKey = null;

function clearAiTimer() {
  if (aiTurnTimer) {
    clearTimeout(aiTurnTimer);
    aiTurnTimer = null;
  }
  scheduledAiKey = null;
}

function clearTimeoutTimer() {
  if (turnTimeoutTimer) {
    clearTimeout(turnTimeoutTimer);
    turnTimeoutTimer = null;
  }
  scheduledTimeoutKey = null;
}

function clearTurnTimers() {
  clearAiTimer();
  clearTimeoutTimer();
}

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

// Helper to get game state masked for a specific player
function getMaskedState(playerId = null) {
  const state = {
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

// Re-sync requesting client whenever an action is rejected to self-heal any stale turn state
function emitActionRejection(socket, playerId, reason) {
  socket.emit('error-message', reason);
  const maskTarget = socket.rooms.has('sandbox') ? 'sandbox' : (playerId || null);
  socket.emit('state-update', getMaskedState(maskTarget));
}

// Broadcast game state to all clients and schedule authoritative AI & 30s turn timeout timers
function broadcastState() {
  // TV View gets the complete state (with masked reserved hands)
  io.to('tv').emit('state-update', getMaskedState(null));

  // Sandbox View gets the complete unmasked state
  io.to('sandbox').emit('state-update', getMaskedState('sandbox'));
  const sandboxSockets = io.sockets.adapter.rooms.get('sandbox');

  // Each player gets their own customized state (skip if already delivered via sandbox room)
  for (const [pId, session] of sessions.entries()) {
    if (session.socketId && !sandboxSockets?.has(session.socketId)) {
      io.to(session.socketId).emit('state-update', getMaskedState(pId));
    }
  }

  if (game.status !== 'playing') {
    clearTurnTimers();
    return;
  }

  const currentPlayer = game.getCurrentPlayer();
  if (!currentPlayer) {
    clearTurnTimers();
    return;
  }

  const expectedGame = game;
  const expectedSeq = game.turnSequence;
  const expectedPlayerId = currentPlayer.id;
  const turnKey = `${expectedSeq}:${expectedPlayerId}:${currentPlayer.requiresGemReturn ? 'ret' : 'act'}`;

  // 1. Schedule AI move if active merchant is an AI
  if (currentPlayer.isAi) {
    if (scheduledAiKey !== turnKey) {
      clearAiTimer();
      scheduledAiKey = turnKey;
      currentPlayer.aiActive = true;
      aiTurnTimer = setTimeout(() => {
        aiTurnTimer = null;
        scheduledAiKey = null;
        if (
          game !== expectedGame ||
          game.status !== 'playing' ||
          game.turnSequence !== expectedSeq ||
          game.getCurrentPlayer()?.id !== expectedPlayerId
        ) {
          return;
        }
        executeAutoMove(game, expectedPlayerId, { isTimeout: false });
        broadcastState();
      }, 1500);
    }
  } else {
    clearAiTimer();
  }

  // 2. Schedule authoritative 30-second turn deadline for every active turn
  if (scheduledTimeoutKey !== `${expectedSeq}:${expectedPlayerId}`) {
    clearTimeoutTimer();
    scheduledTimeoutKey = `${expectedSeq}:${expectedPlayerId}`;
    const remainingMs = Math.max(
      120,
      (game.turnDeadlineAt || Date.now() + game.turnDurationMs) - Date.now()
    );
    turnTimeoutTimer = setTimeout(() => {
      turnTimeoutTimer = null;
      scheduledTimeoutKey = null;
      if (
        game !== expectedGame ||
        game.status !== 'playing' ||
        game.turnSequence !== expectedSeq ||
        game.getCurrentPlayer()?.id !== expectedPlayerId
      ) {
        return;
      }
      const actor = game.getCurrentPlayer();
      const result = executeAutoMove(game, expectedPlayerId, { isTimeout: true });
      if (result.success) {
        io.emit('turn-timeout', {
          playerId: expectedPlayerId,
          playerName: actor?.name || '',
          turnSequence: expectedSeq,
          action: result.move?.type || 'auto',
        });
        broadcastState();
      }
    }, remainingMs);
  }
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Register client as TV
  socket.on('register-tv', () => {
    socket.join('tv');
    socket.emit('state-update', getMaskedState(null));
    console.log(`TV registered: ${socket.id}`);
  });

  // Register client as Sandbox (also refresh session socketId if player is in current game)
  socket.on('register-sandbox', (payload) => {
    socket.join('sandbox');
    const pid = payload && typeof payload === 'object' ? payload.playerId : null;
    if (pid) {
      const existing = game.players.find(p => p.id === pid);
      if (existing) {
        sessions.set(pid, { name: existing.name, socketId: socket.id });
      }
    }
    socket.emit('state-update', getMaskedState('sandbox'));
    console.log(`Sandbox registered: ${socket.id}`);
  });

  // Pause background sandbox timers when returning to title screen
  socket.on('leave-sandbox', () => {
    socket.leave('sandbox');
    const remainingSandbox = io.sockets.adapter.rooms.get('sandbox');
    const remainingTv = io.sockets.adapter.rooms.get('tv');
    if ((!remainingSandbox || remainingSandbox.size === 0) && (!remainingTv || remainingTv.size === 0)) {
      clearTurnTimers();
    }
  });

  // Player joins or reconnects
  socket.on('join-game', ({ playerId, name, isAi }) => {
    if (!playerId || !name) return;

    let existingPlayer = game.players.find(p => p.id === playerId);

    if (existingPlayer) {
      sessions.set(playerId, { name, socketId: socket.id });
      socket.join(`player-${playerId}`);
      console.log(`Player reconnected: ${name} (${playerId})`);
      game.log(`${name} reconnected.`);
    } else {
      if (game.status !== 'lobby') {
        socket.emit('error-message', '이미 진행 중인 게임입니다.');
        socket.emit('state-update', getMaskedState(playerId));
        return;
      }
      if (game.players.length >= 4) {
        socket.emit('error-message', '최대 4인까지 참가할 수 있습니다.');
        return;
      }

      const success = game.addPlayer(playerId, name);
      if (success) {
        const added = game.players.find(p => p.id === playerId);
        if (added) added.isAi = !!isAi;

        sessions.set(playerId, { name, socketId: socket.id });
        socket.join(`player-${playerId}`);
        console.log(`Player joined: ${name} (${playerId}) ${isAi ? '[AI]' : ''}`);
      } else {
        socket.emit('error-message', '게임 참가에 실패했습니다.');
        return;
      }
    }

    broadcastState();
  });

  socket.on('start-game', () => {
    clearTurnTimers();
    const success = game.start();
    if (success) {
      broadcastState();
    } else {
      socket.emit('error-message', '게임을 시작하려면 2~4명의 상인이 필요합니다.');
    }
  });

  socket.on('take-gems', ({ playerId, colors }) => {
    const res = game.takeThreeGems(playerId, colors);
    if (res.success) {
      broadcastState();
    } else {
      emitActionRejection(socket, playerId, res.reason);
    }
  });

  socket.on('take-two-gems', ({ playerId, color }) => {
    const res = game.takeTwoGems(playerId, color);
    if (res.success) {
      broadcastState();
    } else {
      emitActionRejection(socket, playerId, res.reason);
    }
  });

  socket.on('reserve-card', ({ playerId, cardId, tier }) => {
    const res = game.reserveCard(playerId, cardId, tier);
    if (res.success) {
      broadcastState();
    } else {
      emitActionRejection(socket, playerId, res.reason);
    }
  });

  socket.on('buy-card', ({ playerId, cardId }) => {
    const res = game.buyCard(playerId, cardId);
    if (res.success) {
      broadcastState();
    } else {
      emitActionRejection(socket, playerId, res.reason);
    }
  });

  socket.on('focus-card', ({ playerId, cardId }) => {
    game.setFocus(playerId, cardId);
    broadcastState();
  });

  socket.on('unfocus-card', ({ playerId }) => {
    game.clearFocus(playerId);
    broadcastState();
  });

  socket.on('return-gems', ({ playerId, gemCounts }) => {
    const res = game.returnGems(playerId, gemCounts);
    if (res.success) {
      broadcastState();
    } else {
      emitActionRejection(socket, playerId, res.reason);
    }
  });

  socket.on('test-reset-game', () => {
    clearTurnTimers();
    game = new SplendorGame();
    sessions.clear();
    console.log('Game state completely wiped for testing.');
    broadcastState();
  });

  socket.on('start-sandbox', ({ mode = 'pve', count = 3, playerId: humanId, playerName: humanName }) => {
    clearTurnTimers();
    game = new SplendorGame();
    sessions.clear();
    socket.join('sandbox');

    const totalPlayers = count === 4 ? 4 : 3;
    if (mode === 'pve' && humanId) {
      const cleanName = (humanName || '').trim() || '나 (상인)';
      game.addPlayer(humanId, cleanName);
      sessions.set(humanId, { name: cleanName, socketId: socket.id });
      const aiNames = ['로렌초 (AI)', '베아트리체 (AI)', '코시모 (AI)'];
      for (let i = 0; i < totalPlayers - 1; i++) {
        const aiId = `sandbox_ai${i + 1}`;
        game.addPlayer(aiId, aiNames[i]);
        const added = game.players.find((p) => p.id === aiId);
        if (added) added.isAi = true;
      }
    } else {
      const aiNames = ['로렌초 (AI)', '베아트리체 (AI)', '코시모 (AI)', '이사벨라 (AI)'];
      for (let i = 0; i < totalPlayers; i++) {
        const aiId = `sandbox_ai${i + 1}`;
        game.addPlayer(aiId, aiNames[i]);
        const added = game.players.find((p) => p.id === aiId);
        if (added) added.isAi = true;
      }
    }

    game.start();
    broadcastState();
  });

  socket.on('restart-game', () => {
    clearTurnTimers();
    const playersBackup = [...game.players];
    game = new SplendorGame();
    // Add players back in while preserving AI status
    for (const p of playersBackup) {
      const addedOk = game.addPlayer(p.id, p.name);
      if (addedOk) {
        const added = game.players.find(pl => pl.id === p.id);
        if (added) added.isAi = !!p.isAi;
      }
    }
    if (playersBackup.length >= 2) {
      game.start();
    }
    game.log('새 게임이 시작되었습니다.');
    broadcastState();
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Find player associated with this socket
    for (const [playerId, session] of sessions.entries()) {
      if (session.socketId === socket.id) {
        sessions.set(playerId, { ...session, socketId: null });

        if (game.status === 'lobby') {
          setTimeout(() => {
            const currentSession = sessions.get(playerId);
            if (currentSession && !currentSession.socketId) {
              game.removePlayer(playerId);
              sessions.delete(playerId);
              broadcastState();
            }
          }, 10000);
        } else {
          game.log(`${session.name} disconnected.`);
          broadcastState();
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
      server: { middlewareMode: true, hmr: false },
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
