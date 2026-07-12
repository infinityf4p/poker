import { assertChipAmount } from './chips.js';

export type BettingAction =
  | { readonly type: 'FOLD' }
  | { readonly type: 'CHECK' }
  | { readonly type: 'CALL' }
  | { readonly type: 'BET_TO'; readonly amountTo: number }
  | { readonly type: 'RAISE_TO'; readonly amountTo: number }
  | { readonly type: 'ALL_IN' };

export interface BettingPlayerInput {
  readonly playerId: string;
  readonly seat: number;
  /** Chips still available behind, after any forced commitment. */
  readonly stack: number;
  readonly committedStreet?: number;
  readonly committedHand?: number;
  readonly folded?: boolean;
}

export interface BettingPlayerState {
  readonly playerId: string;
  readonly seat: number;
  readonly stack: number;
  readonly committedStreet: number;
  readonly committedHand: number;
  readonly folded: boolean;
  readonly allIn: boolean;
  /** Bet level when this player most recently acted; null means not yet acted this street. */
  readonly lastActedAtBet: number | null;
}

export interface CreateBettingRoundInput {
  readonly players: readonly BettingPlayerInput[];
  readonly firstActorId: string;
  readonly minimumBet: number;
  readonly lastFullRaiseSize?: number;
  /**
   * Forced opening level for the street. Pre-flop this is the full big blind,
   * even when the posted blind is short all-in. It is zero on later streets.
   * When omitted, an initial forced commitment implies a full minimum bring-in.
   */
  readonly bringIn?: number;
}

export interface BettingRoundState {
  readonly players: readonly BettingPlayerState[];
  readonly actorId: string | null;
  readonly currentBet: number;
  readonly minimumBet: number;
  readonly bringIn: number;
  readonly lastFullRaiseSize: number;
  readonly complete: boolean;
  readonly version: number;
}

export interface WagerRange {
  readonly minimumTo: number;
  readonly maximumTo: number;
}

export interface LegalBettingActions {
  readonly playerId: string;
  readonly canFold: boolean;
  readonly canCheck: boolean;
  readonly callAmount: number | null;
  readonly betTo: WagerRange | null;
  readonly raiseTo: WagerRange | null;
  readonly canAllIn: boolean;
}

export type BettingRuleErrorCode =
  'ROUND_COMPLETE' | 'PLAYER_NOT_FOUND' | 'OUT_OF_TURN' | 'ILLEGAL_ACTION' | 'INVALID_AMOUNT';

export class BettingRuleError extends Error {
  readonly code: BettingRuleErrorCode;

  constructor(code: BettingRuleErrorCode, message: string) {
    super(message);
    this.name = 'BettingRuleError';
    this.code = code;
  }
}

function playerCanAct(player: BettingPlayerState): boolean {
  return !player.folded && !player.allIn && player.stack > 0;
}

function sortedPlayers(players: readonly BettingPlayerState[]): BettingPlayerState[] {
  return [...players].sort((left, right) => left.seat - right.seat);
}

function nextPendingPlayer(
  players: readonly BettingPlayerState[],
  afterSeat: number,
  currentBet: number,
  bringIn: number,
): BettingPlayerState | null {
  const ordered = sortedPlayers(players);
  const after = ordered.filter((player) => player.seat > afterSeat);
  const before = ordered.filter((player) => player.seat <= afterSeat);
  const requiredBet = requiredBetLevel(players, currentBet, bringIn);
  return (
    [...after, ...before].find(
      (player) =>
        playerCanAct(player) &&
        (player.committedStreet < requiredBet || player.lastActedAtBet === null),
    ) ?? null
  );
}

/**
 * A short big blind still establishes the full pre-flop bring-in while at
 * least two players retain chips. Once only one player can act, there can be
 * no further betting and that player only has to match the chips actually in
 * front of an opponent.
 */
function requiredBetLevel(
  players: readonly BettingPlayerState[],
  currentBet: number,
  bringIn: number,
): number {
  const actionableCount = players.filter(playerCanAct).length;
  return actionableCount >= 2 ? Math.max(currentBet, bringIn) : currentBet;
}

function isRoundComplete(
  players: readonly BettingPlayerState[],
  currentBet: number,
  bringIn: number,
): boolean {
  const contenders = players.filter((player) => !player.folded);
  if (contenders.length <= 1) {
    return true;
  }

  const actionable = contenders.filter(playerCanAct);
  if (actionable.length === 0) {
    return true;
  }
  const requiredBet = requiredBetLevel(players, currentBet, bringIn);
  if (actionable.some((player) => player.committedStreet < requiredBet)) {
    return false;
  }
  if (actionable.length === 1) {
    return true;
  }
  return actionable.every((player) => player.lastActedAtBet !== null);
}

