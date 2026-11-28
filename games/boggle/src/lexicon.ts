import { readFileSync } from 'node:fs';
import wordListPath from 'word-list';
import { MIN_LENGTH, neighbours } from './rules.js';

/** Sorted, so a prefix check is one binary search. */
const WORDS = readFileSync(wordListPath, 'utf8').split(/\r?\n/).filter((word) => word.length >= MIN_LENGTH).sort();
const SET = new Set(WORDS);

export const isWord = (word: string) => SET.has(word);

function hasPrefix(prefix: string) {
  let low = 0;
  let high = WORDS.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (WORDS[mid] < prefix) low = mid + 1;
    else high = mid;
  }
  return low < WORDS.length && WORDS[low].startsWith(prefix);
}

/** Every dictionary word that can be traced on the grid. */
export function solve(grid: readonly string[]): string[] {
  const found = new Set<string>();
  const walk = (cell: number, prefix: string, used: Set<number>) => {
    const face = grid[cell].toLowerCase();
    const word = prefix + (face === 'q' ? 'qu' : face);
    if (!hasPrefix(word)) return;
    if (word.length >= MIN_LENGTH && SET.has(word)) found.add(word);
    used.add(cell);
    for (const next of neighbours(cell)) if (!used.has(next)) walk(next, word, used);
    used.delete(cell);
  };
  for (let cell = 0; cell < grid.length; cell++) walk(cell, '', new Set());
  return [...found].sort((a, b) => b.length - a.length || a.localeCompare(b));
}
