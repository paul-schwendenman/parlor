import { CrazyEightsEngine } from '../../../games/crazy-eights/src/lib/server/game/CrazyEightsEngine.ts';
import { KingsCornerEngine } from '../../../games/kings-corner/src/lib/server/game/KingsCornerEngine.ts';
import { LiarsDiceEngine } from '../../../games/liars-dice/src/lib/server/game/LiarsDiceEngine.ts';
import { DEFAULT_CONFIG as C8 } from '../../../games/crazy-eights/src/lib/types/game.ts';
import { DEFAULT_CONFIG as KC } from '../../../games/kings-corner/src/lib/types/game.ts';
import { createPlayer } from '../../../games/liars-dice/src/lib/types/game.ts';

const key = (c: any) => `${c.rank}|${c.suit}`;
function collectCards(o: any, out: Set<string>) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach((x) => collectCards(x, out)); return; }
  if ('rank' in o && 'suit' in o) out.add(key(o));
  for (const v of Object.values(o)) collectCards(v, out);
}
let problems = 0;
function checkCardGame(name: string, mk: () => any, step: (e: any, pid: string, v: any) => void) {
  for (let g = 0; g < 200; g++) {
    const e = mk();
    for (let t = 0; t < 400; t++) {
      const priv = e as any;
      const players = priv.players as any[];
      const pile = new Set<string>(priv.drawPile.map(key));
      for (const p of players) {
        const v = e.getPlayerView(p.id);
        const seen = new Set<string>(); collectCards({ ...v, myHand: [] , drewCard: null}, seen);
        const own = new Set<string>((p.hand as any[]).map(key));
        for (const q of players) if (q.id !== p.id) for (const c of q.hand) if (seen.has(key(c)) && !own.has(key(c))) { problems++; console.log(name, 'LEAK other hand', key(c)); }
        for (const c of pile) if (seen.has(c) && !own.has(c)) { problems++; console.log(name, 'LEAK drawPile', c); }
        if (v.drewCard && !own.has(key(v.drewCard))) { problems++; console.log(name, 'drewCard not own'); }
      }
      const sv = e.getSpectatorView(); const s2 = new Set<string>(); collectCards(sv, s2);
      for (const q of players) for (const c of q.hand) if (s2.has(key(c))) { problems++; console.log(name, 'SPEC LEAK hand', key(c)); }
      for (const c of pile) if (s2.has(c)) { problems++; console.log(name, 'SPEC LEAK pile'); }
      if (e.isGameOver?.() || priv.phase === 'game-over') { (globalThis as any).over = ((globalThis as any).over||0)+1; break; }
      const ap = players[priv.activePlayerIndex];
      try { step(e, ap.id, e.getPlayerView(ap.id)); } catch {}
    }
  }
}
const ps = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
checkCardGame('C8', () => new CrazyEightsEngine(ps, 'R', C8), (e, pid, v) => {
  if (v.phase === 'choosing-suit') return e.chooseSuit(pid, 'hearts');
  if (v.playableCards.length) return e.playCard(pid, v.playableCards[0]);
  if (v.canDraw) return e.drawCard(pid);
  if (v.canPass) return e.pass(pid);
});
checkCardGame('KC', () => new KingsCornerEngine(ps, 'R', KC), (e, pid, v) => {
  if (v.phase === 'drawing') return e.drawCard(pid);
  if (v.playableCards.length) { const pc = v.playableCards[0]; return e.playCard(pid, pc.card, pc.validTargets[0]); }
  return e.endTurn(pid);
});
// Liar's dice: other players' dice must be null until revealed
for (let g = 0; g < 300; g++) {
  const e = new LiarsDiceEngine([createPlayer('a','A'), createPlayer('b','B'), createPlayer('c','C')], 'R');
  for (let t = 0; t < 300; t++) {
    const st = e.getState();
    for (const p of st.players) {
      const v: any = e.getPlayerView(p.id);
      if (st.phase === 'bidding') {
        if (v.revealedDice) { problems++; console.log('LD revealed during bidding'); }
        for (const vp of v.players) if (vp.dice !== null) { problems++; console.log('LD dice visible during bidding'); }
        const s: any = e.getSpectatorView(); if (s.revealedDice || s.players.some((x: any) => x.dice)) { problems++; console.log('LD spec leak'); }
        if (JSON.stringify(v.gameLog).match(/\[\d/)) { console.log('log has arrays?'); }
      }
    }
    if (st.gameOver) break;
    const ap = st.players[st.activePlayerIndex];
    try {
      if (st.phase !== 'bidding') e.startNextRound();
      else if (st.currentBid && Math.random() < 0.4) e.challenge(ap.id);
      else { const v: any = e.getPlayerView(ap.id); e.placeBid(ap.id, v.minimumBid.quantity, v.minimumBid.faceValue); }
    } catch {}
  }
}
console.log('problems', problems);
console.log('games finished', (globalThis as any).over)
