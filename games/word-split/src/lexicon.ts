import { readFileSync } from 'node:fs';
import wordListPath from 'word-list';

const words = new Set(readFileSync(wordListPath, 'utf8').split(/\r?\n/));
export const isEnglishWord = (word: string) => words.has(word);

// Each seed has eight tiles, several vowels, and at least one full-length answer.
export const RACKS = [
  'absolute', 'acoustic', 'airplane', 'alphabet', 'asteroid', 'baseball',
  'birthday', 'bracelet', 'campfire', 'cardinal', 'ceramics', 'cleaning',
  'cobblers', 'crayfish', 'creative', 'crossing', 'daybreak', 'drifting',
  'earliest', 'earthman', 'firewood', 'flamingo', 'floating', 'football',
  'friendly', 'gardener', 'goldfish', 'graphics', 'haystack', 'hillside',
  'hospital', 'laughter', 'lemonade', 'lifeboat', 'literate', 'magnetic',
  'marathon', 'mountain', 'mushroom', 'northern', 'notebook', 'operator',
  'outlands', 'paintbox', 'parsnips', 'pavement', 'personal', 'pipeline',
  'plankton', 'portable', 'postcard', 'rainbows', 'reaction', 'relation',
  'reserved', 'sailboat', 'sapphire', 'seacoast', 'showtime', 'snowfall',
  'software', 'speakers', 'sporting', 'starfish', 'stardust', 'sunlight',
  'tapestry', 'treasure', 'tropical', 'umbrella', 'universe',
  'vertical', 'wildlife', 'windmill', 'workshop',
].filter(isEnglishWord);
