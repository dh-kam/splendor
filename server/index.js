import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { SplendorGame } from './game.js';

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
  // Deep copy game state
  const state = {
    status: game.status,
    currentPlayerIndex: game.currentPlayerIndex,
    nobles: game.nobles,
    board: game.board,
    gems: game.gems,
    logs: game.logs,
    winner: game.winner,
    focusMap: game.focusMap || {},
    players: game.players.map(p => {
      // Create copy of player
      const pCopy = {
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
      };
      return pCopy;
    }),
    localIp: LOCAL_IP,
    port: PORT
  };
  return state;
}

// Broadcast game state to all clients
function broadcastState() {
  // TV View gets the complete state (though they shouldn't see reserved card details either, except total counts)
  io.to('tv').emit('state-update', getMaskedState(null));

  // Sandbox View gets the complete unmasked state
  io.to('sandbox').emit('state-update', getMaskedState('sandbox'));

  // Each player gets their own customized state
  for (const [pId, session] of sessions.entries()) {
    if (session.socketId) {
      io.to(session.socketId).emit('state-update', getMaskedState(pId));
    }
  }

  // Check and trigger AI turns
  if (game.status === 'playing') {
    const currentPlayer = game.getCurrentPlayer();
    console.log(`[AI Check] Current Player: ${currentPlayer?.name}, isAi: ${currentPlayer?.isAi}, aiActive: ${currentPlayer?.aiActive}`);
    if (currentPlayer && currentPlayer.isAi && !currentPlayer.aiActive) {
      currentPlayer.aiActive = true;
      console.log(`[AI Trigger] Triggering AI turn for ${currentPlayer.name} (${currentPlayer.id}) in 1500ms...`);
      setTimeout(() => {
        runAiTurn(currentPlayer.id);
      }, 1500); // 1.5s delay to make AI moves easy to follow
    }
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

  // Register client as Sandbox
  socket.on('register-sandbox', () => {
    socket.join('sandbox');
    socket.emit('state-update', getMaskedState('sandbox'));
    console.log(`Sandbox registered: ${socket.id}`);
  });

  // Player joins or reconnects
  socket.on('join-game', ({ playerId, name, isAi }) => {
    if (!playerId || !name) return;

    // Check if player session exists
    let existingPlayer = game.players.find(p => p.id === playerId);

    if (existingPlayer) {
      // Reconnect existing player
      sessions.set(playerId, { name, socketId: socket.id });
      socket.join(`player-${playerId}`);
      console.log(`Player reconnected: ${name} (${playerId})`);
      game.log(`${name} reconnected.`);
    } else {
      // New player joining
      if (game.status !== 'lobby') {
        socket.emit('error-message', 'Game has already started.');
        return;
      }
      if (game.players.length >= 4) {
        socket.emit('error-message', 'Game is full (max 4 players).');
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
        socket.emit('error-message', 'Failed to join game.');
        return;
      }
    }

    broadcastState();
  });

  socket.on('start-game', () => {
    const success = game.start();
    if (success) {
      broadcastState();
    } else {
      socket.emit('error-message', 'Cannot start game. Need 2-4 players.');
    }
  });

  socket.on('take-gems', ({ playerId, colors }) => {
    const res = game.takeThreeGems(playerId, colors);
    if (res.success) {
      broadcastState();
    } else {
      socket.emit('error-message', res.reason);
    }
  });

  socket.on('take-two-gems', ({ playerId, color }) => {
    const res = game.takeTwoGems(playerId, color);
    if (res.success) {
      broadcastState();
    } else {
      socket.emit('error-message', res.reason);
    }
  });

  socket.on('reserve-card', ({ playerId, cardId, tier }) => {
    const res = game.reserveCard(playerId, cardId, tier);
    if (res.success) {
      broadcastState();
    } else {
      socket.emit('error-message', res.reason);
    }
  });

  socket.on('buy-card', ({ playerId, cardId }) => {
    const res = game.buyCard(playerId, cardId);
    if (res.success) {
      broadcastState();
    } else {
      socket.emit('error-message', res.reason);
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
      socket.emit('error-message', res.reason);
    }
  });

  socket.on('test-reset-game', () => {
    game = new SplendorGame();
    sessions.clear();
    console.log('Game state completely wiped for testing.');
    broadcastState();
  });

  socket.on('restart-game', () => {
    const playersBackup = [...game.players];
    game = new SplendorGame();
    // Add players back in
    for (const p of playersBackup) {
      game.addPlayer(p.id, p.name);
    }
    game.log('Game reset by player.');
    broadcastState();
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Find player associated with this socket
    for (const [playerId, session] of sessions.entries()) {
      if (session.socketId === socket.id) {
        // We keep the player in the game for potential reconnect
        // Mark socketId as null
        sessions.set(playerId, { ...session, socketId: null });
        
        // Schedule auto-removal if in lobby, or log disconnect in game
        if (game.status === 'lobby') {
          setTimeout(() => {
            const currentSession = sessions.get(playerId);
            if (currentSession && !currentSession.socketId) {
              game.removePlayer(playerId);
              sessions.delete(playerId);
              broadcastState();
            }
          }, 10000); // Wait 10 seconds to auto-remove in lobby
        } else {
          game.log(`${session.name} disconnected.`);
          broadcastState();
        }
        break;
      }
    }
  });
});

