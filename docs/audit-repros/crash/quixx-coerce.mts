const { QuixxEngine } = await import('../../../games/quixx/src/lib/server/game/QuixxEngine.ts');
const { ROW_NUMBERS } = await import('../../../games/quixx/src/lib/types/game.ts');
for (let i = 0; i < 2000; i++) {
  const e = new QuixxEngine([{ id: 'a', name: 'A', isBot: false }, { id: 'b', name: 'B', isBot: false }], 'X');
  const d = e.rollDice(); const sum = d.white1 + d.white2;
  if (ROW_NUMBERS.red[10] !== sum) continue;
  e.submitPhase1('a', { type: 'phase1-mark', row: 'red', cellIndex: '10' as any });
  e.submitPhase1('b', { type: 'phase1-pass' });
  e.resolvePhase1();
  console.log('sum', sum, 'red row after string "10" mark with 0 prior marks:', JSON.stringify(e.getPlayers()[0].sheet.red), 'lockedRows', e.getLockedRows());
  break;
}
