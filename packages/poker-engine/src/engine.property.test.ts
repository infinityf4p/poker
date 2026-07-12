import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  applyBettingAction,
  assertBettingState,
  createBettingRound,
  getLegalActions,
  type BettingAction,
} from './betting.js';
import { createDeck, shuffleDeck } from './cards.js';
import { buildSidePots } from './side-pots.js';

function seededRandom(seed: number): (maximum: number) => number {
  let state = seed >>> 0;
  return (maximum) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state % maximum;
  };
}

describe('engine invariants', () => {
  it('every shuffle is a permutation of the deck', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const deck = createDeck();
        const shuffled = shuffleDeck(deck, seededRandom(seed));
        expect(shuffled).toHaveLength(deck.length);
        expect(new Set(shuffled)).toEqual(new Set(deck));
      }),
    );
  });

  it('side-pot layers and refunds conserve every contribution', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 10_000 }), { minLength: 2, maxLength: 9 }),
        (amounts) => {
          const result = buildSidePots(
            amounts.map((amount, index) => ({
              playerId: `p${index}`,
              amount,
              folded: false,
            })),
          );
          const accountedFor =
            result.pots.reduce((sum, pot) => sum + pot.amount, 0) +
            result.refunds.reduce((sum, refund) => sum + refund.amount, 0);
          expect(accountedFor).toBe(amounts.reduce((sum, amount) => sum + amount, 0));
        },
      ),
    );
  });

  it('legal betting sequences preserve chips and never produce negative values', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 20, max: 500 }), { minLength: 2, maxLength: 6 }),
        fc.array(fc.integer(), { minLength: 1, maxLength: 80 }),
        (stacks, choices) => {
          let state = createBettingRound({
            minimumBet: 10,
            firstActorId: 'p0',
            players: stacks.map((stack, index) => ({
              playerId: `p${index}`,
              seat: index,
              stack,
            })),
          });
          const initialTotal = stacks.reduce((sum, stack) => sum + stack, 0);

          for (const choice of choices) {
            if (state.complete) {
              break;
            }
            const actorId = state.actorId!;
            const legal = getLegalActions(state);
            const actions: BettingAction[] = [{ type: 'FOLD' }];
            if (legal.canCheck) actions.push({ type: 'CHECK' });
            if (legal.callAmount !== null) actions.push({ type: 'CALL' });
            if (legal.betTo !== null) {
              actions.push({ type: 'BET_TO', amountTo: legal.betTo.minimumTo });
            }
            if (legal.raiseTo !== null) {
              actions.push({ type: 'RAISE_TO', amountTo: legal.raiseTo.minimumTo });
            }
            if (legal.canAllIn) actions.push({ type: 'ALL_IN' });

            state = applyBettingAction(state, actorId, actions[Math.abs(choice) % actions.length]!);
            assertBettingState(state);
            expect(
              state.players.reduce((sum, player) => sum + player.stack + player.committedHand, 0),
            ).toBe(initialTotal);
            expect(state.players.every((player) => player.stack >= 0)).toBe(true);
          }
        },
      ),
      { numRuns: 100_000 },
    );
  });
});
