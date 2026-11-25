import { SplendorGame } from './game.js';

export const LOCAL_ROOM_ID = 'local-table';

/**
 * Explicit reset authorization guard.
 * Prevents resetting an active ('playing') match's board and chips unless:
 *  - The game is not yet playing ('lobby') or has ended per game rules ('finished'), OR
 *  - The player explicitly left the match to setup ('leftToSetup'), OR
 *  - The player explicitly confirmed a manual restart ('explicit-user-restart' + explicitConfirm).
 */
export function canResetRoom(
  room,
  { trigger = 'unknown', explicitConfirm = false } = {}
) {
  if (!room || !room.game) {
    return { allowed: true, reason: 'new-room' };
  }

  const status = room.game.status;
  if (status === 'lobby') {
    return { allowed: true, reason: 'lobby' };
  }

  if (status === 'finished') {
    return { allowed: true, reason: 'end-of-game' };
  }

  // Active game ('playing'): block resets unless explicitly authorized
  if (trigger === 'new-match-from-lobby' && room.leftToSetup) {
    return { allowed: true, reason: 'returned-to-setup' };
  }

  if (trigger === 'explicit-user-restart' && explicitConfirm === true) {
    return { allowed: true, reason: 'explicit-user-restart' };
  }

  return {
    allowed: false,
    reason: 'active-game-in-progress',
  };
}

/**
 * Isolated per-session game room manager.
 * Keeps every solo/sandbox match in its own private room so concurrent tabs,
 * previews, or devices can never reset or hijack another player's game.
 * TV + Mobile local multiplayer shares the dedicated LOCAL_ROOM_ID room.
 */
export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.ensureRoom(LOCAL_ROOM_ID, 'local');
  }

  ensureRoom(roomId, kind = 'sandbox') {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        kind, // 'local' | 'sandbox'
        mode: kind === 'local' ? 'local' : 'pve',
        game: new SplendorGame(),
        sessions: new Map(), // playerId -> { name, socketId }
        aiTurnTimer: null,
        scheduledAiKey: null,
        turnTimeoutTimer: null,
        scheduledTimeoutKey: null,
        idlePauseTimer: null,
        leftToSetup: false,
        lastActivityAt: Date.now(),
      };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  getRoom(roomId) {
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  getLocalRoom() {
    return this.ensureRoom(LOCAL_ROOM_ID, 'local');
  }

  clearAiTimer(room) {
    if (!room) return;
    if (room.aiTurnTimer) {
      clearTimeout(room.aiTurnTimer);
      room.aiTurnTimer = null;
    }
    room.scheduledAiKey = null;
  }

  clearTimeoutTimer(room) {
    if (!room) return;
    if (room.turnTimeoutTimer) {
      clearTimeout(room.turnTimeoutTimer);
      room.turnTimeoutTimer = null;
    }
    room.scheduledTimeoutKey = null;
  }

  clearIdlePauseTimer(room) {
    if (!room) return;
    if (room.idlePauseTimer) {
      clearTimeout(room.idlePauseTimer);
      room.idlePauseTimer = null;
    }
  }

  clearTurnTimers(room) {
    this.clearAiTimer(room);
    this.clearTimeoutTimer(room);
  }

  markLeftToSetup(room) {
    if (!room) return;
    room.leftToSetup = true;
  }

  /**
   * Resolves a canonical sandbox room ID scoped to the caller's tab/session.
   */
  resolveSandboxRoomId(rawRoomId, fallbackKey) {
    const clean = typeof rawRoomId === 'string' ? rawRoomId.trim() : '';
    const suffix = clean || (typeof fallbackKey === 'string' ? fallbackKey.trim() : '');
    if (!suffix) return null;
    return suffix.startsWith('sandbox:') ? suffix : `sandbox:${suffix}`;
  }

  /**
   * Creates or resets a private sandbox match ONLY when authorized by canResetRoom.
   * If an active match is already playing and reset was not explicitly authorized,
   * preserves the existing board, chips, and player turn intact.
   */
  createOrResetSandboxRoom(
    roomId,
    {
      mode = 'pve',
      count = 3,
      playerId = null,
      playerName = '',
      socketId = null,
      trigger = 'new-match-from-lobby',
      explicitConfirm = false,
    } = {}
  ) {
    const existing = this.getRoom(roomId);
    const guard = canResetRoom(existing, { trigger, explicitConfirm });
    if (!guard.allowed && existing) {
      if (playerId && existing.game.players.some((p) => p.id === playerId)) {
        const p = existing.game.players.find((pl) => pl.id === playerId);
        existing.sessions.set(playerId, { name: p.name, socketId });
      }
      existing.lastActivityAt = Date.now();
      return { room: existing, reset: false, reason: guard.reason };
    }

    const room = this.ensureRoom(roomId, 'sandbox');
    this.clearTurnTimers(room);
    this.clearIdlePauseTimer(room);

    const game = new SplendorGame();
    room.game = game;
    room.mode = mode === 'spec' ? 'spec' : 'pve';
    room.leftToSetup = false;
    room.sessions.clear();
    room.lastActivityAt = Date.now();

    const totalPlayers = count === 4 ? 4 : 3;
    if (room.mode === 'pve' && playerId) {
      const cleanName = (playerName || '').trim() || '나 (상인)';
      game.addPlayer(playerId, cleanName);
      room.sessions.set(playerId, { name: cleanName, socketId });
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
    return { room, reset: true, reason: guard.reason };
  }

  /**
   * Restarts only the specified room when authorized (end-of-game or explicit user confirmation).
   */
  restartRoom(room, { trigger = 'end-of-game', explicitConfirm = false } = {}) {
    if (!room) return { room: null, reset: false, reason: 'room-not-found' };

    const guard = canResetRoom(room, { trigger, explicitConfirm });
    if (!guard.allowed) {
      return { room, reset: false, reason: guard.reason };
    }

    this.clearTurnTimers(room);
    const playersBackup = [...room.game.players];
    const nextGame = new SplendorGame();

    for (const p of playersBackup) {
      const addedOk = nextGame.addPlayer(p.id, p.name);
      if (addedOk) {
        const added = nextGame.players.find((pl) => pl.id === p.id);
        if (added) added.isAi = !!p.isAi;
      }
    }

    if (playersBackup.length >= 2) {
      nextGame.start();
    }
    nextGame.log('새 게임이 시작되었습니다.');
    room.game = nextGame;
    room.leftToSetup = false;
    room.lastActivityAt = Date.now();
    return { room, reset: true, reason: guard.reason };
  }

  /**
   * Removes idle abandoned sandbox rooms so long-running servers never leak memory.
   */
  pruneStaleSandboxRooms(activeRoomIds = new Set(), maxIdleMs = 15 * 60 * 1000) {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.kind !== 'sandbox') continue;
      if (activeRoomIds.has(roomId)) continue;
      if (now - room.lastActivityAt > maxIdleMs) {
        this.clearTurnTimers(room);
        this.clearIdlePauseTimer(room);
        this.rooms.delete(roomId);
      }
    }
  }
}
