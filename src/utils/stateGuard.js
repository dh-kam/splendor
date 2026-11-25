/**
 * Pure client-side state transition guards to prevent unexpected mid-game
 * board/chip resets and guarantee chip selection stays active during a player's turn.
 */

export function shouldAcceptStateUpdate(
  prevState,
  nextState,
  { expectedRoomId = null, allowExplicitReset = false } = {}
) {
  if (!nextState || typeof nextState !== 'object') {
    return { accept: false, reason: 'invalid-state' };
  }

  // Reject cross-room updates if client is bound to a specific sandbox room
  if (expectedRoomId && nextState.roomId && nextState.roomId !== expectedRoomId) {
    return { accept: false, reason: 'room-mismatch' };
  }

  // Prevent unexpected mid-game board/chip reset regression (turnSequence rolling backward)
  if (
    prevState &&
    prevState.status === 'playing' &&
    nextState.status === 'playing' &&
    typeof prevState.turnSequence === 'number' &&
    typeof nextState.turnSequence === 'number' &&
    nextState.turnSequence < prevState.turnSequence &&
    !allowExplicitReset
  ) {
    return { accept: false, reason: 'unexpected-midgame-reset' };
  }

  return { accept: true, reason: null };
}

/**
 * Determines whether the player's in-progress chip selection must be preserved
 * across an incoming state update.
 */
export function shouldPreserveChipSelection(prevState, nextState, playerId) {
  if (!nextState || nextState.status !== 'playing' || !playerId) {
    return false;
  }

  const nextCurrent = nextState.players?.[nextState.currentPlayerIndex];
  if (!nextCurrent || nextCurrent.id !== playerId || nextCurrent.requiresGemReturn) {
    return false;
  }

  // If turnSequence advanced (e.g., timeout or completed turn), drop previous turn's selection
  if (
    prevState &&
    typeof prevState.turnSequence === 'number' &&
    typeof nextState.turnSequence === 'number' &&
    prevState.turnSequence !== nextState.turnSequence
  ) {
    return false;
  }

  // Same active turn belonging to this player: keep chip selection active!
  return true;
}
