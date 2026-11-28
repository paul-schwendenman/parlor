import {
  createTurnDriver, defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { SkullEngine } from './engine.js';
import { skullMeta } from './meta.js';
import { isDisc } from './rules.js';
import type { SkullAction } from './types.js';

const drive = createTurnDriver<SkullEngine>('skull-step', 800, (state) => state.revealing ? state.revealDelay : undefined);

function act(game: PlayerContext<SkullEngine>, action: SkullAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<SkullEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const isAmount = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64;

const game: TypedGameDefinition<'skull', SkullEngine> = {
  meta: skullMeta,
  createState: (_room, players) => new SkullEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<SkullAction>(action, {
    ante: (input) => hasExactKeys(input, ['type', 'disc']) && isDisc(input.disc)
      ? valid({ type: 'ante', disc: input.disc }) : invalid('Choose a disc.'),
    place: (input) => hasExactKeys(input, ['type', 'disc']) && isDisc(input.disc)
      ? valid({ type: 'place', disc: input.disc }) : invalid('Choose a disc.'),
    open: (input) => hasExactKeys(input, ['type', 'amount']) && isAmount(input.amount, 24) && input.amount >= 1
      ? valid({ type: 'open', amount: input.amount }) : invalid('Choose a bid.'),
    raise: (input) => hasExactKeys(input, ['type', 'amount']) && isAmount(input.amount, 24) && input.amount >= 1
      ? valid({ type: 'raise', amount: input.amount }) : invalid('Choose a bid.'),
    pass: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'pass' }) : invalid('Invalid pass.'),
    flip: (input) => hasExactKeys(input, ['type', 'targetId']) && isId(input.targetId)
      ? valid({ type: 'flip', targetId: input.targetId }) : invalid('Choose a mat.'),
    'lose-disc': (input) => hasExactKeys(input, ['type', 'index']) && isAmount(input.index, 3)
      ? valid({ type: 'lose-disc', index: input.index }) : invalid('Pick a disc.'),
    'choose-starter': (input) => hasExactKeys(input, ['type', 'playerId']) && isId(input.playerId)
      ? valid({ type: 'choose-starter', playerId: input.playerId }) : invalid('Choose a player.'),
  }),
  actions: { ante: act, place: act, open: act, raise: act, pass: act, flip: act, 'lose-disc': act, 'choose-starter': act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.currentPhase === 'game-over',
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const skullDefinition = defineGame(game);
