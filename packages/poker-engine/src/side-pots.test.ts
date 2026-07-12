import { describe, expect, it } from 'vitest';

import { evaluateFiveCardHand } from './hand-rank.js';
import { buildSidePots, settleSidePots } from './side-pots.js';

describe('side pots', () => {
  it('builds layered pots and refunds an unmatched overbet', () => {
    const result = buildSidePots([
      { playerId: 'a', amount: 100, folded: false },
      { playerId: 'b', amount: 200, folded: false },
      { playerId: 'c', amount: 300, folded: false },
    ]);

    expect(result.pots).toEqual([
      {
        index: 0,
        cap: 100,
        amount: 300,
        contributorIds: ['a', 'b', 'c'],
        eligiblePlayerIds: ['a', 'b', 'c'],
      },
      {
        index: 1,
        cap: 200,
        amount: 200,
        contributorIds: ['b', 'c'],
        eligiblePlayerIds: ['b', 'c'],
      },
    ]);
    expect(result.refunds).toEqual([{ playerId: 'c', amount: 100 }]);
  });

  it('counts folded chips but excludes folded players from winning', () => {
    const result = buildSidePots([
      { playerId: 'a', amount: 100, folded: false },
      { playerId: 'b', amount: 200, folded: false },
      { playerId: 'c', amount: 200, folded: true },
    ]);

    expect(result.pots[0]?.amount).toBe(300);
    expect(result.pots[0]?.eligiblePlayerIds).toEqual(['a', 'b']);
    expect(result.pots[1]).toMatchObject({ amount: 200, eligiblePlayerIds: ['b'] });
  });

  it('settles each pot independently and awards odd chips by seat order', () => {
    const build = buildSidePots([
      { playerId: 'a', amount: 5, folded: false },
      { playerId: 'b', amount: 5, folded: false },
      { playerId: 'c', amount: 5, folded: true },
    ]);
    const tied = evaluateFiveCardHand(['As', 'Ks', 'Qs', 'Js', 'Ts']);
    const settlement = settleSidePots(
      build,
      new Map([
        ['a', tied],
        ['b', tied],
      ]),
      ['b', 'a', 'c'],
    );

    expect(settlement.awards[0]?.shares).toEqual([
      { playerId: 'b', amount: 8 },
      { playerId: 'a', amount: 7 },
    ]);
    expect(settlement.totalPaid).toBe(15);
  });
});
