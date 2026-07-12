import { describe, expect, it } from 'vitest';
import { safeErrorLogContext } from './app.js';

describe('safeErrorLogContext', () => {
  it('keeps diagnostic codes without serializing SQL parameters or password hashes', () => {
    const passwordHash = '$argon2id$v=19$m=65536,t=3,p=4$private-hash';
    const cause = Object.assign(new Error(`database params: ${passwordHash}`), { code: '23514' });
    const error = Object.assign(new Error(`Failed query: insert params: ${passwordHash}`), {
      code: 'DRIZZLE_QUERY_ERROR',
      cause,
    });

    const context = safeErrorLogContext(error);
    const serialized = JSON.stringify(context);

    expect(context).toEqual({
      errorName: 'Error',
      errorCode: 'DRIZZLE_QUERY_ERROR',
      causeCode: '23514',
    });
    expect(serialized).not.toContain(passwordHash);
    expect(serialized).not.toContain('Failed query');
    expect(serialized).not.toContain('params');
  });
});
