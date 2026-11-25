// Pure victory ceremony calculation & particle choreography helpers (unit-testable)

export const GOLD_LEAF_PALETTE = [
  { fill: '#fff5c8', edge: '#e6b84c', shimmer: '#ffffff' },
  { fill: '#f3cb6b', edge: '#b8821d', shimmer: '#fff7d6' },
  { fill: '#e5b044', edge: '#8f5f12', shimmer: '#fde8a4' },
  { fill: '#fde293', edge: '#c9922c', shimmer: '#ffffff' },
];

export const FIREWORK_PALETTE = [
  ['#fff8d6', '#f5cb62', '#d9962b'], // Florentine Gold
  ['#e0f2fe', '#60a5fa', '#2563eb'], // Royal Sapphire
  ['#ffe4e6', '#fb7185', '#e11d48'], // Venetian Ruby
  ['#dcfce7', '#34d399', '#059669'], // Guild Emerald
  ['#fffef7', '#fde68a', '#f59e0b'], // Champagne Diamond
];

/**
 * Deterministic PRNG (Mulberry32) so particle fields look organic yet remain reproducible in tests.
 */
export function createSeededRandom(seed = 1509) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Computes winner breakdown, Splendor-rule ranked standings, and a decelerating ceremonial
 * point-tally schedule (in ms from start of tally) for counting 1..totalPoints.
 */
export function buildVictoryTallyPlan(winner, players = []) {
  const safePlayers = Array.isArray(players) ? players : [];
  const standings = [...safePlayers].sort(
    (a, b) => (b.points || 0) - (a.points || 0) || (a.cardCount || 0) - (b.cardCount || 0)
  );

  const resolvedWinner =
    (winner && safePlayers.find((p) => p.id === winner.id)) ||
    winner ||
    standings[0] || {
      id: 'winner',
      name: '승리자',
      points: 0,
      cardCount: 0,
      nobles: [],
      isAi: false,
    };

  const winnerSeatIndex = Math.max(
    0,
    safePlayers.findIndex((p) => p.id === resolvedWinner.id)
  );

  const totalPoints = Math.max(0, Math.round(Number(resolvedWinner.points) || 0));
  const nobleList = Array.isArray(resolvedWinner.nobles) ? resolvedWinner.nobles : [];
  const noblePoints = nobleList.reduce((sum, n) => sum + (Number(n?.points) || 3), 0);
  const clampedNoblePoints = Math.min(totalPoints, noblePoints);
  const cardPoints = Math.max(0, totalPoints - clampedNoblePoints);
  const cardCount = Math.max(0, Number(resolvedWinner.cardCount) || 0);

  // Ceremonial count-up cadence: starts after spotlight settles (480ms), climbs briskly,
  // then slows smoothly on the final 3 points for dramatic anticipation.
  const stepDelaysMs = [];
  const initialDelayMs = 480;
  let elapsed = initialDelayMs;

  for (let step = 1; step <= totalPoints; step += 1) {
    if (step === 1) {
      stepDelaysMs.push(elapsed);
      continue;
    }
    const remaining = totalPoints - step;
    let gapMs;
    if (remaining === 0) {
      gapMs = 195;
    } else if (remaining === 1) {
      gapMs = 155;
    } else if (remaining === 2) {
      gapMs = 125;
    } else {
      const progress = step / Math.max(1, totalPoints);
      gapMs = Math.round(62 + progress * 44);
    }
    elapsed += gapMs;
    stepDelaysMs.push(elapsed);
  }

  return {
    winner: resolvedWinner,
    winnerName: (resolvedWinner.name || '승리자').replace(' (AI)', '').trim(),
    winnerSeatIndex,
    standings,
    totalPoints,
    cardPoints,
    noblePoints: clampedNoblePoints,
    cardCount,
    nobleCount: nobleList.length,
    stepDelaysMs,
    completeAtMs: stepDelaysMs.length > 0 ? stepDelaysMs[stepDelaysMs.length - 1] + 120 : initialDelayMs,
  };
}

/**
 * Generates tumbling metallic gold-leaf flake descriptors spanning the full viewport.
 */
