import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('.', import.meta.url));
const userInterfaceFiles = readdirSync(srcDir, { recursive: true, withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() && /\.(tsx?|css|html)$/.test(entry.name) && !/\.test\./.test(entry.name),
  )
  .map((entry) => join(entry.parentPath, entry.name));

const userInterfaceSource = userInterfaceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

const roomStateSource = [
  new URL('../../server/src/room/actor.ts', import.meta.url),
  new URL('../../server/src/room/state.ts', import.meta.url),
  new URL('../../server/src/room/projection.ts', import.meta.url),
  new URL('../../server/src/repository.ts', import.meta.url),
  new URL('../../../packages/protocol/src/types.ts', import.meta.url),
]
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

describe('product copy', () => {
  it('does not reintroduce promotional or conversational phrases', () => {
    const disallowed = [
      'PLAY TOGETHER',
      '朋友到齐',
      '挑一桌',
      '组局小助手',
      '今晚就从这里开始',
      '大家重新点一下准备',
      '结果还没商量好',
      '我来开桌',
      '下手休息',
      '我准备好了',
      '牌局回放',
      '行动令牌',
    ];

    for (const phrase of disallowed) expect(userInterfaceSource).not.toContain(phrase);
  });

  it('uses 牌桌 instead of 房间 in current interface copy', () => {
    for (const file of userInterfaceFiles) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('房间');
    }
  });

  it('keeps room state structured instead of publishing persistent narration', () => {
    expect(roomStateSource).not.toMatch(/\b(?:this\.)?state\.message\s*=/u);
    expect(roomStateSource).not.toContain('message: state.message');
    expect(roomStateSource).not.toContain('message: string | null');
    expect(userInterfaceSource).not.toContain('roomMessage');
    expect(userInterfaceSource).not.toContain('room-message');
  });

  it('does not render helper or safety paragraphs outside triggered errors', () => {
    for (const token of [
      'field-help',
      'sheet-safety',
      'waiting-names',
      'fair-chip',
      '金额为本轮累计投入',
      '现场牌面为准',
      '超时：自动过牌或弃牌',
    ]) {
      expect(userInterfaceSource).not.toContain(token);
    }
  });

  it('does not expose a first-login or user password-change flow', () => {
    for (const phrase of [
      '临时密码',
      '待首次修改',
      '请先修改初始密码',
      '去修改密码',
      '修改登录密码',
    ]) {
      expect(userInterfaceSource).not.toContain(phrase);
    }
    expect(userInterfaceSource).not.toContain('/api/auth/password');
  });
});
