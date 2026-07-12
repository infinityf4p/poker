export const MAX_SAFE_CHIPS = 1_000_000_000;

export function assertChipAmount(
  amount: number,
  label = 'chip amount',
  options: { positive?: boolean } = {},
): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`${label} must be a safe integer`);
  }

  const minimum = options.positive === true ? 1 : 0;
  if (amount < minimum || amount > MAX_SAFE_CHIPS) {
    throw new RangeError(`${label} must be between ${minimum} and ${MAX_SAFE_CHIPS}`);
  }
}
