import { LEVEL_1_CARDS, LEVEL_2_CARDS, LEVEL_3_CARDS, NOBLES } from './cards.js';

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class SplendorGame {
  constructor() {
    this.status = 'lobby'; // lobby, playing, finished
    this.players = []; // Array of { id, name, gems, cards, discounts, reserved, points, nobles }
    this.currentPlayerIndex = 0;
    this.nobles = [];
    this.decks = {
      1: [],
      2: [],
      3: []
    };
    this.board = {
      1: [],
      2: [],
      3: []
    };
    this.gems = {
      white: 0,
      blue: 0,
      green: 0,
      red: 0,
      black: 0,
      gold: 5
    };
    this.logs = [];
    this.lastTurnInfo = null;
    this.gameCreated = Date.now();
    this.focusMap = {};
  }

  setFocus(playerId, cardId) {
    this.focusMap[playerId] = cardId;
  }

  clearFocus(playerId) {
    delete this.focusMap[playerId];
  }

  addPlayer(id, name) {
    if (this.status !== 'lobby') return false;
    if (this.players.length >= 4) return false;
    if (this.players.some(p => p.id === id)) return false;

    this.players.push({
      id,
      name,
      gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      cards: [],
      discounts: { white: 0, blue: 0, green: 0, red: 0, black: 0 },
      reserved: [],
      points: 0,
      nobles: []
    });

    this.log(`${name} joined the game.`);
    return true;
  }

  removePlayer(id) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx !== -1) {
      const name = this.players[idx].name;
      this.players.splice(idx, 1);
      this.log(`${name} left the game.`);
      if (this.status === 'playing' && this.players.length < 2) {
        this.status = 'lobby';
        this.log(`Game ended because there are not enough players.`);
      }
      return true;
    }
    return false;
  }

  start() {
    if (this.status !== 'lobby') return false;
    if (this.players.length < 2 || this.players.length > 4) return false;

    const playerCount = this.players.length;

    // Set up gems
    let gemCount = 7;
    if (playerCount === 2) gemCount = 4;
    if (playerCount === 3) gemCount = 5;

    this.gems = {
      white: gemCount,
      blue: gemCount,
      green: gemCount,
      red: gemCount,
      black: gemCount,
      gold: 5
    };

    // Set up decks
    this.decks[1] = shuffle(LEVEL_1_CARDS);
    this.decks[2] = shuffle(LEVEL_2_CARDS);
    this.decks[3] = shuffle(LEVEL_3_CARDS);

    // Set up board
    for (let tier = 1; tier <= 3; tier++) {
      this.board[tier] = [];
      for (let i = 0; i < 4; i++) {
        if (this.decks[tier].length > 0) {
          this.board[tier].push(this.decks[tier].pop());
        }
      }
    }

    // Set up nobles
    const shuffledNobles = shuffle(NOBLES);
    this.nobles = shuffledNobles.slice(0, playerCount + 1);

    this.currentPlayerIndex = 0;
    this.status = 'playing';
    this.logs = [];
    this.log(`Game started! It's ${this.players[0].name}'s turn.`);
    return true;
  }

  log(message) {
    this.logs.unshift({
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString(),
      text: message
    });
    if (this.logs.length > 30) this.logs.pop();
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  // --- ACTIONS ---

  // 1. Take gems of different colors (up to 3, or all available if bank has < 3 colors)
  takeThreeGems(playerId, colors) {
    if (!this.validateTurn(playerId)) return { success: false, reason: "Not your turn" };
    
    // Count how many different colors (excluding gold) are available in the bank (count > 0)
    const availableColorsInBank = Object.entries(this.gems)
      .filter(([color, count]) => color !== 'gold' && count > 0)
      .map(([color]) => color);
      
    const expectedCount = Math.min(3, availableColorsInBank.length);
    if (colors.length !== expectedCount) {
      return { success: false, reason: `Must select exactly ${expectedCount} colors (available colors in bank: ${availableColorsInBank.length})` };
    }
    if (new Set(colors).size !== expectedCount) {
      return { success: false, reason: "Colors must be different" };
    }
    if (colors.includes('gold')) return { success: false, reason: "Cannot select gold" };

    const player = this.getCurrentPlayer();

    // Validate availability
    for (const color of colors) {
      if (this.gems[color] <= 0) {
        return { success: false, reason: `No ${color} gems left in bank` };
      }
    }

    // Execute
    for (const color of colors) {
      this.gems[color]--;
      player.gems[color]++;
    }

    this.log(`${player.name} took ${colors.length} gems: ${colors.join(', ')}.`);
    this.endTurn();
    return { success: true };
  }

  // 2. Take 2 gems of the same color
  takeTwoGems(playerId, color) {
    if (!this.validateTurn(playerId)) return { success: false, reason: "Not your turn" };
    if (color === 'gold') return { success: false, reason: "Cannot select gold" };

    const player = this.getCurrentPlayer();

    if (this.gems[color] < 4) {
      return { success: false, reason: `Must be at least 4 ${color} gems in bank to take 2` };
    }

    // Execute
    this.gems[color] -= 2;
    player.gems[color] += 2;

    this.log(`${player.name} took 2 ${color} gems.`);
    this.endTurn();
    return { success: true };
  }

  // 3. Reserve a card
  reserveCard(playerId, cardId, tier) {
    if (!this.validateTurn(playerId)) return { success: false, reason: "Not your turn" };
    
    const player = this.getCurrentPlayer();
    if (player.reserved.length >= 3) {
      return { success: false, reason: "Cannot reserve more than 3 cards" };
    }

    let card = null;
    let fromBoard = false;

    // Find card on the board
    for (let t = 1; t <= 3; t++) {
      const idx = this.board[t].findIndex(c => c.id === cardId);
      if (idx !== -1) {
        card = this.board[t][idx];
        this.board[t].splice(idx, 1);
        fromBoard = true;
        // Replace card on board
        if (this.decks[t].length > 0) {
          this.board[t].push(this.decks[t].pop());
        }
        break;
      }
    }

    // If not on board, draw from top of the deck
    if (!card && tier && [1, 2, 3].includes(Number(tier))) {
      if (this.decks[tier].length > 0) {
        card = this.decks[tier].pop();
      } else {
        return { success: false, reason: "Deck is empty" };
      }
    }

    if (!card) {
      return { success: false, reason: "Card not found" };
    }

    // Give gold if available
    let gotGold = false;
    if (this.gems.gold > 0) {
      this.gems.gold--;
      player.gems.gold++;
      gotGold = true;
    }

    player.reserved.push(card);
    
    this.log(`${player.name} reserved a Level ${card.level} card ${gotGold ? 'and got 1 gold' : ''}.`);
    this.endTurn();
    return { success: true };
  }

  // 4. Buy a card
  buyCard(playerId, cardId) {
    if (!this.validateTurn(playerId)) return { success: false, reason: "Not your turn" };

    const player = this.getCurrentPlayer();
    let card = null;
    let fromReserved = false;
    let boardTier = null;
    let boardIdx = -1;

    // Search board
    for (let t = 1; t <= 3; t++) {
      const idx = this.board[t].findIndex(c => c.id === cardId);
      if (idx !== -1) {
        card = this.board[t][idx];
        boardTier = t;
        boardIdx = idx;
        break;
      }
    }

    // Search reserved
    if (!card) {
      const idx = player.reserved.findIndex(c => c.id === cardId);
      if (idx !== -1) {
        card = player.reserved[idx];
        fromReserved = true;
      }
    }

    if (!card) {
      return { success: false, reason: "Card not found" };
    }

    // Calculate cost
    const cost = card.cost;
    const gemsToPay = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
    let goldRequired = 0;

    for (const color of ['white', 'blue', 'green', 'red', 'black']) {
      const cardCost = cost[color] || 0;
      const discount = player.discounts[color] || 0;
      const netCost = Math.max(0, cardCost - discount);

      if (player.gems[color] >= netCost) {
        gemsToPay[color] = netCost;
      } else {
        gemsToPay[color] = player.gems[color];
        goldRequired += (netCost - player.gems[color]);
      }
    }

    if (player.gems.gold < goldRequired) {
      return { success: false, reason: "Cannot afford this card" };
    }
    gemsToPay.gold = goldRequired;

    // Execute payment
    for (const color of ['white', 'blue', 'green', 'red', 'black', 'gold']) {
      player.gems[color] -= gemsToPay[color];
      this.gems[color] += gemsToPay[color];
    }

    // Remove card from where it was
    if (fromReserved) {
      const idx = player.reserved.findIndex(c => c.id === cardId);
      player.reserved.splice(idx, 1);
    } else {
      this.board[boardTier].splice(boardIdx, 1);
      // Replace card on board
      if (this.decks[boardTier].length > 0) {
        this.board[boardTier].push(this.decks[boardTier].pop());
      }
    }

    // Add card to player
    player.cards.push(card);
    player.discounts[card.color]++;
    player.points += card.points;

    this.log(`${player.name} bought a Level ${card.level} ${card.color} card for ${card.points} PV.`);
    
    // Check noble visit
    this.checkNobles(player);

    this.endTurn();
    return { success: true };
  }

  // Return gems if count > 10
  returnGems(playerId, gemCounts) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, reason: "Player not found" };

    let totalGems = Object.values(player.gems).reduce((a, b) => a + b, 0);
    if (totalGems <= 10) return { success: false, reason: "You do not have more than 10 gems" };

    let returnTotal = Object.values(gemCounts).reduce((a, b) => a + b, 0);
    if (totalGems - returnTotal !== 10) {
      return { success: false, reason: "Must return enough gems to have exactly 10" };
    }

    // Validate player actually has these gems
    for (const color in gemCounts) {
      if (player.gems[color] < gemCounts[color]) {
        return { success: false, reason: `You don't have enough ${color} gems to return` };
      }
    }

    // Execute return
    for (const color in gemCounts) {
      player.gems[color] -= gemCounts[color];
      this.gems[color] += gemCounts[color];
    }

    this.log(`${player.name} returned ${returnTotal} gems to reach the hand limit.`);
    
    // Clear flag and advance turn
    delete player.requiresGemReturn;
    this.endTurn();
    
    return { success: true };
  }

  // --- HELPERS ---

  validateTurn(playerId) {
    if (this.status !== 'playing') return false;
    const player = this.getCurrentPlayer();
    return player && player.id === playerId;
  }

  checkNobles(player) {
    const eligibleNobles = [];
    for (let i = this.nobles.length - 1; i >= 0; i--) {
      const noble = this.nobles[i];
      let eligible = true;
      for (const color in noble.cost) {
        if ((player.discounts[color] || 0) < noble.cost[color]) {
          eligible = false;
          break;
        }
      }
      if (eligible) {
        eligibleNobles.push(noble);
        this.nobles.splice(i, 1); // Remove from board
      }
    }

    for (const noble of eligibleNobles) {
      player.nobles.push(noble);
      player.points += noble.points;
      this.log(`Noble visited ${player.name}! +3 PV.`);
    }
  }

  endTurn() {
    // Check if player has > 10 gems. If so, they must return gems, and the next turn is blocked until they do.
    // In our implementation, we'll keep it simple: if player has > 10 gems, we'll trigger a return-gem state in the UI.
    // We let the turn end, but if they have > 10 gems, we'll flag that they must resolve it, or we do it inline.
    // Let's check inline if player gem total > 10. If so, we set a flag 'requiresGemReturn' on the player, and we DON'T advance currentPlayerIndex until they do returnGems.
    const player = this.getCurrentPlayer();
    const totalGems = Object.values(player.gems).reduce((a, b) => a + b, 0);

    if (totalGems > 10) {
      this.status = 'playing'; // keep playing
      player.requiresGemReturn = true;
      this.log(`${player.name} has ${totalGems} gems and must return ${totalGems - 10} gems.`);
      return;
    }

    // Clean up flag if it was set
    delete player.requiresGemReturn;

    // Clear focus
    delete this.focusMap[player.id];

    // Advance turn
    const prevIndex = this.currentPlayerIndex;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

    // If we wrapped back to player 0, it means a full round completed.
    // Check if any player has reached >= 15 points.
    if (this.currentPlayerIndex === 0) {
      const winners = this.players.filter(p => p.points >= 15);
      if (winners.length > 0) {
        // Find player with highest points. Tiebreaker: fewest development cards.
        let bestPlayer = winners[0];
        for (let i = 1; i < winners.length; i++) {
          const p = winners[i];
          if (p.points > bestPlayer.points) {
            bestPlayer = p;
          } else if (p.points === bestPlayer.points) {
            if (p.cards.length < bestPlayer.cards.length) {
              bestPlayer = p;
            }
          }
        }
        this.status = 'finished';
        this.winner = bestPlayer;
        this.log(`Game over! ${bestPlayer.name} wins with ${bestPlayer.points} points!`);
        return;
      }
    }

    this.log(`It is now ${this.players[this.currentPlayerIndex].name}'s turn.`);
  }
}
