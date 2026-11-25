import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager, LOCAL_ROOM_ID, canResetRoom } from './roomManager.js';

test('canResetRoom blocks resets during active playing games unless explicitly authorized', () => {
  const activePlaying = { game: { status: 'playing' }, leftToSetup: false };

  assert.equal(canResetRoom(null).allowed, true);
  assert.equal(canResetRoom({ game: { status: 'lobby' } }).allowed, true);
  assert.equal(canResetRoom({ game: { status: 'finished' } }).allowed, true);

  // Blocked while playing without authorization
  assert.deepEqual(canResetRoom(activePlaying, { trigger: 'unknown' }), {
    allowed: false,
    reason: 'active-game-in-progress',
  });
  assert.deepEqual(canResetRoom(activePlaying, { trigger: 'end-of-game' }), {
    allowed: false,
    reason: 'active-game-in-progress',
  });
  assert.deepEqual(
    canResetRoom(activePlaying, { trigger: 'explicit-user-restart', explicitConfirm: false }),
    { allowed: false, reason: 'active-game-in-progress' }
  );
  assert.deepEqual(
    canResetRoom(activePlaying, { trigger: 'new-match-from-lobby' }),
    { allowed: false, reason: 'active-game-in-progress' }
  );

  // Allowed when returned to setup or explicitly confirmed
  assert.deepEqual(
    canResetRoom({ game: { status: 'playing' }, leftToSetup: true }, { trigger: 'new-match-from-lobby' }),
    { allowed: true, reason: 'returned-to-setup' }
  );
  assert.deepEqual(
    canResetRoom(activePlaying, { trigger: 'explicit-user-restart', explicitConfirm: true }),
    { allowed: true, reason: 'explicit-user-restart' }
  );
});

test('concurrent sandbox rooms stay completely isolated when another player starts or restarts', () => {
  const manager = new RoomManager();

  const roomAId = manager.resolveSandboxRoomId('tab_a', 'p_user_a');
  const roomBId = manager.resolveSandboxRoomId('tab_b', 'p_user_b');
  assert.notEqual(roomAId, roomBId);

  const { room: roomA, reset: resetA } = manager.createOrResetSandboxRoom(roomAId, {
    mode: 'pve',
    count: 3,
    playerId: 'p_user_a',
    playerName: '베네치아 상인 A',
    socketId: 'sock_a',
  });
  assert.equal(resetA, true);

  // Player A takes 3 gems in Room A
  const takeA = roomA.game.takeThreeGems('p_user_a', ['white', 'blue', 'green']);
  assert.equal(takeA.success, true);
  const snapshotBoardA = roomA.game.board[1].map((c) => c.id);
  const snapshotSeqA = roomA.game.turnSequence;

  // Player B starts a brand-new sandbox match in Room B
  const { room: roomB, reset: resetB } = manager.createOrResetSandboxRoom(roomBId, {
    mode: 'pve',
    count: 4,
    playerId: 'p_user_b',
    playerName: '피렌체 상인 B',
    socketId: 'sock_b',
  });
  assert.equal(resetB, true);
  assert.equal(roomB.game.players.length, 4);
  assert.equal(roomB.game.players[0].id, 'p_user_b');

  // Room A MUST be completely untouched: same cards, same gems, same playerId, same turnSequence
  assert.equal(roomA.game.players.length, 3);
  assert.equal(roomA.game.players[0].id, 'p_user_a');
  assert.equal(roomA.game.players[0].gems.white, 1);
  assert.equal(roomA.game.players[0].gems.blue, 1);
  assert.equal(roomA.game.players[0].gems.green, 1);
  assert.equal(roomA.game.turnSequence, snapshotSeqA);
  assert.deepEqual(roomA.game.board[1].map((c) => c.id), snapshotBoardA);

  // Explicitly confirmed restart of Room B must also leave Room A untouched
  const restartB = manager.restartRoom(roomB, {
    trigger: 'explicit-user-restart',
    explicitConfirm: true,
  });
  assert.equal(restartB.reset, true);
  assert.equal(roomA.game.players[0].id, 'p_user_a');
  assert.equal(roomA.game.players[0].gems.white, 1);
  assert.equal(roomA.game.turnSequence, snapshotSeqA);
});

