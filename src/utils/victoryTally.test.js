import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVictoryTallyPlan,
  createGoldLeafField,
  createFireworkSchedule,
  buildVictoryDemoState,
} from './victoryTally';

test('buildVictoryTallyPlan computes noble vs card points, Splendor tie-breaks, and decelerating count-up timings', () => {
  const players = [
    { id: 'p1', name: '베네치아 상인', points: 15, cardCount: 9, nobles: [{ id: 'n1', points: 3 }], isAi: false },
    { id: 'ai1', name: '로렌초 (AI)', points: 15, cardCount: 7, nobles: [{ id: 'n2', points: 3 }, { id: 'n3', points: 3 }], isAi: true },
    { id: 'ai2', name: '베아트리체 (AI)', points: 11, cardCount: 8, nobles: [], isAi: true },
  ];

  const plan = buildVictoryTallyPlan(players[1], players);
  assert.equal(plan.winnerName, '로렌초');
  assert.equal(plan.winnerSeatIndex, 1);
  assert.equal(plan.totalPoints, 15);
  assert.equal(plan.noblePoints, 6);
  assert.equal(plan.cardPoints, 9);
  assert.equal(plan.nobleCount, 2);
  assert.equal(plan.cardCount, 7);

  // Standings break 15-pt tie in favor of fewer purchased cards
  assert.deepEqual(
    plan.standings.map((p) => p.id),
    ['ai1', 'p1', 'ai2']
  );

  // Step delays strictly ascend and decelerate smoothly on the final climax steps
  assert.equal(plan.stepDelaysMs.length, 15);
  for (let i = 1; i < plan.stepDelaysMs.length; i += 1) {
    assert.ok(plan.stepDelaysMs[i] > plan.stepDelaysMs[i - 1], `step ${i} must occur after step ${i - 1}`);
  }
  const earlyGap = plan.stepDelaysMs[2] - plan.stepDelaysMs[1];
  const finalGap = plan.stepDelaysMs[14] - plan.stepDelaysMs[13];
  assert.ok(finalGap > earlyGap, 'final tally step should decelerate for dramatic emphasis');
  assert.ok(plan.completeAtMs > plan.stepDelaysMs[14]);
});

test('buildVictoryTallyPlan handles zero-point edge case safely', () => {
  const plan = buildVictoryTallyPlan({ id: 'p0', name: '테스터', points: 0, cardCount: 0, nobles: [] }, []);
  assert.equal(plan.totalPoints, 0);
  assert.equal(plan.cardPoints, 0);
  assert.equal(plan.noblePoints, 0);
  assert.deepEqual(plan.stepDelaysMs, []);
  assert.ok(plan.completeAtMs > 0);
});

test('createGoldLeafField and createFireworkSchedule produce bounded, deterministic particles', () => {
  const leavesA = createGoldLeafField(40, 1492);
  const leavesB = createGoldLeafField(40, 1492);
  assert.equal(leavesA.length, 40);
  assert.deepEqual(leavesA, leavesB);
  for (const leaf of leavesA) {
    assert.ok(leaf.xNorm >= 0 && leaf.xNorm <= 1);
    assert.ok(leaf.size >= 6 && leaf.size <= 16);
    assert.ok(leaf.fallSpeed > 0);
    assert.ok(leaf.palette && leaf.palette.fill);
  }

  const bursts = createFireworkSchedule(6, 1515);
  assert.equal(bursts.length, 6);
  for (let i = 0; i < bursts.length; i += 1) {
    assert.ok(bursts[i].xNorm >= 0.08 && bursts[i].xNorm <= 0.92);
    assert.ok(bursts[i].yNorm >= 0.14 && bursts[i].yNorm <= 0.56);
    assert.ok(bursts[i].sparkCount >= 24);
    if (i > 0) {
      assert.ok(bursts[i].delayMs > bursts[i - 1].delayMs);
    }
  }
});

test('buildVictoryDemoState creates a valid finished game state with winner and standings', () => {
  const demo = buildVictoryDemoState('u_1', '도지 상인');
  assert.equal(demo.status, 'finished');
  assert.equal(demo.winner.id, 'u_1');
  assert.equal(demo.winner.name, '도지 상인');
  assert.equal(demo.winner.points, 16);
  assert.equal(demo.players.length, 3);
});
