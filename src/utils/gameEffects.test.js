import test from 'node:test';
import assert from 'node:assert/strict';
import { diffGameStates } from './gameEffects.js';

function makeSnapshot(overrides = {}) {
  return {
    status: 'playing',
    currentPlayerIndex: 0,
    board: {
      1: [{ id: 'c1', level: 1, color: 'red', points: 1 }],
      2: [{ id: 'c2', level: 2, color: 'blue', points: 2 }],
      3: [{ id: 'c3', level: 3, color: 'green', points: 4 }],
    },
    players: [
      {
        id: 'p1',
        name: '베네치아 상인',
        isAi: false,
        points: 0,
        cardCount: 0,
        reservedCount: 0,
        reserved: [],
        nobles: [],
        gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      },
      {
        id: 'ai1',
        name: '로렌초 (AI)',
        isAi: true,
        points: 0,
        cardCount: 0,
        reservedCount: 0,
        reserved: [],
        nobles: [],
        gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      },
    ],
    ...overrides,
  };
}

test('diffGameStates detects taken gems, turn transition, and actor whisper', () => {
  const prev = makeSnapshot();
  const next = makeSnapshot({
    currentPlayerIndex: 1,
    players: [
      {
        ...prev.players[0],
        gems: { white: 0, blue: 1, green: 1, red: 1, black: 0, gold: 0 },
      },
      prev.players[1],
    ],
  });

  const fx = diffGameStates(prev, next);
  assert.equal(fx.takenGems.length, 1);
  assert.deepEqual(fx.takenGems[0].colors, ['blue', 'green', 'red']);
  assert.equal(fx.turnChangedTo.playerId, 'ai1');
  assert.equal(fx.actorWhisper.playerId, 'p1');
  assert.ok(fx.actorWhisper.text.includes('채집'));
});

test('diffGameStates detects card purchase, replacement deal, spent gems, and noble visit', () => {
  const prev = makeSnapshot({
    players: [
      {
        ...makeSnapshot().players[0],
        gems: { white: 0, blue: 2, green: 0, red: 0, black: 0, gold: 1 },
      },
      makeSnapshot().players[1],
    ],
  });

  const next = makeSnapshot({
    currentPlayerIndex: 1,
    board: {
      1: [{ id: 'c1_new', level: 1, color: 'white', points: 0 }],
      2: prev.board[2],
      3: prev.board[3],
    },
    players: [
      {
        ...prev.players[0],
        points: 4,
        cardCount: 1,
        nobles: [{ id: 'n1', points: 3 }],
        gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      },
      prev.players[1],
    ],
  });

  const fx = diffGameStates(prev, next);
  assert.equal(fx.boardRemovals.length, 1);
  assert.equal(fx.boardRemovals[0].action, 'buy');
  assert.deepEqual(fx.dealtCardIds, ['c1_new']);
  assert.equal(fx.returnedGems[0].colors.length, 3);
  assert.equal(fx.scoreGains[0].delta, 4);
  assert.equal(fx.nobleVisits.length, 1);
  assert.equal(fx.nobleVisits[0].noble.id, 'n1');
});

test('diffGameStates reports concluding and next player on turn handoff and stays null mid-turn', () => {
  const prev = makeSnapshot({ turnSequence: 4 });
  const sameTurnNext = makeSnapshot({
    turnSequence: 4,
    currentPlayerIndex: 0,
    players: [
      { ...prev.players[0], requiresGemReturn: true },
      prev.players[1],
    ],
  });
  assert.equal(diffGameStates(prev, sameTurnNext).turnChangedTo, null);

  const handoffNext = makeSnapshot({
    turnSequence: 5,
    currentPlayerIndex: 1,
  });
  const fx = diffGameStates(prev, handoffNext);
  assert.deepEqual(fx.turnChangedTo, {
    playerId: 'ai1',
    playerName: '로렌초 (AI)',
    isAi: true,
    fromPlayerId: 'p1',
    fromPlayerName: '베네치아 상인',
    fromIsAi: false,
    turnSequence: 5,
  });
});
