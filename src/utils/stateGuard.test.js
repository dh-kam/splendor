import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldAcceptStateUpdate,
  shouldPreserveChipSelection,
} from './stateGuard.js';

test('shouldAcceptStateUpdate rejects cross-room broadcasts and unexpected mid-game resets', () => {
  const prev = {
    roomId: 'sandbox:room_a',
    status: 'playing',
    turnSequence: 7,
    currentPlayerIndex: 0,
    players: [{ id: 'human' }],
  };

  // Cross-room update rejected
  assert.deepEqual(
    shouldAcceptStateUpdate(
      prev,
      { ...prev, roomId: 'sandbox:room_b', turnSequence: 1 },
      { expectedRoomId: 'sandbox:room_a' }
    ),
    { accept: false, reason: 'room-mismatch' }
  );

  // Unexpected mid-game turnSequence rollback rejected
  assert.deepEqual(
    shouldAcceptStateUpdate(
      prev,
      { ...prev, turnSequence: 1 },
      { expectedRoomId: 'sandbox:room_a', allowExplicitReset: false }
    ),
    { accept: false, reason: 'unexpected-midgame-reset' }
  );

  // Explicit reset allowed when user confirmed restart
  assert.deepEqual(
    shouldAcceptStateUpdate(
      prev,
      { ...prev, turnSequence: 1 },
      { expectedRoomId: 'sandbox:room_a', allowExplicitReset: true }
    ),
    { accept: true, reason: null }
  );

  // Normal progression and same-turn clock extension (AUTO cancel) accepted
  assert.deepEqual(
    shouldAcceptStateUpdate(
      prev,
      { ...prev, turnSequence: 7, turnDurationMs: 30000 },
      { expectedRoomId: 'sandbox:room_a' }
    ),
    { accept: true, reason: null }
  );
  assert.deepEqual(
    shouldAcceptStateUpdate(
      prev,
      { ...prev, turnSequence: 8 },
      { expectedRoomId: 'sandbox:room_a' }
    ),
    { accept: true, reason: null }
  );

  // Post-finished restart accepted automatically without explicit flag
  const finishedPrev = { ...prev, status: 'finished', turnSequence: 42 };
  assert.deepEqual(
    shouldAcceptStateUpdate(
      finishedPrev,
      { ...prev, status: 'playing', turnSequence: 1 },
      { expectedRoomId: 'sandbox:room_a', allowExplicitReset: false }
    ),
    { accept: true, reason: null }
  );
});

test('shouldPreserveChipSelection keeps picked chips active on same turn and clears on turn advance', () => {
  const myTurnState = {
    status: 'playing',
    turnSequence: 4,
    currentPlayerIndex: 0,
    players: [
      { id: 'human', autoMode: true, requiresGemReturn: false },
      { id: 'ai1', isAi: true },
    ],
  };

  // Same turnSequence update (e.g. AUTO mode cancelled & clock extended 10s -> 30s): MUST PRESERVE!
  const afterCancelAuto = {
    ...myTurnState,
    turnDurationMs: 30000,
    players: [
      { id: 'human', autoMode: false, requiresGemReturn: false },
      { id: 'ai1', isAi: true },
    ],
  };
  assert.equal(shouldPreserveChipSelection(myTurnState, afterCancelAuto, 'human'), true);

  // Turn advanced to AI: drop selection
  const aiTurnState = {
    ...myTurnState,
    turnSequence: 5,
    currentPlayerIndex: 1,
  };
  assert.equal(shouldPreserveChipSelection(myTurnState, aiTurnState, 'human'), false);

  // Turn sequence advanced back to human (new round): drop stale selection
  const nextHumanRound = {
    ...myTurnState,
    turnSequence: 7,
    currentPlayerIndex: 0,
  };
  assert.equal(shouldPreserveChipSelection(myTurnState, nextHumanRound, 'human'), false);

  // Excess gem return required: drop chip pick selection
  const mustReturnState = {
    ...myTurnState,
    players: [
      { id: 'human', autoMode: false, requiresGemReturn: true },
      { id: 'ai1', isAi: true },
    ],
  };
  assert.equal(shouldPreserveChipSelection(myTurnState, mustReturnState, 'human'), false);
});
