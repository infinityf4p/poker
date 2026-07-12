import argon2 from 'argon2';

const stdinPassword = process.stdin.isTTY
  ? ''
  : await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
      process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').trimEnd()));
      process.stdin.on('error', reject);
    });
const password = process.argv[2] || stdinPassword;
if (!password || password.length < 16) {
  throw new Error(
    'Provide a password of at least 16 characters as the first argument or on standard input',
  );
}

console.log(
  await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  }),
);
