import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export interface EncryptedPayload {
  keyVersion: number;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(token: string, pepper: string): string {
  return createHmac('sha256', pepper).update(token).digest('base64url');
}

export function safeTokenHashEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

export function encryptSnapshot(value: unknown, keyBase64: string): EncryptedPayload {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    keyVersion: 1,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptSnapshot<T>(payload: EncryptedPayload, keyBase64: string): T {
  if (payload.keyVersion !== 1) {
    throw new Error(`Unsupported snapshot key version ${payload.keyVersion}`);
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(keyBase64, 'base64'),
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