export function assertBettingState(state: BettingRoundState): void {
  assertChipAmount(state.currentBet, 'current bet');
  assertChipAmount(state.minimumBet, 'minimum bet', { positive: true });
  assertChipAmount(state.bringIn, 'bring-in');
  assertChipAmount(state.lastFullRaiseSize, 'last full raise size', { positive: true });
  if (!Number.isSafeInteger(state.version) || state.version < 0) {
    throw new RangeError('betting state version must be a non-negative safe integer');
  }
  if (state.players.length < 2) {
    throw new RangeError('a betting round requires at least two players');
  }
  if (new Set(state.players.map((player) => player.playerId)).size !== state.players.length) {
    throw new RangeError('betting player ids must be unique');
  }
  if (new Set(state.players.map((player) => player.seat)).size !== state.players.length) {
    throw new RangeError('betting player seats must be unique');
  }

  for (const player of state.players) {
    if (player.playerId.length === 0) {
      throw new RangeError('betting player id must not be empty');
    }
    if (!Number.isSafeInteger(player.seat) || player.seat < 0) {
      throw new RangeError(`seat for ${player.playerId} must be a non-negative safe integer`);
    }
    assertChipAmount(player.stack, `stack for ${player.playerId}`);
    assertChipAmount(player.committedStreet, `street commitment for ${player.playerId}`);
    assertChipAmount(player.committedHand, `hand commitment for ${player.playerId}`);
    if (player.committedHand < player.committedStreet) {
      throw new RangeError(`hand commitment for ${player.playerId} is below street commitment`);
    }
    if (player.allIn !== (!player.folded && player.stack === 0)) {
      throw new RangeError(`all-in flag for ${player.playerId} is inconsistent with stack`);
    }
  }

  const maximumCommitment = Math.max(...state.players.map((player) => player.committedStreet));
  if (state.currentBet !== maximumCommitment) {
    throw new RangeError('current bet must equal the maximum street commitment');
  }
  if (state.complete !== isRoundComplete(state.players, state.currentBet, state.bringIn)) {
    throw new RangeError('complete flag is inconsistent with the betting state');
  }
  if (state.complete && state.actorId !== null) {
    throw new RangeError('a complete betting round cannot have an actor');
  }
  if (!state.complete) {
    const actor = state.players.find((player) => player.playerId === state.actorId);
    if (actor === undefined || !playerCanAct(actor)) {
      throw new RangeError('active betting round must have an actionable actor');
    }
    const requiredBet = requiredBetLevel(state.players, state.currentBet, state.bringIn);
    if (actor.committedStreet === requiredBet && actor.lastActedAtBet !== null) {
      throw new RangeError('actor does not have a pending action');
    }
  }
}

export function createBettingRound(input: CreateBettingRoundInput): BettingRoundState {
  assertChipAmount(input.minimumBet, 'minimum bet', { positive: true });
  if (input.players.length < 2) {
    throw new RangeError('a betting round requires at least two players');
  }

  const players = input.players.map<BettingPlayerState>((player) => {
    const committedStreet = player.committedStreet ?? 0;
    const committedHand = player.committedHand ?? committedStreet;
    const folded = player.folded ?? false;
    assertChipAmount(player.stack, `stack for ${player.playerId}`);
    assertChipAmount(committedStreet, `street commitment for ${player.playerId}`);
    assertChipAmount(committedHand, `hand commitment for ${player.playerId}`);
    return {
      playerId: player.playerId,
      seat: player.seat,
      stack: player.stack,
      committedStreet,
      committedHand,
      folded,
      allIn: !folded && player.stack === 0,
      lastActedAtBet: null,
    };
  });
  const currentBet = Math.max(...players.map((player) => player.committedStreet));
  const bringIn = input.bringIn ?? (currentBet > 0 ? input.minimumBet : 0);
  assertChipAmount(bringIn, 'bring-in');
  const lastFullRaiseSize = input.lastFullRaiseSize ?? input.minimumBet;
  assertChipAmount(lastFullRaiseSize, 'last full raise size', { positive: true });
  const complete = isRoundComplete(players, currentBet, bringIn);
  const firstActor = players.find((player) => player.playerId === input.firstActorId);
  if (!complete && (firstActor === undefined || !playerCanAct(firstActor))) {
    throw new RangeError('first actor must be an actionable player');
  }
  const pendingActor = complete
    ? null
    : firstActor !== undefined &&
        (firstActor.committedStreet < requiredBetLevel(players, currentBet, bringIn) ||
          firstActor.lastActedAtBet === null)
      ? firstActor
      : nextPendingPlayer(players, firstActor?.seat ?? -1, currentBet, bringIn);
  if (!complete && pendingActor === null) {
    throw new RangeError('betting round has no pending actor');
  }

  const state: BettingRoundState = {
    players: sortedPlayers(players),
    actorId: pendingActor?.playerId ?? null,
    currentBet,
    minimumBet: input.minimumBet,
    bringIn,
    lastFullRaiseSize,
    complete,
    version: 0,
  };
  assertBettingState(state);
  return state;
}