// ==========================================
// 🤖 AI BOT DECISION ENGINE (HEURISTIC)
// ==========================================

function runAiTurn(playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player || game.status !== 'playing') {
    console.log(`[AI Run ERROR] Player ${playerId} not found or game not in playing state.`);
    return;
  }
  console.log(`\n[AI Run] --- START TURN for ${player.name} (${player.id}) ---`);

  // Case A: AI must return excess gems (>10 limit)
  if (player.requiresGemReturn) {
    const totalGems = Object.values(player.gems).reduce((a, b) => a + b, 0);
    const toReturn = totalGems - 10;
    const returnGems = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
    
    // Sort owned gem colors descending (return most abundant gems first, keep gold)
    const sortedColors = Object.entries(player.gems)
      .filter(([color, val]) => val > 0 && color !== 'gold')
      .sort((a, b) => b[1] - a[1]);
      
    let returned = 0;
    for (const [color, val] of sortedColors) {
      const take = Math.min(val, toReturn - returned);
      returnGems[color] = take;
      returned += take;
      if (returned >= toReturn) break;
    }
    
    // If still need to return, take from gold
    if (returned < toReturn && player.gems.gold > 0) {
      returnGems.gold = Math.min(player.gems.gold, toReturn - returned);
    }
    
    console.log(`[AI Run] ${player.name} returning gems: ${JSON.stringify(returnGems)}`);
    game.returnGems(playerId, returnGems);
    player.aiActive = false;
    broadcastState();
    return;
  }

  // Case B: Regular action
  
  // 1. Scan for affordable cards to buy (check reserved first, then board)
  const affordable = [];
  
  // Check reserved cards
  for (const card of player.reserved) {
    if (aiCanAfford(player, card)) {
      affordable.push({ card, fromReserved: true });
    }
  }
  
  // Check board cards
  for (let tier = 3; tier >= 1; tier--) {
    for (const card of game.board[tier]) {
      if (aiCanAfford(player, card)) {
        affordable.push({ card, fromReserved: false });
      }
    }
  }
  
  // If we can buy, choose the one with highest prestige points (PV), or higher tier
  if (affordable.length > 0) {
    affordable.sort((a, b) => {
      if (b.card.points !== a.card.points) return b.card.points - a.card.points;
      return b.card.level - a.card.level;
    });
    
    const choice = affordable[0];
    console.log(`[AI Run] ${player.name} DECISION: Buy card ${choice.card.id} (Tier ${choice.card.level}, Color ${choice.card.color}, Points ${choice.card.points})`);
    const buyResult = game.buyCard(playerId, choice.card.id);
    console.log(`[AI Run] Buy result: ${JSON.stringify(buyResult)}`);
    player.aiActive = false;
    broadcastState();
    return;
  }

  // 2. If can't buy, choose a target card we are closest to affording, and collect gems
  const targets = [];
  for (let tier = 1; tier <= 3; tier++) {
    for (const card of game.board[tier]) {
      const missing = aiGetMissingGemsCount(player, card);
      targets.push({ card, missing });
    }
  }
  
  // Sort targets by missing count ascending (least missing gems first)
  targets.sort((a, b) => a.missing.total - b.missing.total);
  
  const bestTarget = targets[0];
  console.log(`[AI Run] ${player.name} Target Card: ${bestTarget ? bestTarget.card.id : 'None'} (Missing total gems: ${bestTarget ? bestTarget.missing.total : 0})`);
  
  if (bestTarget && bestTarget.missing.total > 0) {
    const missingColors = Object.keys(bestTarget.missing.colors).filter(color => color !== 'gold');
    
    // Check if we need 2 or more of a single color, and bank has >= 4
    let doubleTaken = false;
    for (const color of missingColors) {
      if (bestTarget.missing.colors[color] >= 2 && game.gems[color] >= 4) {
        console.log(`[AI Run] ${player.name} DECISION: Try to take 2 gems of color ${color}`);
        const res = game.takeTwoGems(playerId, color);
        console.log(`[AI Run] Take two result: ${JSON.stringify(res)}`);
        if (res.success) {
          doubleTaken = true;
          break;
        }
      }
    }
    
    if (!doubleTaken) {
      // Try to take 3 different colors we need
      const toTake = [];
      for (const color of missingColors) {
        if (game.gems[color] > 0) {
          toTake.push(color);
        }
        if (toTake.length === 3) break;
      }
      
      // If we don't have 3 missing colors, fill up with other available gems
      if (toTake.length < 3) {
        const available = ['white', 'blue', 'green', 'red', 'black'].filter(c => !toTake.includes(c) && game.gems[c] > 0);
        for (const c of available) {
          toTake.push(c);
          if (toTake.length === 3) break;
        }
      }
      
      if (toTake.length > 0) {
        console.log(`[AI Run] ${player.name} DECISION: Try to take 3 gems: ${toTake}`);
        const res = game.takeThreeGems(playerId, toTake);
        console.log(`[AI Run] Take three result: ${JSON.stringify(res)}`);
      } else {
        // If absolutely no gems can be taken from bank, reserve a card to get gold
        console.log(`[AI Run] ${player.name} DECISION: Bank empty of needed gems, reserving instead.`);
        aiReserveRandomCard(player);
      }
    }
    
    player.aiActive = false;
    broadcastState();
    return;
  }

  // Fallback: reserve a random card
  console.log(`[AI Run] ${player.name} DECISION: Fallback to reserve random card.`);
  aiReserveRandomCard(player);
  player.aiActive = false;
  broadcastState();
}