test('active match blocks unauthorized start-sandbox & restart-game resets, preserving board and chips', () => {
  const manager = new RoomManager();
  const roomId = manager.resolveSandboxRoomId('tab_guard', 'p_guard');

  const { room } = manager.createOrResetSandboxRoom(roomId, {
    mode: 'pve',
    count: 3,
    playerId: 'p_guard',
    playerName: '베네치아 상인',
    socketId: 'sock_1',
  });

  assert.equal(room.game.takeThreeGems('p_guard', ['white', 'blue', 'green']).success, true);
  const boardSnapshot = [1, 2, 3].map((t) => room.game.board[t].map((c) => c.id));
  const gemsSnapshot = { ...room.game.gems };
  const seqSnapshot = room.game.turnSequence;

  // Duplicate start-sandbox while playing without leaving to setup -> MUST BE BLOCKED
  const dupStart = manager.createOrResetSandboxRoom(roomId, {
    mode: 'pve',
    count: 3,
    playerId: 'p_guard',
    playerName: '베네치아 상인',
    socketId: 'sock_2',
    trigger: 'new-match-from-lobby',
  });
  assert.equal(dupStart.reset, false);
  assert.equal(dupStart.reason, 'active-game-in-progress');
  assert.deepEqual(
    [1, 2, 3].map((t) => room.game.board[t].map((c) => c.id)),
    boardSnapshot
  );
  assert.deepEqual(room.game.gems, gemsSnapshot);
  assert.equal(room.game.turnSequence, seqSnapshot);

  // Unconfirmed restart-game while playing -> MUST BE BLOCKED
  const blockedRestart = manager.restartRoom(room, { trigger: 'unknown', explicitConfirm: false });
  assert.equal(blockedRestart.reset, false);
  assert.equal(blockedRestart.reason, 'active-game-in-progress');
  assert.equal(room.game.turnSequence, seqSnapshot);

  // Once game finishes (end-of-game rule), restart is allowed cleanly
  room.game.status = 'finished';
  const endGameRestart = manager.restartRoom(room, { trigger: 'end-of-game' });
  assert.equal(endGameRestart.reset, true);
  assert.equal(endGameRestart.reason, 'end-of-game');
  assert.equal(room.game.status, 'playing');
  assert.equal(room.game.turnSequence, 1);

  // Explicit leave-to-setup also authorizes starting a fresh match from setup screen
  manager.markLeftToSetup(room);
  const freshStart = manager.createOrResetSandboxRoom(roomId, {
    mode: 'pve',
    count: 4,
    playerId: 'p_guard',
    playerName: '베네치아 상인',
    socketId: 'sock_3',
    trigger: 'new-match-from-lobby',
  });
  assert.equal(freshStart.reset, true);
  assert.equal(freshStart.reason, 'returned-to-setup');
  assert.equal(room.game.players.length, 4);
});

test('sandbox rooms never interfere with the shared local TV/mobile table room', () => {
  const manager = new RoomManager();
  const localRoom = manager.getLocalRoom();
  assert.equal(localRoom.id, LOCAL_ROOM_ID);
  assert.equal(localRoom.game.addPlayer('m1', '모바일1'), true);
  assert.equal(localRoom.game.addPlayer('m2', '모바일2'), true);
  assert.equal(localRoom.game.start(), true);

  const sbId = manager.resolveSandboxRoomId('tab_solo', 'solo_p1');
  manager.createOrResetSandboxRoom(sbId, {
    mode: 'pve',
    count: 3,
    playerId: 'solo_p1',
    playerName: '솔로',
    socketId: 'sock_solo',
  });

  // Local room stays playing with its exact 2 players
  assert.equal(localRoom.game.status, 'playing');
  assert.deepEqual(
    localRoom.game.players.map((p) => p.id),
    ['m1', 'm2']
  );
});

