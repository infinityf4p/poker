import {
  applyBettingAction,
  createBettingRound,
  getLegalActions,
  type BettingAction,
  type BettingRoundState,
  type LegalBettingActions,
} from './betting.js';
import { assertUniqueCards, createDeck, shuffleDeck, type Card, type RandomInt } from './cards.js';
import { assertChipAmount } from './chips.js';
import { getTablePositions, orderedSeatsAfter, type TablePositions } from './button.js';
import { rankHoldemPlayers, type HoldemRanking, type RankedPlayer } from './hand-rank.js';
import {
  buildSidePots,
  settleSidePots,
  type PotContribution,
  type PotSettlement,
  type SidePotBuild,
} from './side-pots.js';

export interface HandPlayerInput {
  readonly playerId: string;
  readonly seat: number;
  readonly stack: number;
}

export interface CreateHandInput {
  readonly players: readonly HandPlayerInput[];
  readonly buttonSeat: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  /** A complete deck in deal order. Useful for replay and deterministic tests. */
  readonly deck?: readonly Card[];
  readonly randomInt?: RandomInt;
}

export interface PlayerHoleCards {
  readonly playerId: string;
  readonly cards: readonly [Card, Card];
}

export interface CreatedHoldemHand {
  readonly phase: 'PREFLOP';
  readonly positions: TablePositions;
  readonly betting: BettingRoundState;
  readonly holeCards: readonly PlayerHoleCards[];
  readonly communityCards: readonly Card[];
  readonly remainingDeck: readonly Card[];
  readonly initialTotalChips: number;
}

export type CommunityStreet = 'FLOP' | 'TURN' | 'RIVER';

export interface CommunityDeal {
  readonly street: CommunityStreet;
  readonly burnCard: Card;
  readonly dealtCards: readonly Card[];
  readonly communityCards: readonly Card[];
  readonly remainingDeck: readonly Card[];
}

export interface ShowdownPlayer {
  readonly playerId: string;
  readonly holeCards: readonly [Card, Card];
  readonly committedHand: number;
  readonly folded: boolean;
}

export interface HoldemShowdown {
  readonly pots: SidePotBuild;
  readonly ranking: HoldemRanking;
  readonly settlement: PotSettlement;
}

function validateHandPlayers(players: readonly HandPlayerInput[]): void {
  if (players.length < 2 || players.length > 10) {
    throw new RangeError('a hand requires between two and ten players');
  }
  if (new Set(players.map((player) => player.playerId)).size !== players.length) {
    throw new RangeError('hand player ids must be unique');
  }
  if (new Set(players.map((player) => player.seat)).size !== players.length) {
    throw new RangeError('hand player seats must be unique');
  }
  for (const player of players) {
    if (player.playerId.length === 0) {
      throw new RangeError('hand player id must not be empty');
    }
    if (!Number.isSafeInteger(player.seat) || player.seat < 0) {
      throw new RangeError(`seat for ${player.playerId} must be a non-negative safe integer`);
    }
    assertChipAmount(player.stack, `stack for ${player.playerId}`, { positive: true });
  }
}

function blindPayment(stack: number, blind: number): number {
  return Math.min(stack, blind);
}

