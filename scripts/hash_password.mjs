#!/usr/bin/env node
// Генерация хеша пароля для EBZ_PRESET_USERS (scrypt, node:crypto, без зависимостей).
//   node scripts/hash_password.mjs            # интерактивный ввод (без эха)
//   echo -n 'пароль' | node scripts/hash_password.mjs
//   node scripts/hash_password.mjs 'пароль'   # пароль попадёт в историю shell — только для dev
// Формат результата: scrypt:<salt hex>:<hash hex> (совпадает с src/lib/auth.ts)
import crypto from 'node:crypto';

const KEYLEN = 64;

function encode(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, '');
}

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stderr.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    stdin.on('data', function onData(ch) {
      for (const c of ch) {
        if (c === '\r' || c === '\n' || c === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stderr.write('\n');
          return resolve(buf);
        }
        if (c === '\u0003') process.exit(130);
        if (c === '\u007f') buf = buf.slice(0, -1);
        else buf += c;
      }
    });
  });
}

let password = process.argv[2];
if (password === undefined) {
  password = process.stdin.isTTY ? await promptHidden('Пароль: ') : await readStdin();
}
if (!password) {
  console.error('Пустой пароль не допускается');
  process.exit(1);
}
if (process.stdin.isTTY && process.argv[2] === undefined) {
  const again = await promptHidden('Повторите пароль: ');
  if (again !== password) {
    console.error('Пароли не совпадают');
    process.exit(1);
  }
}
console.log(encode(password));
