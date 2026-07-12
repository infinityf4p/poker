import { describe, expect, it } from 'vitest';
import { decryptSnapshot, encryptSnapshot, hashOpaqueToken, randomToken } from './crypto.js';

describe('snapshot crypto', () => {
  it('round-trips private state with AES-GCM and rejects another key', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const wrongKey = Buffer.alloc(32, 8).toString('base64');
    const privateState = { deck: ['As', 'Kh'], holeCards: { player: ['2c', '2d'] } };
    const encrypted = encryptSnapshot(privateState, key);
    expect(encrypted.ciphertext).not.toContain('As');
    expect(decryptSnapshot(encrypted, key)).toEqual(privateState);
    expect(() => decryptSnapshot(encrypted, wrongKey)).toThrow();
  });

  it('creates opaque tokens and keyed hashes', () => {
    const token = randomToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashOpaqueToken(token, 'a'.repeat(32))).not.toBe(hashOpaqueToken(token, 'b'.repeat(32)));
  });
});