function playerRaiseIsReopened(state: BettingRoundState, player: BettingPlayerState): boolean {
  const currentLevel = requiredBetLevel(state.players, state.currentBet, state.bringIn);
  return (
    player.lastActedAtBet === null ||
    currentLevel - player.lastActedAtBet >= state.lastFullRaiseSize
  );
}

function minimumRaiseTo(state: BettingRoundState): number {
  const currentLevel = requiredBetLevel(state.players, state.currentBet, state.bringIn);
  return currentLevel === 0 ? state.minimumBet : currentLevel + state.lastFullRaiseSize;
}

export function getLegalActions(
  state: BettingRoundState,
  playerId: string | null = state.actorId,
): LegalBettingActions {
  if (playerId === null) {
    throw new BettingRuleError('ROUND_COMPLETE', 'betting round is complete');
  }
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (player === undefined) {
    throw new BettingRuleError('PLAYER_NOT_FOUND', `unknown player ${playerId}`);
  }
  if (state.complete) {
    throw new BettingRuleError('ROUND_COMPLETE', 'betting round is complete');
  }
  if (state.actorId !== playerId) {
    throw new BettingRuleError('OUT_OF_TURN', `it is not ${playerId}'s turn`);
  }

  const currentLevel = requiredBetLevel(state.players, state.currentBet, state.bringIn);
  const amountToCall = Math.max(0, currentLevel - player.committedStreet);
  const maximumTo = player.committedStreet + player.stack;
  const opponentCanAct = state.players.some(
    (candidate) => candidate.playerId !== playerId && playerCanAct(candidate),
  );
  const raiseReopened = opponentCanAct && playerRaiseIsReopened(state, player);
  const minimumTo = minimumRaiseTo(state);
  const canMakeFullWager = raiseReopened && maximumTo >= minimumTo;
  const canAllIn =
    player.stack > 0 &&
    (maximumTo <= currentLevel || (opponentCanAct && (state.currentBet === 0 || raiseReopened)));

  return {
    playerId,
    canFold: true,
    canCheck: amountToCall === 0,
    callAmount: amountToCall > 0 ? Math.min(amountToCall, player.stack) : null,
    betTo: state.currentBet === 0 && canMakeFullWager ? { minimumTo, maximumTo } : null,
    raiseTo: state.currentBet > 0 && canMakeFullWager ? { minimumTo, maximumTo } : null,
    canAllIn,
  };
}

function replacePlayer(
  players: readonly BettingPlayerState[],
  changed: BettingPlayerState,
): BettingPlayerState[] {
  return players.map((player) => (player.playerId === changed.playerId ? changed : player));
}

function commitTo(
  player: BettingPlayerState,
  amountTo: number,
  actedAtBet: number,
): BettingPlayerState {
  const additional = amountTo - player.committedStreet;
  if (additional < 0 || additional > player.stack) {
    throw new BettingRuleError('INVALID_AMOUNT', 'wager is outside the player stack');
  }
  const stack = player.stack - additional;
  return {
    ...player,
    stack,
    committedStreet: amountTo,
    committedHand: player.committedHand + additional,
    allIn: stack === 0,
    lastActedAtBet: actedAtBet,
  };
}

