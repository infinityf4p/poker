import { describe, expect, it } from 'vitest';

import { applyBettingAction } from './betting.js';
import { createDeck } from './cards.js';
import { createHand, dealCommunityStreet, settleHoldemShowdown } from './hand.js';

describe('holdem hand foundations', () => {
  it('deals privately in seat order and posts blinds', () => {
    const hand = createHand({
      players: [
        { playerId: 'a', seat: 0, stack: 1_000 },
        { playerId: 'b', seat: 1, stack: 1_000 },
        { playerId: 'c', seat: 2, stack: 1_000 },
      ],
      buttonSeat: 0,
      smallBlind: 5,
      bigBlind: 10,
      deck: createDeck(),
    });

    expect(hand.positions).toMatchObject({ smallBlindSeat: 1, bigBlindSeat: 2 });
    expect(hand.betting.actorId).toBe('a');
    expect(hand.betting.players.map((player) => player.committedStreet)).toEqual([0, 5, 10]);
    expect(hand.holeCards).toEqual([
      { playerId: 'a', cards: ['4c', '7c'] },
      { playerId: 'b', cards: ['2c', '5c'] },
      { playerId: 'c', cards: ['3c', '6c'] },
    ]);
    expect(hand.remainingDeck[0]).toBe('8c');
  });

  it('gives the heads-up button the first pre-flop action and the big blind last', () => {
    const hand = createHand({
      players: [
        { playerId: 'bb', seat: 1, stack: 1_000 },
        { playerId: 'button', seat: 4, stack: 1_000 },
      ],
      buttonSeat: 4,
      smallBlind: 5,
      bigBlind: 10,
      deck: createDeck(),
    });

    expect(hand.positions).toMatchObject({
      buttonSeat: 4,
      smallBlindSeat: 4,
      bigBlindSeat: 1,
      preflopFirstSeat: 4,
      postflopFirstSeat: 1,
    });
    expect(hand.betting.actorId).toBe('button');

    const afterCall = applyBettingAction(hand.betting, 'button', { type: 'CALL' });
    expect(afterCall.actorId).toBe('bb');
    expect(applyBettingAction(afterCall, 'bb', { type: 'CHECK' }).complete).toBe(true);
  });

  it('burns before each community street', () => {
    const remaining = createDeck();
    const flop = dealCommunityStreet(remaining, [], 'FLOP');
    const turn = dealCommunityStreet(flop.remainingDeck, flop.communityCards, 'TURN');
    const river = dealCommunityStreet(turn.remainingDeck, turn.communityCards, 'RIVER');

    expect(flop).toMatchObject({ burnCard: '2c', dealtCards: ['3c', '4c', '5c'] });
    expect(turn).toMatchObject({ burnCard: '6c', dealtCards: ['7c'] });
    expect(river).toMatchObject({ burnCard: '8c', dealtCards: ['9c'] });
    expect(river.communityCards).toEqual(['3c', '4c', '5c', '7c', '9c']);
  });

  it('combines showdown ranking with independent side-pot awards', () => {
    const result = settleHoldemShowdown(
      [
        { playerId: 'a', holeCards: ['Ah', 'Ad'], committedHand: 100, folded: false },
        { playerId: 'b', holeCards: ['Kh', 'Kd'], committedHand: 200, folded: false },
        { playerId: 'c', holeCards: ['Qh', 'Qd'], committedHand: 300, folded: false },
      ],
      ['2c', '3d', '4h', '8s', '9c'],
      ['a', 'b', 'c'],
    );

    expect(result.settlement.payouts).toEqual([
      { playerId: 'c', amount: 100 },
      { playerId: 'a', amount: 300 },
      { playerId: 'b', amount: 200 },
    ]);
    expect(result.settlement.totalPaid).toBe(600);
  });
});
