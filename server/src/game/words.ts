import * as fs from 'fs';
import * as path from 'path';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// When bundled with tsup, __dirname is the dist/ directory.
// In dev (tsx), __dirname is src/game/. Both are handled by searching up.
const candidates = [
  path.join(__dirname, 'words.txt'),           // bundled: dist/words.txt
  path.join(__dirname, 'game', 'words.txt'),   // alt bundle layout
  path.join(__dirname, '..', '..', 'src', 'game', 'words.txt'), // should not be needed
];
const filePath = candidates.find(fs.existsSync) ?? path.join(__dirname, 'words.txt');
const raw = fs.readFileSync(filePath, 'utf-8');
const ALL_WORDS: string[] = shuffleArray(
  raw
    .split('\n')
    .map((w) => w.trim())
    .filter((w) => w.length >= 4)
);

let cursor = 0;

/** Returns the next `count` unique words from the shuffled pool. */
export function dealWords(count: number): string[] {
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    words.push(ALL_WORDS[cursor % ALL_WORDS.length]);
    cursor++;
  }
  return words;
}

export { ALL_WORDS };