function aiReserveRandomCard(player) {
  if (player.reserved.length >= 3) {
    const available = ['white', 'blue', 'green', 'red', 'black'].filter(c => game.gems[c] > 0);
    if (available.length > 0) {
      console.log(`[AI Run] Hand full, taking single gem: ${available[0]}`);
      const res = game.takeThreeGems(player.id, [available[0]]);
      console.log(`[AI Run] Gem take result: ${JSON.stringify(res)}`);
    } else {
      console.log(`[AI Run] Hand full & Bank empty. Passing turn.`);
      game.endTurn();
    }
    return;
  }
  
  for (let tier = 3; tier >= 1; tier--) {
    if (game.board[tier].length > 0) {
      const card = game.board[tier][0];
      console.log(`[AI Run] Reserving card ${card.id} (Tier ${tier})`);
      const res = game.reserveCard(player.id, card.id);
      console.log(`[AI Run] Reserve result: ${JSON.stringify(res)}`);
      return;
    }
  }
  
  console.log(`[AI Run] Board empty. Passing turn.`);
  game.endTurn();
}

function aiCanAfford(player, card) {
  let goldNeeded = 0;
  for (const color of ['white', 'blue', 'green', 'red', 'black']) {
    const cost = card.cost[color] || 0;
    const discount = player.discounts[color] || 0;
    const net = Math.max(0, cost - discount);
    if (player.gems[color] < net) {
      goldNeeded += (net - player.gems[color]);
    }
  }
  return player.gems.gold >= goldNeeded;
}

function aiGetMissingGemsCount(player, card) {
  const colors = {};
  let total = 0;
  for (const color of ['white', 'blue', 'green', 'red', 'black']) {
    const cost = card.cost[color] || 0;
    const discount = player.discounts[color] || 0;
    const net = Math.max(0, cost - discount);
    if (player.gems[color] < net) {
      const diff = net - player.gems[color];
      colors[color] = diff;
      total += diff;
    }
  }
  return { total, colors };
}

// Serve Vite production build static assets
app.use(express.static(path.join(__dirname, '../dist')));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`=============================================`);
  console.log(`Splendor Local Server is running!`);
  console.log(`TV View: http://localhost:${PORT}`);
  console.log(`Mobile View: http://${LOCAL_IP}:${PORT}`);
  console.log(`=============================================`);
});
