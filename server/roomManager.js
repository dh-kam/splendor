import { SplendorGame } from './game.js';

export const LOCAL_ROOM_ID = 'local-table';
export const MAX_PARTY_PLAYERS = 4;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PARTY_AI_NAMES = ['로렌초 (AI)', '베아트리체 (AI)', '코시모 (AI)'];

/**
 * Normalizes a user- or URL-supplied room code to an unambiguous uppercase string.
 */
export function normalizeRoomCode(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length < 4 || cleaned.length > 10) return null;
  return cleaned;
}

/**
 * Generates a unique 6-character uppercase room code without visually ambiguous glyphs (0/O/1/I).
 */
export function generateRoomCode(existingIds = new Set()) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }
    if (!existingIds.has(`party:${code}`)) {
      return code;
    }
  }
  return `SP${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

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
 * Supports:
 *  - 'sandbox': private solo PvE / AI-spec sessions per tab
 *  - 'party': room-code multiplayer sessions (host + up to 3 guests = max 4 players + TV/Chromecast display)
 *  - 'local': legacy single shared TV + mobile table room
 */
export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.ensureRoom(LOCAL_ROOM_ID, 'local');
  }

  ensureRoom(roomId, kind = 'sandbox', meta = {}) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        kind, // 'local' | 'sandbox' | 'party'
        mode: kind === 'local' ? 'local' : kind === 'party' ? 'party' : 'pve',
        roomCode: meta.roomCode || null,
        hostId: meta.hostId || null,
        maxPlayers: meta.maxPlayers || MAX_PARTY_PLAYERS,
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

  resolvePartyRoomId(rawCode) {
    const code = normalizeRoomCode(rawCode);
    return code ? `party:${code}` : null;
  }

  getPartyRoomByCode(rawCode) {
    const roomId = this.resolvePartyRoomId(rawCode);
    if (!roomId) return null;
    const room = this.getRoom(roomId);
    return room && room.kind === 'party' ? room : null;
  }

  /**
   * Creates a new room-code party room for Android/Web Host + Chromecast TV + up to 3 QR-joined guests.
   * Automatically seats the host as Player 1 (1 / 4).
   */
  createPartyRoom({ hostPlayerId, hostName = '', socketId = null, roomCode = null } = {}) {
    if (!hostPlayerId) {
      return { ok: false, reason: 'missing-host', message: '호스트 플레이어 정보가 필요합니다.' };
    }
    const cleanCode = normalizeRoomCode(roomCode) || generateRoomCode(new Set(this.rooms.keys()));
    const roomId = `party:${cleanCode}`;
    const existing = this.getRoom(roomId);
    if (existing) {
      this.clearTurnTimers(existing);
      this.clearIdlePauseTimer(existing);
      this.rooms.delete(roomId);
    }

    const room = this.ensureRoom(roomId, 'party', {
      roomCode: cleanCode,
      hostId: hostPlayerId,
      maxPlayers: MAX_PARTY_PLAYERS,
    });
    const cleanName = (hostName || '').trim() || '베네치아 상인';
    room.game.addPlayer(hostPlayerId, cleanName);
    room.sessions.set(hostPlayerId, { name: cleanName, socketId });
    room.lastActivityAt = Date.now();
    return { ok: true, room, roomCode: cleanCode };
  }

  /**
   * Joins or reconnects a player into a room-code party session (max 4 total: host + 3 guests).
   */
  joinPartyRoom(rawCode, { playerId, name = '', socketId = null, isAi = false } = {}) {
    const room = this.getPartyRoomByCode(rawCode);
    if (!room) {
      return { ok: false, reason: 'room-not-found', message: '해당 방 코드를 찾을 수 없습니다.' };
    }
    if (!playerId) {
      return { ok: false, reason: 'missing-player', message: '플레이어 정보가 필요합니다.' };
    }

    const cleanName = (name || '').trim() || `상인 ${room.game.players.length + 1}`;
    const existingPlayer = room.game.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      if (cleanName && room.game.status === 'lobby') {
        existingPlayer.name = cleanName;
      }
      room.sessions.set(playerId, { name: existingPlayer.name, socketId });
      room.lastActivityAt = Date.now();
      return { ok: true, room, reconnected: true };
    }

    if (room.game.status !== 'lobby') {
      return { ok: false, reason: 'already-started', message: '이미 진행 중인 게임입니다.' };
    }

    const limit = room.maxPlayers || MAX_PARTY_PLAYERS;
    if (room.game.players.length >= limit) {
      return {
        ok: false,
        reason: 'room-full',
        message: `최대 ${limit}명(호스트 + ${limit - 1}명)까지 참가할 수 있습니다.`,
      };
    }

    const addedOk = room.game.addPlayer(playerId, cleanName);
    if (!addedOk) {
      return { ok: false, reason: 'join-failed', message: '방 참가에 실패했습니다.' };
    }

    const added = room.game.players.find((p) => p.id === playerId);
    if (added) added.isAi = Boolean(isAi);
    room.sessions.set(playerId, { name: cleanName, socketId });
    room.lastActivityAt = Date.now();
    return { ok: true, room, reconnected: false };
  }

  /**
   * Allows the party host to fill an open lobby slot (up to 4 total) with a Guild AI merchant.
   */
  addAiPlayerToPartyRoom(rawCode, requesterId) {
    const room = this.getPartyRoomByCode(rawCode);
    if (!room) {
      return { ok: false, reason: 'room-not-found', message: '파티 방을 찾을 수 없습니다.' };
    }
    if (room.hostId && requesterId && room.hostId !== requesterId) {
      return { ok: false, reason: 'not-host', message: '방장만 AI 상인을 추가할 수 있습니다.' };
    }
    if (room.game.status !== 'lobby') {
      return { ok: false, reason: 'already-started', message: '이미 진행 중인 게임입니다.' };
    }
    const limit = room.maxPlayers || MAX_PARTY_PLAYERS;
    if (room.game.players.length >= limit) {
      return { ok: false, reason: 'room-full', message: `이미 최대 ${limit}명이 모두 참가했습니다.` };
    }

    const existingAiCount = room.game.players.filter((p) => p.isAi).length;
    const aiId = `party_ai_${existingAiCount + 1}_${Date.now().toString(36).slice(-3)}`;
    const aiName = PARTY_AI_NAMES[existingAiCount % PARTY_AI_NAMES.length];
    return this.joinPartyRoom(room.roomCode, {
      playerId: aiId,
      name: aiName,
      socketId: null,
      isAi: true,
    });
  }

  /**
   * Starts a party room match (requires 2..4 players; only host may trigger when hostId is set).
   */
  startPartyRoom(rawCode, requesterId) {
    const room = this.getPartyRoomByCode(rawCode);
    if (!room) {
      return { ok: false, reason: 'room-not-found', message: '파티 방을 찾을 수 없습니다.' };
    }
    if (room.hostId && requesterId && room.hostId !== requesterId) {
      return { ok: false, reason: 'not-host', message: '방장만 게임을 시작할 수 있습니다.' };
    }
    if (room.game.status !== 'lobby') {
      return { ok: false, reason: 'already-started', message: '이미 시작된 게임입니다.' };
    }
    this.clearTurnTimers(room);
    const started = room.game.start();
    if (!started) {
      return {
        ok: false,
        reason: 'insufficient-players',
        message: '게임을 시작하려면 최소 2명(최대 4명)의 상인이 필요합니다.',
      };
    }
    room.lastActivityAt = Date.now();
    return { ok: true, room };
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
   * Removes idle abandoned sandbox/party rooms so long-running k8s servers never leak memory.
   */
  pruneStaleSandboxRooms(
    activeRoomIds = new Set(),
    maxIdleMs = 15 * 60 * 1000,
    maxPartyIdleMs = 2 * 60 * 60 * 1000
  ) {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.kind !== 'sandbox' && room.kind !== 'party') continue;
      if (activeRoomIds.has(roomId)) continue;
      const threshold = room.kind === 'party' ? maxPartyIdleMs : maxIdleMs;
      if (now - room.lastActivityAt > threshold) {
        this.clearTurnTimers(room);
        this.clearIdlePauseTimer(room);
        this.rooms.delete(roomId);
      }
    }
  }
}

