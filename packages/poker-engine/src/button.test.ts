import { describe, expect, it } from 'vitest';

import { getTablePositions, orderedSeatsAfter, rotateDealerButton } from './button.js';

describe('dealer button and positions', () => {
  it('rotates over empty seats', () => {
    expect(rotateDealerButton([0, 2, 5], null)).toBe(0);
    expect(rotateDealerButton([0, 2, 5], 0)).toBe(2);
    expect(rotateDealerButton([0, 2, 5], 2)).toBe(5);
    expect(rotateDealerButton([0, 2, 5], 5)).toBe(0);
  });

  it('assigns heads-up blinds and action order correctly', () => {
    expect(getTablePositions([1, 4], 1)).toEqual({
      buttonSeat: 1,
      smallBlindSeat: 1,
      bigBlindSeat: 4,
      preflopFirstSeat: 1,
      postflopFirstSeat: 4,
    });
  });

  it('assigns multiway positions clockwise', () => {
    expect(getTablePositions([0, 2, 3, 5], 3)).toEqual({
      buttonSeat: 3,
      smallBlindSeat: 5,
      bigBlindSeat: 0,
      preflopFirstSeat: 2,
      postflopFirstSeat: 5,
    });
    expect(orderedSeatsAfter([0, 2, 3, 5], 3)).toEqual([5, 0, 2, 3]);
  });
});
