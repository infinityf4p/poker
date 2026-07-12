import { describe, expect, it } from 'vitest';

import {
  applyBettingAction,
  BettingRuleError,
  createBettingRound,
  getLegalActions,
  type BettingRoundState,
} from './betting.js';

function preflopRound(): BettingRoundState {
  return createBettingRound({
    minimumBet: 10,
    firstActorId: 'a',
    players: [
      { playerId: 'a', seat: 0, stack: 100 },
      { playerId: 'b', seat: 1, stack: 95, committedStreet: 5 },
      { playerId: 'c', seat: 2, stack: 90, committedStreet: 10 },
    ],
  });
}

describe('betting round', () => {
  it('finishes after every live player matches and acts', () => {
    let state = preflopRound();
    state = applyBettingAction(state, 'a', { type: 'CALL' });
    state = applyBettingAction(state, 'b', { type: 'CALL' });
    state = applyBettingAction(state, 'c', { type: 'CHECK' });

    expect(state.complete).toBe(true);
    expect(state.actorId).toBeNull();
    expect(state.players.map((player) => player.committedStreet)).toEqual([10, 10, 10]);
  });

  it('reopens action after a full raise', () => {
    let state = preflopRound();
    state = applyBettingAction(state, 'a', { type: 'CALL' });
    state = applyBettingAction(state, 'b', { type: 'RAISE_TO', amountTo: 30 });
    state = applyBettingAction(state, 'c', { type: 'CALL' });

    expect(state.actorId).toBe('a');
    expect(state.lastFullRaiseSize).toBe(20);
    expect(getLegalActions(state).raiseTo).toEqual({ minimumTo: 50, maximumTo: 100 });
  });

  it('uses the full size of a large opening bet as the next minimum raise', () => {
    let state = createBettingRound({
      minimumBet: 100,
      firstActorId: 'a',
      players: [
        { playerId: 'a', seat: 0, stack: 1_000 },
        { playerId: 'b', seat: 1, stack: 1_000 },
        { playerId: 'c', seat: 2, stack: 1_000 },
      ],
    });

    state = applyBettingAction(state, 'a', { type: 'BET_TO', amountTo: 300 });

    expect(state.lastFullRaiseSize).toBe(300);
    expect(getLegalActions(state).raiseTo).toEqual({ minimumTo: 600, maximumTo: 1_000 });
    expect(() => applyBettingAction(state, 'b', { type: 'RAISE_TO', amountTo: 400 })).toThrow(
      BettingRuleError,
    );
  });

  it('does not reopen a checker after a short opening all-in', () => {
    let state = createBettingRound({
      minimumBet: 100,
      firstActorId: 'a',
      players: [
        { playerId: 'a', seat: 0, stack: 1_000 },
        { playerId: 'b', seat: 1, stack: 50 },
        { playerId: 'c', seat: 2, stack: 1_000 },
      ],
    });
    state = applyBettingAction(state, 'a', { type: 'CHECK' });
    state = applyBettingAction(state, 'b', { type: 'ALL_IN' });

    expect(getLegalActions(state).raiseTo).toEqual({ minimumTo: 150, maximumTo: 1_000 });
    state = applyBettingAction(state, 'c', { type: 'CALL' });

    expect(state.actorId).toBe('a');
    expect(getLegalActions(state).raiseTo).toBeNull();
    expect(getLegalActions(state).callAmount).toBe(50);
  });

  it('reopens a checker after cumulative short opening all-ins reach a full bet', () => {
    let state = createBettingRound({
      minimumBet: 100,
      firstActorId: 'a',
      players: [
        { playerId: 'a', seat: 0, stack: 1_000 },
        { playerId: 'b', seat: 1, stack: 50 },
        { playerId: 'c', seat: 2, stack: 100 },
        { playerId: 'd', seat: 3, stack: 1_000 },
      ],
    });
    state = applyBettingAction(state, 'a', { type: 'CHECK' });
    state = applyBettingAction(state, 'b', { type: 'ALL_IN' });
    state = applyBettingAction(state, 'c', { type: 'ALL_IN' });
    state = applyBettingAction(state, 'd', { type: 'CALL' });

    expect(state.actorId).toBe('a');
    expect(getLegalActions(state).raiseTo).toEqual({ minimumTo: 200, maximumTo: 1_000 });
  });

  it('enforces the full big-blind bring-in when the posted blind is short', () => {
    let state = createBettingRound({
      minimumBet: 100,
      firstActorId: 'utg',
      players: [
        { playerId: 'utg', seat: 0, stack: 1_000 },
        { playerId: 'sb', seat: 1, stack: 950, committedStreet: 50 },
        { playerId: 'bb', seat: 2, stack: 0, committedStreet: 40 },
      ],
    });

    expect(state.bringIn).toBe(100);
    expect(getLegalActions(state)).toMatchObject({
      callAmount: 100,
      raiseTo: { minimumTo: 200, maximumTo: 1_000 },
    });

    state = applyBettingAction(state, 'utg', { type: 'CALL' });
    expect(state.currentBet).toBe(100);
    expect(state.actorId).toBe('sb');
    expect(getLegalActions(state).callAmount).toBe(50);
  });

  it('does not manufacture a full bring-in when only one player has chips', () => {
    const state = createBettingRound({
      minimumBet: 100,
      firstActorId: 'sb',
      players: [
        { playerId: 'sb', seat: 0, stack: 950, committedStreet: 50 },
        { playerId: 'bb', seat: 1, stack: 0, committedStreet: 40 },
      ],
    });

    expect(state.complete).toBe(true);
    expect(state.currentBet).toBe(50);
    expect(state.players[0]?.committedStreet).toBe(50);
  });

  it('does not reopen the original bettor after one short all-in raise', () => {
    let state = createBettingRound({
      minimumBet: 100,
      firstActorId: 'a',
      players: [
        { playerId: 'a', seat: 0, stack: 500 },
        { playerId: 'b', seat: 1, stack: 500 },
        { playerId: 'c', seat: 2, stack: 150 },
      ],
    });
    state = applyBettingAction(state, 'a', { type: 'BET_TO', amountTo: 100 });
    state = applyBettingAction(state, 'b', { type: 'CALL' });
    state = applyBettingAction(state, 'c', { type: 'ALL_IN' });

    expect(state.actorId).toBe('a');
    expect(getLegalActions(state).raiseTo).toBeNull();
    expect(getLegalActions(state).callAmount).toBe(50);
    expect(() => applyBettingAction(state, 'a', { type: 'RAISE_TO', amountTo: 250 })).toThrow(
      BettingRuleError,
    );
  });

  it('reopens action when cumulative short all-ins reach a full raise', () => {
    let state = createBettingRound({
      minimumBet: 100,
      firstActorId: 'a',
      players: [
        { playerId: 'a', seat: 0, stack: 500 },
        { playerId: 'b', seat: 1, stack: 150 },
        { playerId: 'c', seat: 2, stack: 200 },
        { playerId: 'd', seat: 3, stack: 500 },
      ],
    });
    state = applyBettingAction(state, 'a', { type: 'BET_TO', amountTo: 100 });
    state = applyBettingAction(state, 'b', { type: 'ALL_IN' });
    state = applyBettingAction(state, 'c', { type: 'ALL_IN' });
    state = applyBettingAction(state, 'd', { type: 'CALL' });

    expect(state.actorId).toBe('a');
    expect(getLegalActions(state).raiseTo).toEqual({ minimumTo: 300, maximumTo: 500 });
  });

  it('only permits a call or fold when every opponent is all-in', () => {
    let state = createBettingRound({
      minimumBet: 100,
      firstActorId: 'a',
      players: [
        { playerId: 'a', seat: 0, stack: 500 },
        { playerId: 'b', seat: 1, stack: 50 },
      ],
    });
    state = applyBettingAction(state, 'a', { type: 'CHECK' });
    state = applyBettingAction(state, 'b', { type: 'ALL_IN' });

    expect(getLegalActions(state)).toMatchObject({
      playerId: 'a',
      callAmount: 50,
      raiseTo: null,
      canAllIn: false,
    });
  });

  it('rejects out-of-turn and under-minimum non-all-in wagers', () => {
    const state = preflopRound();

    expect(() => applyBettingAction(state, 'b', { type: 'FOLD' })).toThrow(BettingRuleError);
    expect(() => applyBettingAction(state, 'a', { type: 'RAISE_TO', amountTo: 15 })).toThrow(
      BettingRuleError,
    );
  });
});