export function createGoldLeafField(count = 54, seed = 1492) {
  const rand = createSeededRandom(seed);
  const leaves = [];
  for (let i = 0; i < count; i += 1) {
    const palette = GOLD_LEAF_PALETTE[i % GOLD_LEAF_PALETTE.length];
    leaves.push({
      xNorm: rand(),
      yNorm: rand() * 1.15 - 0.15,
      size: 6 + rand() * 9.5,
      aspect: 0.48 + rand() * 0.42,
      fallSpeed: 38 + rand() * 58,
      swayAmp: 18 + rand() * 34,
      swayFreq: 0.7 + rand() * 1.35,
      phase: rand() * Math.PI * 2,
      spin: rand() * Math.PI * 2,
      spinSpeed: (rand() - 0.5) * 4.4,
      flip: rand() * Math.PI * 2,
      flipSpeed: 2.2 + rand() * 4.2,
      opacity: 0.65 + rand() * 0.35,
      palette,
    });
  }
  return leaves;
}

/**
 * Generates an initial staggered Renaissance firework burst schedule across left/right/upper sky
 * so the bursts frame the central victory card without obscuring the winner's portrait.
 */
export function createFireworkSchedule(count = 6, seed = 1515) {
  const rand = createSeededRandom(seed);
  const anchors = [
    { xNorm: 0.16, yNorm: 0.24 },
    { xNorm: 0.84, yNorm: 0.22 },
    { xNorm: 0.22, yNorm: 0.46 },
    { xNorm: 0.78, yNorm: 0.44 },
    { xNorm: 0.12, yNorm: 0.34 },
    { xNorm: 0.88, yNorm: 0.32 },
  ];
  const schedule = [];
  for (let i = 0; i < count; i += 1) {
    const anchor = anchors[i % anchors.length];
    schedule.push({
      delayMs: 140 + i * 620 + Math.round(rand() * 160),
      xNorm: Math.max(0.08, Math.min(0.92, anchor.xNorm + (rand() - 0.5) * 0.08)),
      yNorm: Math.max(0.14, Math.min(0.56, anchor.yNorm + (rand() - 0.5) * 0.08)),
      colors: FIREWORK_PALETTE[i % FIREWORK_PALETTE.length],
      sparkCount: 28 + Math.floor(rand() * 14),
      radius: 78 + rand() * 46,
    });
  }
  return schedule;
}

/**
 * Builds a realistic finished match snapshot used exclusively when ?victoryDemo=1 is passed.
 */
export function buildVictoryDemoState(playerId = 'demo_player', playerName = '베네치아 상인') {
  const cleanName = (playerName || '베네치아 상인').trim() || '베네치아 상인';
  const winnerPlayer = {
    id: playerId,
    name: cleanName,
    isAi: false,
    points: 16,
    cardCount: 9,
    gems: { white: 1, blue: 2, green: 1, red: 1, black: 0, gold: 1 },
    discounts: { white: 2, blue: 3, green: 2, red: 1, black: 1 },
    nobles: [
      { id: 'n1', points: 3, cost: { white: 3, blue: 3, green: 3 } },
      { id: 'n2', points: 3, cost: { blue: 4, green: 4 } },
    ],
    reserved: [],
    reservedCount: 0,
  };
  const players = [
    winnerPlayer,
    {
      id: 'sandbox_ai1',
      name: '로렌초 (AI)',
      isAi: true,
      points: 12,
      cardCount: 8,
      gems: { white: 2, blue: 1, green: 0, red: 2, black: 1, gold: 0 },
      discounts: { white: 2, blue: 1, green: 2, red: 2, black: 1 },
      nobles: [{ id: 'n3', points: 3, cost: { red: 4, black: 4 } }],
      reserved: [],
      reservedCount: 1,
    },
    {
      id: 'sandbox_ai2',
      name: '베아트리체 (AI)',
      isAi: true,
      points: 9,
      cardCount: 7,
      gems: { white: 1, blue: 0, green: 2, red: 1, black: 2, gold: 0 },
      discounts: { white: 1, blue: 2, green: 1, red: 1, black: 2 },
      nobles: [],
      reserved: [],
      reservedCount: 0,
    },
  ];
  return {
    roomId: 'victory_demo',
    status: 'finished',
    players,
    winner: winnerPlayer,
    turnIndex: 0,
    turnSequence: 42,
    gems: { white: 1, blue: 2, green: 2, red: 1, black: 2, gold: 4 },
    board: { 1: [], 2: [], 3: [] },
    decksCount: { 1: 24, 2: 18, 3: 12 },
    nobles: [
      { id: 'n4', points: 3, cost: { white: 4, black: 4 } },
    ],
  };
}
