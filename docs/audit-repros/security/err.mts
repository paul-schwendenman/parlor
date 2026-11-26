import { CrazyEightsEngine } from '../../../games/crazy-eights/src/lib/server/game/CrazyEightsEngine.ts';
import { DEFAULT_CONFIG } from '../../../games/crazy-eights/src/lib/types/game.ts';
const e: any = new CrazyEightsEngine([{id:'a',name:'A'},{id:'b',name:'B'}],'R',DEFAULT_CONFIG);
const pid = e.players[e.activePlayerIndex].id;
for (const c of [undefined, null, {rank: {toString: 1}}, 'x']) { try { e.playCard(pid, c); } catch (err: any) { console.log(JSON.stringify(c), '->', err.message); } }
