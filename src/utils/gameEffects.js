const ALL_GEM_KEYS = ['white', 'blue', 'green', 'red', 'black', 'gold'];

const GEM_SHORT_LABELS = {
  white: '다이아',
  blue: '사파이어',
  green: '에메랄드',
  red: '루비',
  black: '오닉스',
  gold: '황금',
};

/**
 * Pure state-diff helper that compares consecutive Splendor game snapshots
 * and produces structured animation & audio events for both human and AI actions.
 */
export function diffGameStates(prev, next) {
  const events = {
    takenGems: [],       // { playerId, colors: string[] }
    returnedGems: [],    // { playerId, colors: string[] }
    boardRemovals: [],   // { card, tier, slotIndex, actorId, action: 'buy' | 'reserve' }
    dealtCardIds: [],    // string[]
    scoreGains: [],      // { playerId, delta, total }
    nobleVisits: [],     // { playerId, playerName, noble }
    turnChangedTo: null, // { playerId, playerName, isAi }
    actorWhisper: null,  // { playerId, text }
  };

  if (!prev || !next || prev.status !== 'playing' || next.status === 'lobby') {
    return events;
  }

  const prevPlayersById = new Map((prev.players || []).map((p) => [p.id, p]));
  const nextPlayersById = new Map((next.players || []).map((p) => [p.id, p]));

  // Detect who just acted (usually prev.currentPlayerIndex)
  const prevActive = prev.players?.[prev.currentPlayerIndex] || null;
  const actorId = prevActive?.id || null;

  // 1. Gem deltas per player
  for (const nextP of next.players || []) {
    const prevP = prevPlayersById.get(nextP.id);
    if (!prevP) continue;

    const gained = [];
    const spent = [];
    for (const color of ALL_GEM_KEYS) {
      const diff = (nextP.gems?.[color] || 0) - (prevP.gems?.[color] || 0);
      if (diff > 0) {
        for (let i = 0; i < diff; i += 1) gained.push(color);
      } else if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i += 1) spent.push(color);
      }
    }

    if (gained.length > 0) {
      events.takenGems.push({ playerId: nextP.id, colors: gained });
    }
    if (spent.length > 0) {
      events.returnedGems.push({ playerId: nextP.id, colors: spent });
    }

    // 2. Prestige score gain
    const ptDelta = (nextP.points || 0) - (prevP.points || 0);
    if (ptDelta > 0) {
      events.scoreGains.push({
        playerId: nextP.id,
        delta: ptDelta,
        total: nextP.points,
      });
    }

    // 3. Noble visits
    const prevNobleIds = new Set((prevP.nobles || []).map((n) => n.id));
    for (const noble of nextP.nobles || []) {
      if (!prevNobleIds.has(noble.id)) {
        events.nobleVisits.push({
          playerId: nextP.id,
          playerName: nextP.name,
          noble,
        });
      }
    }
  }

  // 4. Board cards removed (bought or reserved) & newly dealt cards
  for (const tier of [1, 2, 3]) {
    const prevRow = prev.board?.[tier] || [];
    const nextRow = next.board?.[tier] || [];
    const prevIds = new Set(prevRow.map((c) => c.id));
    const nextIds = new Set(nextRow.map((c) => c.id));

    prevRow.forEach((card, slotIndex) => {
      if (!nextIds.has(card.id)) {
        // Was it reserved or bought by actor?
        const prevActor = actorId ? prevPlayersById.get(actorId) : null;
        const nextActor = actorId ? nextPlayersById.get(actorId) : null;
        const reservedIncreased =
          (nextActor?.reservedCount ?? nextActor?.reserved?.length ?? 0) >
          (prevActor?.reservedCount ?? prevActor?.reserved?.length ?? 0);

        events.boardRemovals.push({
          card,
          tier,
          slotIndex,
          actorId,
          action: reservedIncreased ? 'reserve' : 'buy',
        });
      }
    });

    nextRow.forEach((card) => {
      if (!prevIds.has(card.id)) {
        events.dealtCardIds.push(card.id);
      }
    });
  }

  // 5. Turn change detection
  const nextActive = next.players?.[next.currentPlayerIndex] || null;
  if (next.status === 'playing' && nextActive && nextActive.id !== prevActive?.id) {
    events.turnChangedTo = {
      playerId: nextActive.id,
      playerName: nextActive.name,
      isAi: !!nextActive.isAi,
    };
  }

  // 6. Concise visual whisper for the acting player (especially AI opponents)
  if (actorId) {
    const removal = events.boardRemovals.find((r) => r.actorId === actorId);
    const gained = events.takenGems.find((g) => g.playerId === actorId);
    const prevActor = prevPlayersById.get(actorId);
    const nextActor = nextPlayersById.get(actorId);

    if (removal) {
      const gemName = GEM_SHORT_LABELS[removal.card.color] || '';
      events.actorWhisper = {
        playerId: actorId,
        text:
          removal.action === 'reserve'
            ? `${removal.tier}단계 카드 킵 (+황금)`
            : `${gemName} 카드 구매${removal.card.points > 0 ? ` (+${removal.card.points}점)` : ''}`,
      };
    } else if (
      nextActor &&
      prevActor &&
      (nextActor.cardCount || 0) > (prevActor.cardCount || 0)
    ) {
      const ptDelta = (nextActor.points || 0) - (prevActor.points || 0);
      events.actorWhisper = {
        playerId: actorId,
        text: `킵 카드 구매${ptDelta > 0 ? ` (+${ptDelta}점)` : ''}`,
      };
    } else if (
      nextActor &&
      prevActor &&
      (nextActor.reservedCount ?? 0) > (prevActor.reservedCount ?? 0)
    ) {
      events.actorWhisper = {
        playerId: actorId,
        text: '비공개 덱 카드 킵 (+황금)',
      };
    } else if (gained && gained.colors.length > 0) {
      const names = gained.colors.map((c) => GEM_SHORT_LABELS[c] || c);
      const unique = [...new Set(names)];
      events.actorWhisper = {
        playerId: actorId,
        text:
          gained.colors.length === 2 && unique.length === 1
            ? `${unique[0]} 2개 채집`
            : `${unique.join('·')} 채집`,
      };
    }
  }

  return events;
}