test('pruneStaleSandboxRooms removes only idle sandbox rooms and preserves active & local rooms', () => {
  const manager = new RoomManager();
  const activeId = manager.resolveSandboxRoomId('active_tab', 'p1');
  const staleId = manager.resolveSandboxRoomId('stale_tab', 'p2');

  const { room: activeRoom } = manager.createOrResetSandboxRoom(activeId, {
    playerId: 'p1',
    playerName: 'A',
  });
  const { room: staleRoom } = manager.createOrResetSandboxRoom(staleId, {
    playerId: 'p2',
    playerName: 'B',
  });
  activeRoom.lastActivityAt = Date.now() - 30 * 60 * 1000;
  staleRoom.lastActivityAt = Date.now() - 30 * 60 * 1000;

  manager.pruneStaleSandboxRooms(new Set([activeId]), 15 * 60 * 1000);

  assert.ok(manager.getRoom(activeId));
  assert.equal(manager.getRoom(staleId), null);
  assert.ok(manager.getRoom(LOCAL_ROOM_ID));
});

test('party room creates room code, seats host + up to 3 guests (max 4), and blocks 5th joiner', () => {
  const manager = new RoomManager();
  const created = manager.createPartyRoom({
    hostPlayerId: 'host_1',
    hostName: '호스트 상인',
    socketId: 'sock_host',
  });
  assert.equal(created.ok, true);
  assert.match(created.roomCode, /^[A-Z0-9]{6}$/);
  assert.equal(created.room.hostId, 'host_1');
  assert.equal(created.room.game.players.length, 1);

  // Up to 3 guests (total 4 players) can join cleanly
  const g1 = manager.joinPartyRoom(created.roomCode, { playerId: 'g1', name: '친구1', socketId: 's1' });
  const g2 = manager.joinPartyRoom(created.roomCode.toLowerCase(), { playerId: 'g2', name: '친구2', socketId: 's2' });
  const g3 = manager.joinPartyRoom(created.roomCode, { playerId: 'g3', name: '친구3', socketId: 's3' });
  assert.equal(g1.ok, true);
  assert.equal(g2.ok, true);
  assert.equal(g3.ok, true);
  assert.equal(created.room.game.players.length, 4);

  // 5th player is rejected
  const g4 = manager.joinPartyRoom(created.roomCode, { playerId: 'g4', name: '초과인원', socketId: 's4' });
  assert.equal(g4.ok, false);
  assert.equal(g4.reason, 'room-full');

  // Reconnecting an existing member is idempotent and succeeds even when full
  const reconnect = manager.joinPartyRoom(created.roomCode, { playerId: 'g2', name: '친구2', socketId: 's2_new' });
  assert.equal(reconnect.ok, true);
  assert.equal(reconnect.reconnected, true);
  assert.equal(created.room.game.players.length, 4);

  // Non-host cannot start; host starts cleanly
  const nonHostStart = manager.startPartyRoom(created.roomCode, 'g1');
  assert.equal(nonHostStart.ok, false);
  assert.equal(nonHostStart.reason, 'not-host');

  const hostStart = manager.startPartyRoom(created.roomCode, 'host_1');
  assert.equal(hostStart.ok, true);
  assert.equal(created.room.game.status, 'playing');

  // Late joiner after start is rejected
  const late = manager.joinPartyRoom(created.roomCode, { playerId: 'late', name: '지각생', socketId: 's_late' });
  assert.equal(late.ok, false);
  assert.equal(late.reason, 'already-started');
});

test('party room host can fill empty seats with AI up to max 4 players and concurrent party rooms stay isolated', () => {
  const manager = new RoomManager();
  const roomA = manager.createPartyRoom({ hostPlayerId: 'hA', hostName: '호스트A', socketId: 'sA' });
  const roomB = manager.createPartyRoom({ hostPlayerId: 'hB', hostName: '호스트B', socketId: 'sB' });
  assert.notEqual(roomA.roomCode, roomB.roomCode);

  const aiAdd = manager.addAiPlayerToPartyRoom(roomA.roomCode, 'hA');
  assert.equal(aiAdd.ok, true);
  assert.equal(roomA.room.game.players.length, 2);
  assert.equal(roomA.room.game.players[1].isAi, true);

  // Room B remains completely unaffected
  assert.equal(roomB.room.game.players.length, 1);
  assert.equal(roomB.room.game.players[0].id, 'hB');
});

