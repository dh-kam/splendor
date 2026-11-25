// Pure decision & execution engine for AI turns and 30-second turn-timeout auto-moves

const GEM_COLORS = ['white', 'blue', 'green', 'red', 'black'];

export function canPlayerAfford(player, card) {
  let goldNeeded = 0;
  for (const color of GEM_COLORS) {
    const cost = card.cost?.[color] || 0;
    const discount = player.discounts?.[color] || 0;
    const net = Math.max(0, cost - discount);
    if ((player.gems?.[color] || 0) < net) {
      goldNeeded += net - (player.gems?.[color] || 0);
    }
  }
  return (player.gems?.gold || 0) >= goldNeeded;
}

export function getMissingGemsCount(player, card) {
  const colors = {};
  let total = 0;
  for (const color of GEM_COLORS) {
    const cost = card.cost?.[color] || 0;
    const discount = player.discounts?.[color] || 0;
    const net = Math.max(0, cost - discount);
    const held = player.gems?.[color] || 0;
    if (held < net) {
      const diff = net - held;
      colors[color] = diff;
      total += diff;
    }
  }
  return { total, colors };
}

export function buildExcessGemReturn(player) {
  const totalGems = Object.values(player.gems || {}).reduce((a, b) => a + b, 0);
  const toReturn = Math.max(0, totalGems - 10);
  const gemCounts = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
  if (toReturn === 0) return gemCounts;

  // Return most abundant non-gold gems first, preserving gold jokers when possible
  const sortedColors = Object.entries(player.gems || {})
    .filter(([color, val]) => val > 0 && color !== 'gold')
    .sort((a, b) => b[1] - a[1]);

  let returned = 0;
  for (const [color, val] of sortedColors) {
    const take = Math.min(val, toReturn - returned);
    gemCounts[color] = take;
    returned += take;
    if (returned >= toReturn) break;
  }

  if (returned < toReturn && (player.gems?.gold || 0) > 0) {
    gemCounts.gold = Math.min(player.gems.gold, toReturn - returned);
  }

  return gemCounts;
}

/**
 * Pure heuristic move selector used for both AI turns and 30-second human turn timeouts.
 */
export function chooseAutoMove(game, playerId) {
  if (!game || game.status !== 'playing') return null;
  const current = game.getCurrentPlayer();
  if (!current || current.id !== playerId) return null;

  // Case A: Must return excess gems (>10 limit)
  if (current.requiresGemReturn) {
    return { type: 'return-gems', gemCounts: buildExcessGemReturn(current) };
  }

  // Case B: Buy best affordable card (highest prestige points, then higher tier)
  const affordable = [];
  for (const card of current.reserved || []) {
    if (canPlayerAfford(current, card)) {
      affordable.push({ card, fromReserved: true });
    }
  }
  for (let tier = 3; tier >= 1; tier -= 1) {
    for (const card of game.board?.[tier] || []) {
      if (canPlayerAfford(current, card)) {
        affordable.push({ card, fromReserved: false });
      }
    }
  }
  if (affordable.length > 0) {
    affordable.sort((a, b) => {
      if (b.card.points !== a.card.points) return b.card.points - a.card.points;
      return b.card.level - a.card.level;
    });
    return { type: 'buy-card', cardId: affordable[0].card.id };
  }

  // Case C: Collect gems toward closest reachable board card
  const targets = [];
  for (let tier = 1; tier <= 3; tier -= 0) {
    for (const card of game.board?.[tier] || []) {
      targets.push({ card, missing: getMissingGemsCount(current, card) });
    }
    tier += 1;
  }
  targets.sort((a, b) => a.missing.total - b.missing.total);
  const bestTarget = targets[0];

  if (bestTarget && bestTarget.missing.total > 0) {
    const missingColors = Object.keys(bestTarget.missing.colors).filter((c) => c !== 'gold');

    // Take 2 of a single color if needed >= 2 and bank has >= 4
    for (const color of missingColors) {
      if (bestTarget.missing.colors[color] >= 2 && (game.gems?.[color] || 0) >= 4) {
        return { type: 'take-two-gems', color };
      }
    }

    // Take up to 3 distinct available colors (prioritizing needed colors)
    const toTake = [];
    for (const color of missingColors) {
      if ((game.gems?.[color] || 0) > 0 && !toTake.includes(color)) {
        toTake.push(color);
      }
      if (toTake.length === 3) break;
    }
    if (toTake.length < 3) {
      const otherAvailable = GEM_COLORS.filter(
        (c) => !toTake.includes(c) && (game.gems?.[c] || 0) > 0
      );
      for (const c of otherAvailable) {
        toTake.push(c);
        if (toTake.length === 3) break;
      }
    }
    if (toTake.length > 0) {
      return { type: 'take-gems', colors: toTake };
    }
  }

  // Case D: Fallback reserve from board or deck if reserved slots remain
  if ((current.reserved?.length || 0) < 3) {
    for (let tier = 3; tier >= 1; tier -= 1) {
      if ((game.board?.[tier]?.length || 0) > 0) {
        return { type: 'reserve-card', cardId: game.board[tier][0].id };
      }
    }
    for (let tier = 3; tier >= 1; tier -= 1) {
      if ((game.decks?.[tier]?.length || 0) > 0) {
        return { type: 'reserve-card', cardId: null, tier };
      }
    }
  }

  // Case E: Bank has some gems even if no target matched
  const anyAvailable = GEM_COLORS.filter((c) => (game.gems?.[c] || 0) > 0).slice(0, 3);
  if (anyAvailable.length > 0) {
    return { type: 'take-gems', colors: anyAvailable };
  }

  return { type: 'pass' };
}