export function createHand(input: CreateHandInput): CreatedHoldemHand {
  validateHandPlayers(input.players);
  assertChipAmount(input.smallBlind, 'small blind', { positive: true });
  assertChipAmount(input.bigBlind, 'big blind', { positive: true });
  if (input.smallBlind > input.bigBlind) {
    throw new RangeError('small blind cannot exceed big blind');
  }

  const seats = input.players.map((player) => player.seat);
  const positions = getTablePositions(seats, input.buttonSeat);
  const suppliedDeck = input.deck;
  const deck =
    suppliedDeck === undefined ? shuffleDeck(createDeck(), input.randomInt) : [...suppliedDeck];
  if (deck.length !== 52) {
    throw new RangeError('createHand requires a complete 52-card deck');
  }
  assertUniqueCards(deck);

  const playersBySeat = new Map(input.players.map((player) => [player.seat, player]));
  const dealOrder = orderedSeatsAfter(seats, input.buttonSeat);
  const holes = new Map<string, Card[]>();
  let deckCursor = 0;
  for (let round = 0; round < 2; round += 1) {
    for (const seat of dealOrder) {
      const player = playersBySeat.get(seat)!;
      const cards = holes.get(player.playerId) ?? [];
      cards.push(deck[deckCursor]!);
      holes.set(player.playerId, cards);
      deckCursor += 1;
    }
  }

  const bettingInputs = input.players.map((player) => {
    const blind =
      player.seat === positions.smallBlindSeat
        ? input.smallBlind
        : player.seat === positions.bigBlindSeat
          ? input.bigBlind
          : 0;
    const committed = blindPayment(player.stack, blind);
    return {
      playerId: player.playerId,
      seat: player.seat,
      stack: player.stack - committed,
      committedStreet: committed,
      committedHand: committed,
    };
  });
  const actorOrder = [
    positions.preflopFirstSeat,
    ...orderedSeatsAfter(seats, positions.preflopFirstSeat),
  ];
  const firstActorSeat = actorOrder.find((seat, index) => {
    if (index > 0 && seat === positions.preflopFirstSeat) {
      return false;
    }
    return bettingInputs.find((player) => player.seat === seat)!.stack > 0;
  });
  const firstActor =
    bettingInputs.find((player) => player.seat === firstActorSeat) ?? bettingInputs[0]!;
  const betting = createBettingRound({
    players: bettingInputs,
    firstActorId: firstActor.playerId,
    minimumBet: input.bigBlind,
  });
  const holeCards = input.players.map<PlayerHoleCards>((player) => {
    const cards = holes.get(player.playerId)!;
    return { playerId: player.playerId, cards: [cards[0]!, cards[1]!] };
  });

  return {
    phase: 'PREFLOP',
    positions,
    betting,
    holeCards,
    communityCards: [],
    remainingDeck: deck.slice(deckCursor),
    initialTotalChips: input.players.reduce((sum, player) => sum + player.stack, 0),
  };
}

export function dealCommunityStreet(
  remainingDeck: readonly Card[],
  communityCards: readonly Card[],
  street: CommunityStreet,
): CommunityDeal {
  const expectedBoardSize = street === 'FLOP' ? 0 : street === 'TURN' ? 3 : 4;
  if (communityCards.length !== expectedBoardSize) {
    throw new RangeError(`${street} must follow a board with ${expectedBoardSize} cards`);
  }
  const cardsToDeal = street === 'FLOP' ? 3 : 1;
  if (remainingDeck.length < cardsToDeal + 1) {
    throw new RangeError('not enough cards remain to burn and deal the street');
  }
  assertUniqueCards([...remainingDeck, ...communityCards]);

  const burnCard = remainingDeck[0]!;
  const dealtCards = remainingDeck.slice(1, cardsToDeal + 1);
  return {
    street,
    burnCard,
    dealtCards,
    communityCards: [...communityCards, ...dealtCards],
    remainingDeck: remainingDeck.slice(cardsToDeal + 1),
  };
}

export function settleHoldemShowdown(
  players: readonly ShowdownPlayer[],
  communityCards: readonly Card[],
  oddChipOrder: readonly string[],
): HoldemShowdown {
  assertUniqueCards([...communityCards, ...players.flatMap((player) => [...player.holeCards])]);
  const contributions: PotContribution[] = players.map((player) => ({
    playerId: player.playerId,
    amount: player.committedHand,
    folded: player.folded,
  }));
  const pots = buildSidePots(contributions);
  const contenders = players.filter((player) => !player.folded);
  const ranking: HoldemRanking =
    contenders.length <= 1
      ? {
          rankedPlayers: [] satisfies RankedPlayer[],
          winnerIds: contenders.map((player) => player.playerId),
        }
      : rankHoldemPlayers(
          contenders.map((player) => ({
            playerId: player.playerId,
            holeCards: player.holeCards,
          })),
          communityCards,
        );
  const ranks = new Map(ranking.rankedPlayers.map((player) => [player.playerId, player.rank]));
  const settlement = settleSidePots(pots, ranks, oddChipOrder);
  return { pots, ranking, settlement };
}

/** Compatibility aliases for RoomActor call sites. */
export const legalActions = getLegalActions;
export const applyAction = (
  state: BettingRoundState,
  playerId: string,
  action: BettingAction,
): BettingRoundState => applyBettingAction(state, playerId, action);
export const buildPots = buildSidePots;
