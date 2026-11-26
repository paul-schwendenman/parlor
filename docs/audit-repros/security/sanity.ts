import { CrazyEightsEngine } from '../../../games/crazy-eights/src/lib/server/game/CrazyEightsEngine.ts';
import { DEFAULT_CONFIG as C8 } from '../../../games/crazy-eights/src/lib/types/game.ts';
let over=0;
for (let g=0;g<50;g++){ const e:any=new CrazyEightsEngine([{id:'a',name:'A'},{id:'b',name:'B'}],'R',C8);
 for(let t=0;t<400;t++){ if(e.phase==='game-over'){over++;break;} const pid=e.players[e.activePlayerIndex].id; const v=e.getPlayerView(pid);
  try{ if(v.phase==='choosing-suit') e.chooseSuit(pid,'hearts'); else if(v.playableCards.length) e.playCard(pid,v.playableCards[0]); else if(v.canDraw) e.drawCard(pid); else if(v.canPass) e.pass(pid);}catch(err){} } }
console.log('c8 games over', over, '/50');
