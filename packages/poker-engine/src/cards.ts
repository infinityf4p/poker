import { randomInt as secureRandomInt } from 'node:crypto';

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['c', 'd', 'h', 's'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type Card = `${Rank}${Suit}`;
export type RandomInt = (maxExclusive: number) => number;

const rankValues: Readonly<Record<Rank, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}${suit}` as Card));
}

export function parseCard(card: Card): { rank: Rank; suit: Suit; value: number } {
  const rank = card[0] as Rank;
  const suit = card[1] as Suit;
  if (!RANKS.includes(rank) || !SUITS.includes(suit) || card.length !== 2) {
    throw new TypeError(`invalid card: ${card}`);
  }

  return { rank, suit, value: rankValues[rank] };
}

export function cardToString(card: Card): Card {
  parseCard(card);
  return card;
}

export function shuffleDeck(items?: readonly Card[], randomInt?: RandomInt): Card[];
export function shuffleDeck<T>(items: readonly T[], randomInt?: RandomInt): T[];
export function shuffleDeck<T>(
  items: readonly T[] = createDeck() as unknown as readonly T[],
  randomInt: RandomInt = secureRandomInt,
): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new RangeError(`randomInt(${index + 1}) returned ${swapIndex}`);
    }
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

export function assertUniqueCards(cards: readonly Card[]): void {
  const unique = new Set(cards);
  if (unique.size !== cards.length) {
    throw new RangeError('cards must not contain duplicates');
  }
  for (const card of cards) {
    parseCard(card);
  }
}
