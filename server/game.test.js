import test from 'node:test';
import assert from 'node:assert/strict';
import { SplendorGame } from './game.js';

test('sets up gem bank and nobles according to player count', () => {
  const g2 = new SplendorGame();
  g2.addPlayer('p1', 'Lorenzo');
  g2.addPlayer('p2', 'Beatrice');
  assert.equal(g2.start(), true);
  assert.equal(g2.gems.white, 4);
  assert.equal(g2.gems.gold, 5);
  assert.equal(g2.nobles.length, 3);

  const g4 = new SplendorGame();
  g4.addPlayer('p1', 'A');
  g4.addPlayer('p2', 'B');
  g4.addPlayer('p3', 'C');
  g4.addPlayer('p4', 'D');
  assert.equal(g4.start(), true);
  assert.equal(g4.gems.red, 7);
  assert.equal(g4.nobles.length, 5);
});

test('takes 3 distinct gems and enforces >10 gem return before advancing turn', () => {
  const game = new SplendorGame();
  game.addPlayer('p1', 'Lorenzo');
  game.addPlayer('p2', 'Cosimo');
  game.start();

  // Give p1 9 gems first
  game.players[0].gems.white = 5;
  game.players[0].gems.blue = 4;

  const res = game.takeThreeGems('p1', ['green', 'red', 'black']);
  assert.equal(res.success, true);
  // Total is now 12 (> 10), so turn stays on p1 and requiresGemReturn is true
  assert.equal(game.currentPlayerIndex, 0);
  assert.equal(game.players[0].requiresGemReturn, true);

  const ret = game.returnGems('p1', { white: 2, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
  assert.equal(ret.success, true);
  assert.equal(game.players[0].requiresGemReturn, undefined);
  assert.equal(game.currentPlayerIndex, 1);
});

test('reserves card from board or top of deck and grants gold token', () => {
  const game = new SplendorGame();
  game.addPlayer('p1', 'Lorenzo');
  game.addPlayer('p2', 'Cosimo');
  game.start();

  const initialDeck1 = game.decks[1].length;
  const res = game.reserveCard('p1', null, 1);
  assert.equal(res.success, true);
  assert.equal(game.players[0].reserved.length, 1);
  assert.equal(game.players[0].gems.gold, 1);
  assert.equal(game.decks[1].length, initialDeck1 - 1);
});

test('buys card using permanent discounts and gold joker, then triggers noble visit and victory', () => {
  const game = new SplendorGame();
  game.addPlayer('p1', 'Lorenzo');
  game.addPlayer('p2', 'Cosimo');
  game.start();

  const card = game.board[3][0];
  // Give p1 discounts and plenty of gold to buy the tier 3 card
  game.players[0].discounts = { white: 4, blue: 4, green: 4, red: 4, black: 4 };
  game.players[0].gems.gold = 5;
  game.players[0].points = 12;

  const buyRes = game.buyCard('p1', card.id);
  assert.equal(buyRes.success, true);
  assert.equal(game.players[0].points >= 15, true);
  // End of round happens after p2 completes turn
  assert.equal(game.status, 'playing');

  // p2 takes 3 gems to complete the round
  const endRound = game.takeThreeGems('p2', ['white', 'blue', 'green']);
  assert.equal(endRound.success, true);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner.id, 'p1');
});