function applyWagerTo(
  state: BettingRoundState,
  player: BettingPlayerState,
  amountTo: number,
  expectedType: 'BET_TO' | 'RAISE_TO',
): { player: BettingPlayerState; currentBet: number; lastFullRaiseSize: number } {
  try {
    assertChipAmount(amountTo, 'amountTo', { positive: true });
  } catch (error) {
    throw new BettingRuleError(
      'INVALID_AMOUNT',
      error instanceof Error ? error.message : 'invalid wager amount',
    );
  }
  if (expectedType === 'BET_TO' && state.currentBet !== 0) {
    throw new BettingRuleError('ILLEGAL_ACTION', 'BET_TO is only valid before an opening bet');
  }
  if (expectedType === 'RAISE_TO' && state.currentBet === 0) {
    throw new BettingRuleError('ILLEGAL_ACTION', 'RAISE_TO requires an existing bet');
  }
  const currentLevel = requiredBetLevel(state.players, state.currentBet, state.bringIn);
  if (amountTo <= currentLevel) {
    throw new BettingRuleError('INVALID_AMOUNT', 'wager must exceed the current betting level');
  }
  if (
    !state.players.some(
      (candidate) => candidate.playerId !== player.playerId && playerCanAct(candidate),
    )
  ) {
    throw new BettingRuleError('ILLEGAL_ACTION', 'cannot raise when no opponent can act');
  }

  const maximumTo = player.committedStreet + player.stack;
  if (amountTo > maximumTo) {
    throw new BettingRuleError('INVALID_AMOUNT', 'wager exceeds the player stack');
  }
  if (!playerRaiseIsReopened(state, player)) {
    throw new BettingRuleError('ILLEGAL_ACTION', 'betting has not been reopened for this player');
  }

  const requiredFullWager = minimumRaiseTo(state);
  const isAllIn = amountTo === maximumTo;
  if (amountTo < requiredFullWager && !isAllIn) {
    throw new BettingRuleError('INVALID_AMOUNT', `minimum wager is ${requiredFullWager}`);
  }

  const fullRaise = amountTo >= requiredFullWager;
  const lastFullRaiseSize = fullRaise ? amountTo - currentLevel : state.lastFullRaiseSize;
  return {
    player: commitTo(player, amountTo, amountTo),
    currentBet: amountTo,
    lastFullRaiseSize,
  };
}

export function applyBettingAction(
  state: BettingRoundState,
  playerId: string,
  action: BettingAction,
): BettingRoundState {
  const legal = getLegalActions(state, playerId);
  const player = state.players.find((candidate) => candidate.playerId === playerId)!;
  let changedPlayer: BettingPlayerState;
  let currentBet = state.currentBet;
  let lastFullRaiseSize = state.lastFullRaiseSize;

  switch (action.type) {
    case 'FOLD':
      changedPlayer = {
        ...player,
        folded: true,
        allIn: false,
        lastActedAtBet: requiredBetLevel(state.players, state.currentBet, state.bringIn),
      };
      break;
    case 'CHECK':
      if (!legal.canCheck) {
        throw new BettingRuleError('ILLEGAL_ACTION', 'cannot check while facing a bet');
      }
      changedPlayer = {
        ...player,
        lastActedAtBet: requiredBetLevel(state.players, state.currentBet, state.bringIn),
      };
      break;
    case 'CALL': {
      if (legal.callAmount === null) {
        throw new BettingRuleError('ILLEGAL_ACTION', 'there is no bet to call');
      }
      const amountTo = player.committedStreet + legal.callAmount;
      changedPlayer = commitTo(
        player,
        amountTo,
        requiredBetLevel(state.players, state.currentBet, state.bringIn),
      );
      currentBet = Math.max(currentBet, amountTo);
      break;
    }
    case 'BET_TO': {
      const result = applyWagerTo(state, player, action.amountTo, action.type);
      changedPlayer = result.player;
      currentBet = result.currentBet;
      lastFullRaiseSize = result.lastFullRaiseSize;
      break;
    }
    case 'RAISE_TO': {
      const result = applyWagerTo(state, player, action.amountTo, action.type);
      changedPlayer = result.player;
      currentBet = result.currentBet;
      lastFullRaiseSize = result.lastFullRaiseSize;
      break;
    }
    case 'ALL_IN': {
      if (!legal.canAllIn) {
        throw new BettingRuleError('ILLEGAL_ACTION', 'all-in raise is not legal');
      }
      const amountTo = player.committedStreet + player.stack;
      const currentLevel = requiredBetLevel(state.players, state.currentBet, state.bringIn);
      if (amountTo <= currentLevel) {
        changedPlayer = commitTo(player, amountTo, currentLevel);
        currentBet = Math.max(currentBet, amountTo);
      } else {
        const result = applyWagerTo(
          state,
          player,
          amountTo,
          state.currentBet === 0 ? 'BET_TO' : 'RAISE_TO',
        );
        changedPlayer = result.player;
        currentBet = result.currentBet;
        lastFullRaiseSize = result.lastFullRaiseSize;
      }
      break;
    }
  }

  const players = replacePlayer(state.players, changedPlayer);
  const complete = isRoundComplete(players, currentBet, state.bringIn);
  const actorId = complete
    ? null
    : (nextPendingPlayer(players, changedPlayer.seat, currentBet, state.bringIn)?.playerId ?? null);
  if (!complete && actorId === null) {
    throw new Error('betting round has no pending actor');
  }
  const nextState: BettingRoundState = {
    players,
    actorId,
    currentBet,
    minimumBet: state.minimumBet,
    bringIn: state.bringIn,
    lastFullRaiseSize,
    complete,
    version: state.version + 1,
  };
  assertBettingState(nextState);
  return nextState;
}
