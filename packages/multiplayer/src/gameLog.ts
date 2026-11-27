export const MAX_GAME_LOG_ENTRIES = 100;

/** Append an entry and update the unread cursor after evicting old entries. */
export function appendGameLog<Entry>(entries: Entry[], cursor: number, entry: Entry): number {
  entries.push(entry);
  const overflow = entries.length - MAX_GAME_LOG_ENTRIES;
  if (overflow <= 0) return cursor;

  entries.splice(0, overflow);
  return Math.max(0, cursor - overflow);
}
