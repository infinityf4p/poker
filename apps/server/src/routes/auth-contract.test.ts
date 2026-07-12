import {
  adminAdjustStackSchema,
  adminKickPlayerSchema,
  adminRestorePlayerSchema,
  changeUserPasswordSchema,
  createUserAccountSchema,
  joinRoomSchema,
  userLoginSchema,
} from '@poker/protocol';
import { describe, expect, it } from 'vitest';

describe('permanent user auth contract', () => {
  it('accepts an administrator-created account and a strong temporary password', () => {
    expect(
      createUserAccountSchema.safeParse({
        username: 'table.player-1',
        displayName: 'Player 1',
        password: 'temporary-passphrase',
      }).success,
    ).toBe(true);
  });

  it('rejects weak temporary passwords and invalid account names', () => {
    expect(
      createUserAccountSchema.safeParse({ username: 'bad name', password: 'short' }).success,
    ).toBe(false);
  });

  it('allows invite joins to use the account display name by default', () => {
    expect(joinRoomSchema.parse({})).toEqual({});
  });

  it('requires a different password during first-login password change', () => {
    const password = 'same-long-passphrase';
    expect(
      changeUserPasswordSchema.safeParse({ currentPassword: password, newPassword: password })
        .success,
    ).toBe(false);
    expect(userLoginSchema.safeParse({ username: 'player_1', password }).success).toBe(true);
  });

  it('validates audited administrator stack and membership operations', () => {
    expect(adminAdjustStackSchema.parse({ stack: 3_500, reason: '现场筹码校准' })).toEqual({
      stack: 3_500,
      reason: '现场筹码校准',
    });
    expect(adminAdjustStackSchema.safeParse({ stack: -1, reason: 'bad' }).success).toBe(false);
    expect(adminKickPlayerSchema.parse({})).toEqual({ reason: '管理员移出' });
    expect(adminRestorePlayerSchema.parse({})).toEqual({});
  });
});
