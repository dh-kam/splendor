import test from 'node:test';
import assert from 'node:assert/strict';
import { SplendorGame, TURN_DURATION_MS, AUTO_TURN_DURATION_MS } from './game.js';
import { chooseAutoMove, executeAutoMove, buildExcessGemReturn } from './autoMove.js';

test('game initializes 30-second turn clock and increments turnSequence on turn advance', () => {
  const g = new SplendorGame();
  g.addPlayer('p1', '상인 A');
  g.addPlayer('p2', '상인 B');
  assert.equal(g.start(), true);

  assert.equal(g.turnDurationMs, TURN_DURATION_MS);
  assert.equal(g.turnDurationMs, 30000);
  assert.equal(g.turnSequence, 1);
  assert.ok(g.turnDeadlineAt - g.turnStartedAt === 30000);

  const res = g.takeThreeGems('p1', ['white', 'blue', 'green']);
  assert.equal(res.success, true);
  assert.equal(g.currentPlayerIndex, 1);
  assert.equal(g.turnSequence, 2);
});

test('validateTurn blocks normal actions while player must return excess gems', () => {
  const g = new SplendorGame();
  g.addPlayer('p1', '상인 A');
  g.addPlayer('p2', '상인 B');
  g.start();

  const p1 = g.players[0];
  p1.gems = { white: 3, blue: 3, green: 3, red: 0, black: 0, gold: 0 };
  const takeRes = g.takeThreeGems('p1', ['white', 'blue', 'red']);
  assert.equal(takeRes.success, true);
  assert.equal(p1.requiresGemReturn, true);

  // Attempting another regular move before returning gems must fail
  const blocked = g.takeThreeGems('p1', ['white', 'blue', 'green']);
  assert.equal(blocked.success, false);

  // Another player cannot return gems on p1's behalf
  const wrongPlayer = g.returnGems('p2', { white: 2, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
  assert.equal(wrongPlayer.success, false);

  // Valid gem return resolves and advances turn
  const retRes = g.returnGems('p1', { white: 2, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
  assert.equal(retRes.success, true);
  assert.equal(g.currentPlayerIndex, 1);
});

test('executeAutoMove rejects non-active players so stale timers can never steal turns', () => {
  const g = new SplendorGame();
  g.addPlayer('p1', '상인 A');
  g.addPlayer('p2', '상인 B');
  g.start();

  const res = executeAutoMove(g, 'p2', { isTimeout: true });
  assert.equal(res.success, false);
  assert.equal(g.currentPlayerIndex, 0);
});

test('timeout executeAutoMove automatically plays a valid move and resolves excess gems cleanly', () => {
  const g = new SplendorGame();
  g.addPlayer('p1', '상인 A');
  g.addPlayer('p2', '상인 B');
  g.start();

  // Give p1 9 gems and make board cards unaffordable so auto-move takes gems and triggers >10 return
  const p1 = g.players[0];
  p1.gems = { white: 3, blue: 3, green: 3, red: 0, black: 0, gold: 0 };
  for (let tier = 1; tier <= 3; tier += 1) {
    g.board[tier] = g.board[tier].map((c) => ({
      ...c,
      cost: { white: 7, blue: 7, green: 7, red: 7, black: 7 },
    }));
  }

  const move = chooseAutoMove(g, 'p1');
  assert.ok(move && (move.type === 'take-gems' || move.type === 'take-two-gems'));

  const res = executeAutoMove(g, 'p1', { isTimeout: true });
  assert.equal(res.success, true);
  // Must have auto-returned down to <= 10 and advanced to p2!
  const totalAfter = Object.values(p1.gems).reduce((a, b) => a + b, 0);
  assert.ok(totalAfter <= 10);
  assert.equal(p1.requiresGemReturn, undefined);
  assert.equal(g.currentPlayerIndex, 1);
});

test('buildExcessGemReturn preserves gold jokers whenever possible', () => {
  const counts = buildExcessGemReturn({
    gems: { white: 4, blue: 3, green: 2, red: 1, black: 0, gold: 2 },
  });
  assert.equal(counts.gold, 0);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 2);
});

test('human player can immediately take 3 distinct gems or 2 same-color gems after a 30s timeout round', () => {
  const g = new SplendorGame();
  g.addPlayer('human', '베네치아 상인');
  g.addPlayer('ai1', '로렌초 (AI)');
  g.addPlayer('ai2', '베아트리체 (AI)');
  g.players[1].isAi = true;
  g.players[2].isAi = true;
  g.start();

  // Human times out on turn 1
  const timeoutRes = executeAutoMove(g, 'human', { isTimeout: true });
  assert.equal(timeoutRes.success, true);
  assert.equal(g.getCurrentPlayer().id, 'ai1');

  // AI 1 & AI 2 finish their turns (handling any excess gem return if triggered)
  let safety = 0;
  while (g.getCurrentPlayer().id !== 'human' && safety < 10) {
    const cur = g.getCurrentPlayer();
    executeAutoMove(g, cur.id, { isTimeout: false });
    safety += 1;
  }
  assert.equal(g.getCurrentPlayer().id, 'human');
  assert.equal(g.players[0].requiresGemReturn, undefined);

  // Human immediately takes available distinct gems cleanly
  const availColors = ['white', 'blue', 'green', 'red', 'black']
    .filter((c) => g.gems[c] > 0)
    .slice(0, 3);
  assert.ok(availColors.length > 0);
  const takeRes = g.takeThreeGems('human', availColors);
  assert.equal(takeRes.success, true);
  assert.equal(g.getCurrentPlayer().id, 'ai1');
});

test('30s timeout enables AUTO mode (10s turn clock), and manual cancel restores 30s clock without resetting turnSequence', () => {
  const g = new SplendorGame();
  g.addPlayer('human', '베네치아 상인');
  g.addPlayer('ai1', '로렌초 (AI)');
  g.players[1].isAi = true;
  g.start();

  // Initial human turn is 30 seconds with autoMode OFF
  assert.equal(g.players[0].autoMode, false);
  assert.equal(g.turnDurationMs, TURN_DURATION_MS);
  assert.equal(g.turnDurationMs, 30000);

  // Human times out -> switches into AUTO mode and executes move
  const firstTimeout = executeAutoMove(g, 'human', { isTimeout: true });
  assert.equal(firstTimeout.success, true);
  assert.equal(firstTimeout.autoModeEnabled, true);
  assert.equal(firstTimeout.wasAlreadyAuto, false);
  assert.equal(g.players[0].autoMode, true);
  assert.equal(g.getCurrentPlayer().id, 'ai1');

  // AI plays -> turn returns to human, who now gets a 10-second AUTO clock
  executeAutoMove(g, 'ai1', { isTimeout: false });
  assert.equal(g.getCurrentPlayer().id, 'human');
  assert.equal(g.players[0].autoMode, true);
  assert.equal(g.turnDurationMs, AUTO_TURN_DURATION_MS);
  assert.equal(g.turnDurationMs, 10000);
  assert.equal(g.turnDeadlineAt - g.turnStartedAt, 10000);

  // If untouched for 10s, AUTO mode triggers again and stays enabled
  const secondTimeout = executeAutoMove(g, 'human', { isTimeout: true });
  assert.equal(secondTimeout.success, true);
  assert.equal(secondTimeout.wasAlreadyAuto, true);
  assert.equal(g.players[0].autoMode, true);

  // AI plays -> back to human on 10s AUTO clock
  executeAutoMove(g, 'ai1', { isTimeout: false });
  assert.equal(g.getCurrentPlayer().id, 'human');
  assert.equal(g.turnDurationMs, 10000);
  const seqBeforeCancel = g.turnSequence;
  const deadlineBeforeCancel = g.turnDeadlineAt;

  // Human touches/cancels AUTO mode -> autoMode OFF, clock extended to 30s, turnSequence UNCHANGED
  const cancelRes = g.disableAutoMode('human', { extendClock: true });
  assert.equal(cancelRes.changed, true);
  assert.equal(g.players[0].autoMode, false);
  assert.equal(g.turnSequence, seqBeforeCancel);
  assert.equal(g.turnDurationMs, TURN_DURATION_MS);
  assert.equal(g.turnDeadlineAt - g.turnStartedAt, 30000);
  assert.ok(g.turnDeadlineAt >= deadlineBeforeCancel);
});


