export interface TablePositions {
  readonly buttonSeat: number;
  readonly smallBlindSeat: number;
  readonly bigBlindSeat: number;
  readonly preflopFirstSeat: number;
  readonly postflopFirstSeat: number;
}

function normalizeSeats(activeSeats: readonly number[]): number[] {
  if (activeSeats.length === 0) {
    throw new RangeError('at least one active seat is required');
  }
  const seats = [...new Set(activeSeats)].sort((left, right) => left - right);
  if (seats.some((seat) => !Number.isSafeInteger(seat) || seat < 0)) {
    throw new RangeError('seat indexes must be non-negative safe integers');
  }
  if (seats.length !== activeSeats.length) {
    throw new RangeError('active seats must be unique');
  }
  return seats;
}

export function nextOccupiedSeat(activeSeats: readonly number[], afterSeat: number): number {
  const seats = normalizeSeats(activeSeats);
  return seats.find((seat) => seat > afterSeat) ?? seats[0]!;
}

export function orderedSeatsAfter(activeSeats: readonly number[], afterSeat: number): number[] {
  const seats = normalizeSeats(activeSeats);
  const nextIndex = seats.findIndex((seat) => seat > afterSeat);
  const startIndex = nextIndex === -1 ? 0 : nextIndex;
  return [...seats.slice(startIndex), ...seats.slice(0, startIndex)];
}

export function rotateDealerButton(
  activeSeats: readonly number[],
  previousButtonSeat: number | null,
): number {
  const seats = normalizeSeats(activeSeats);
  return previousButtonSeat === null ? seats[0]! : nextOccupiedSeat(seats, previousButtonSeat);
}

export function getTablePositions(
  activeSeats: readonly number[],
  buttonSeat: number,
): TablePositions {
  const seats = normalizeSeats(activeSeats);
  if (seats.length < 2) {
    throw new RangeError('at least two active seats are required');
  }
  if (!seats.includes(buttonSeat)) {
    throw new RangeError('button seat must be active');
  }

  if (seats.length === 2) {
    const bigBlindSeat = nextOccupiedSeat(seats, buttonSeat);
    return {
      buttonSeat,
      smallBlindSeat: buttonSeat,
      bigBlindSeat,
      preflopFirstSeat: buttonSeat,
      postflopFirstSeat: bigBlindSeat,
    };
  }

  const smallBlindSeat = nextOccupiedSeat(seats, buttonSeat);
  const bigBlindSeat = nextOccupiedSeat(seats, smallBlindSeat);
  return {
    buttonSeat,
    smallBlindSeat,
    bigBlindSeat,
    preflopFirstSeat: nextOccupiedSeat(seats, bigBlindSeat),
    postflopFirstSeat: nextOccupiedSeat(seats, buttonSeat),
  };
}
