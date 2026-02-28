/**
 * One-time script: downloads FrequencyWords pt-BR list and produces words.txt
 * Run: npm run fetch-words
 *
 * Source: https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_50k.txt
 */

import { createWriteStream } from 'fs';
import { get } from 'https';
import * as path from 'path';
import * as readline from 'readline';
import { Writable } from 'stream';

const URL =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_50k.txt';
const OUT = path.join(__dirname, '../src/game/words.txt');

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function isClean(word: string): boolean {
  return /^[a-z]{4,}$/.test(word);
}

async function main() {
  console.log('Downloading frequency list…');

  await new Promise<void>((resolve, reject) => {
    get(URL, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const out = createWriteStream(OUT);
      const rl = readline.createInterface({ input: res });
      let count = 0;

      rl.on('line', (line) => {
        const parts = line.split(' ');
        if (parts.length < 1) return;
        const raw = parts[0];
        const word = normalize(raw);
        if (isClean(word)) {
          out.write(word + '\n');
          count++;
        }
      });

      rl.on('close', () => {
        (out as Writable).end(() => {
          console.log(`Done — ${count} words written to ${OUT}`);
          resolve();
        });
      });

      rl.on('error', reject);
    }).on('error', reject);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