/**
 * Executes an automated turn safely with strict turn ownership validation.
 * On 30s timeout, if the automated action pushes gems >10, it also auto-returns excess gems
 * so the turn advances smoothly without stalling another 30 seconds.
 */
export function executeAutoMove(game, playerId, { isTimeout = false } = {}) {
  const move = chooseAutoMove(game, playerId);
  if (!move) return { success: false, reason: 'Not active turn' };

  const player = game.getCurrentPlayer();
  const wasAlreadyAuto = Boolean(player && !player.isAi && player.autoMode);
  let autoModeEnabled = false;

  if (isTimeout && player) {
    if (!player.isAi) {
      player.autoMode = true;
      autoModeEnabled = true;
      game.log(
        wasAlreadyAuto
          ? `AUTO 모드(10초): ${player.name} 자동 선택 진행`
          : `시간 초과(30초): ${player.name} AUTO 모드 전환 및 자동 선택 진행`
      );
    } else {
      game.log(`시간 초과(30초): ${player.name} 자동 선택 진행`);
    }
  }

  let res;
  switch (move.type) {
    case 'return-gems':
      res = game.returnGems(playerId, move.gemCounts);
      break;
    case 'buy-card':
      res = game.buyCard(playerId, move.cardId);
      break;
    case 'take-two-gems':
      res = game.takeTwoGems(playerId, move.color);
      break;
    case 'take-gems':
      res = game.takeThreeGems(playerId, move.colors);
      break;
    case 'reserve-card':
      res = game.reserveCard(playerId, move.cardId, move.tier);
      break;
    case 'pass':
      game.endTurn();
      res = { success: true };
      break;
    default:
      game.endTurn();
      res = { success: true };
  }

  // If move failed unexpectedly, fall back to advancing turn safely so match never deadlocks
  if (!res.success && game.status === 'playing' && game.getCurrentPlayer()?.id === playerId) {
    game.endTurn();
  }

  // On timeout, immediately resolve excess gem return so the timed-out player doesn't stall again
  if (
    isTimeout &&
    game.status === 'playing' &&
    game.getCurrentPlayer()?.id === playerId &&
    game.getCurrentPlayer()?.requiresGemReturn
  ) {
    const excessCounts = buildExcessGemReturn(game.getCurrentPlayer());
    game.returnGems(playerId, excessCounts);
  }

  return { success: true, move, autoModeEnabled, wasAlreadyAuto };
}
