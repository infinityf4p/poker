import { describe, expect, it } from 'vitest';

import { createDeck, shuffleDeck, type Card } from './cards.js';
import {
  compareHandRanks,
  evaluateBestHand,
  evaluateFiveCardHand,
  HandCategory,
  rankHoldemPlayers,
} from './hand-rank.js';

describe('hand ranking', () => {
  it('ranks categories and kickers in poker order', () => {
    const straightFlush = evaluateFiveCardHand(['As', 'Ks', 'Qs', 'Js', 'Ts']);
    const quads = evaluateFiveCardHand(['Ah', 'Ad', 'Ac', 'As', '2d']);
    const lowerQuads = evaluateFiveCardHand(['Kh', 'Kd', 'Kc', 'Ks', 'Ad']);

    expect(straightFlush.category).toBe(HandCategory.StraightFlush);
    expect(compareHandRanks(straightFlush, quads)).toBeGreaterThan(0);
    expect(compareHandRanks(quads, lowerQuads)).toBeGreaterThan(0);
  });

  it('recognizes an ace-low wheel', () => {
    const wheel = evaluateFiveCardHand(['As', '2d', '3h', '4c', '5s']);
    const sixHigh = evaluateFiveCardHand(['2s', '3d', '4h', '5c', '6s']);

    expect(wheel.category).toBe(HandCategory.Straight);
    expect(wheel.tiebreak).toEqual([5]);
    expect(compareHandRanks(sixHigh, wheel)).toBeGreaterThan(0);
  });

  it('chooses the best five cards from seven', () => {
    const rank = evaluateBestHand(['As', 'Ah', 'Ad', 'Kc', 'Kd', '2s', '3c']);

    expect(rank.category).toBe(HandCategory.FullHouse);
    expect(rank.tiebreak).toEqual([14, 13]);
  });

  it('returns every tied holdem winner', () => {
    const result = rankHoldemPlayers(
      [
        { playerId: 'alice', holeCards: ['2c', '3d'] },
        { playerId: 'bob', holeCards: ['4c', '5d'] },
      ],
      ['As', 'Ks', 'Qs', 'Js', 'Ts'],
    );

    expect(result.winnerIds).toEqual(['alice', 'bob']);
  });
});

describe('secure shuffle primitive', () => {
  it('returns a permutation without mutating the source deck', () => {
    const deck = createDeck();
    const source = [...deck];
    let next = 7;
    const shuffled = shuffleDeck(deck, (maximum) => {
      next = (next * 1_103_515_245 + 12_345) >>> 0;
      return next % maximum;
    });

    expect(deck).toEqual(source);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled)).toEqual(new Set(deck));
  });

  it('rejects an invalid random index', () => {
    expect(() => shuffleDeck<Card>(createDeck(), (maximum) => maximum)).toThrow(RangeError);
  });
});
