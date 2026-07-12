import { assertUniqueCards, parseCard, type Card } from './cards.js';

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export interface HandRank {
  readonly category: HandCategory;
  readonly tiebreak: readonly number[];
  readonly cards: readonly Card[];
}

export interface HoldemPlayerCards {
  readonly playerId: string;
  readonly holeCards: readonly [Card, Card];
}

export interface RankedPlayer {
  readonly playerId: string;
  readonly rank: HandRank;
}

export interface HoldemRanking {
  readonly rankedPlayers: readonly RankedPlayer[];
  readonly winnerIds: readonly string[];
}

function compareNumberArrays(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return Math.sign(difference);
    }
  }
  return 0;
}

export function compareHandRanks(left: HandRank, right: HandRank): number {
  if (left.category !== right.category) {
    return Math.sign(left.category - right.category);
  }
  return compareNumberArrays(left.tiebreak, right.tiebreak);
}

function straightHigh(values: readonly number[]): number | null {
  const uniqueDescending = [...new Set(values)].sort((left, right) => right - left);
  if (uniqueDescending.includes(14)) {
    uniqueDescending.push(1);
  }

  let run = 1;
  for (let index = 1; index < uniqueDescending.length; index += 1) {
    if (uniqueDescending[index - 1]! - uniqueDescending[index]! === 1) {
      run += 1;
      if (run >= 5) {
        return uniqueDescending[index]! + 4;
      }
    } else {
      run = 1;
    }
  }
  return null;
}

export function evaluateFiveCardHand(cards: readonly Card[]): HandRank {
  if (cards.length !== 5) {
    throw new RangeError('exactly five cards are required');
  }
  assertUniqueCards(cards);

  const parsed = cards.map(parseCard);
  const valuesDescending = parsed.map((card) => card.value).sort((left, right) => right - left);
  const counts = new Map<number, number>();
  for (const value of valuesDescending) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const groups = [...counts.entries()].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount || rightValue - leftValue,
  );
  const flush = parsed.every((card) => card.suit === parsed[0]!.suit);
  const highStraight = straightHigh(valuesDescending);

  if (flush && highStraight !== null) {
    return { category: HandCategory.StraightFlush, tiebreak: [highStraight], cards: [...cards] };
  }

  if (groups[0]![1] === 4) {
    return {
      category: HandCategory.FourOfAKind,
      tiebreak: [groups[0]![0], groups[1]![0]],
      cards: [...cards],
    };
  }

  if (groups[0]![1] === 3 && groups[1]![1] === 2) {
    return {
      category: HandCategory.FullHouse,
      tiebreak: [groups[0]![0], groups[1]![0]],
      cards: [...cards],
    };
  }

  if (flush) {
    return { category: HandCategory.Flush, tiebreak: valuesDescending, cards: [...cards] };
  }

  if (highStraight !== null) {
    return { category: HandCategory.Straight, tiebreak: [highStraight], cards: [...cards] };
  }

  if (groups[0]![1] === 3) {
    const kickers = groups
      .slice(1)
      .map(([value]) => value)
      .sort((left, right) => right - left);
    return {
      category: HandCategory.ThreeOfAKind,
      tiebreak: [groups[0]![0], ...kickers],
      cards: [...cards],
    };
  }

  if (groups[0]![1] === 2 && groups[1]![1] === 2) {
    const pairs = [groups[0]![0], groups[1]![0]].sort((left, right) => right - left);
    return {
      category: HandCategory.TwoPair,
      tiebreak: [...pairs, groups[2]![0]],
      cards: [...cards],
    };
  }

  if (groups[0]![1] === 2) {
    const kickers = groups
      .slice(1)
      .map(([value]) => value)
      .sort((left, right) => right - left);
    return {
      category: HandCategory.OnePair,
      tiebreak: [groups[0]![0], ...kickers],
      cards: [...cards],
    };
  }

  return { category: HandCategory.HighCard, tiebreak: valuesDescending, cards: [...cards] };
}

function* fiveCardCombinations(cards: readonly Card[]): Generator<readonly Card[]> {
  for (let first = 0; first < cards.length - 4; first += 1) {
    for (let second = first + 1; second < cards.length - 3; second += 1) {
      for (let third = second + 1; third < cards.length - 2; third += 1) {
        for (let fourth = third + 1; fourth < cards.length - 1; fourth += 1) {
          for (let fifth = fourth + 1; fifth < cards.length; fifth += 1) {
            yield [cards[first]!, cards[second]!, cards[third]!, cards[fourth]!, cards[fifth]!];
          }
        }
      }
    }
  }
}

export function evaluateBestHand(cards: readonly Card[]): HandRank {
  if (cards.length < 5 || cards.length > 7) {
    throw new RangeError('between five and seven cards are required');
  }
  assertUniqueCards(cards);

  let best: HandRank | null = null;
  for (const combination of fiveCardCombinations(cards)) {
    const candidate = evaluateFiveCardHand(combination);
    if (best === null || compareHandRanks(candidate, best) > 0) {
      best = candidate;
    }
  }
  if (best === null) {
    throw new Error('unable to evaluate cards');
  }
  return best;
}

export function rankHoldemPlayers(
  players: readonly HoldemPlayerCards[],
  communityCards: readonly Card[],
): HoldemRanking {
  if (communityCards.length !== 5) {
    throw new RangeError('showdown requires five community cards');
  }
  if (new Set(players.map((player) => player.playerId)).size !== players.length) {
    throw new RangeError('player ids must be unique');
  }
  assertUniqueCards([...communityCards, ...players.flatMap((player) => [...player.holeCards])]);

  const rankedPlayers = players.map((player) => ({
    playerId: player.playerId,
    rank: evaluateBestHand([...communityCards, ...player.holeCards]),
  }));
  let best: HandRank | null = null;
  for (const player of rankedPlayers) {
    if (best === null || compareHandRanks(player.rank, best) > 0) {
      best = player.rank;
    }
  }
  const winnerIds =
    best === null
      ? []
      : rankedPlayers
          .filter((player) => compareHandRanks(player.rank, best) === 0)
          .map((player) => player.playerId);

  return { rankedPlayers, winnerIds };
}
