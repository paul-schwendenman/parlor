import { PLAYER_NAME_MAX_LENGTH as MAX_NAME_LENGTH } from '@parlor/game-types';

const NAME_CHARACTERS = /^[\p{L}\p{M}\p{Nd} .'’_\u2010\u2011-]+$/u;

// Fold common Greek and Cyrillic lookalikes in addition to Unicode compatibility forms.
const LOOKALIKES: Readonly<Record<string, string>> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j',
  ѕ: 's', һ: 'h', к: 'k', м: 'm', в: 'b', т: 't', н: 'h',
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', μ: 'm', ν: 'v', ο: 'o',
  ρ: 'p', τ: 't', υ: 'y', χ: 'x',
};

export function foldPlayerName(name: string): string {
  return name.normalize('NFKD').toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/[\u2010\u2011]/gu, '-')
    .replace(/’/gu, "'")
    .replace(/\p{L}/gu, (letter) => LOOKALIKES[letter] ?? letter)
    .trim()
    .replace(/ +/g, ' ');
}

type ValidatedPlayerName = { name: string; error?: never } | { name?: never; error: string };

export function validatePlayerName(input: unknown): ValidatedPlayerName {
  if (typeof input !== 'string') return { error: 'Invalid player name' };
  const name = input.normalize('NFC').trim();
  if (name.length === 0 || [...name].length > MAX_NAME_LENGTH) {
    return { error: `Player names must be 1–${MAX_NAME_LENGTH} characters` };
  }
  if (/\p{C}/u.test(input) || !NAME_CHARACTERS.test(name) || !/[\p{L}\p{Nd}]/u.test(name)) {
    return { error: 'Use letters, numbers, spaces, apostrophes, periods, underscores or hyphens in your name' };
  }
  const folded = foldPlayerName(name);
  if (folded === 'bot' || folded.startsWith('bot ')) {
    return { error: 'Names starting with Bot are reserved' };
  }
  return { name };
}
