<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, DiceTray, Felt, GameOver, RollStopBar, SeatChip, TurnBanner, seatTone } from '@parlor/ui';
  import { DICE_COUNT, FINISH_SCORE, routes } from './rules.js';
  import type { RidgeAction, RidgeView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: RidgeView; socket: GameSocket<'ridge-run'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let mine = $derived(active?.id === playerId && (view.phase === 'ready' || view.phase === 'choose'));
  let climbing = $derived(Object.keys(view.climb).length > 0);
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerId === player.id,
    place: 1 + view.players.filter(({ points }) => points > player.points).length,
    detail: `${player.points} summit points`,
  })).sort((a, b) => a.place - b.place));

  async function send(action: RidgeAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!reply.ok) error = reply.message;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<CardBoard label="Ridge Run game">
  {#if view.winnerId}
    <GameOver headline={standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine}
      title={view.phase === 'bust' ? `${active?.name} slipped` : view.phase === 'camped'
        ? view.lastPoints ? `${active?.name} banked ${view.lastPoints} summit points` : `${active?.name} made camp`
        : mine ? 'Your turn' : `${active?.name}’s turn`}
      detail={view.phase === 'bust' ? 'Unbanked steps are lost.' : mine
        ? view.phase === 'choose' ? 'Choose one route from this roll.' : climbing ? 'Roll again or camp to bank your steps.' : 'Roll three dice.'
        : undefined} />
    <ul class="seats" aria-label={`Scores, first to ${FINISH_SCORE}`}>
      {#each view.players as player, seat (player.id)}
        <li><i class={seatTone(seat)} aria-hidden="true"></i><SeatChip name={player.name} {seat} bot={player.bot}
          you={player.id === playerId} connected={player.connected} active={player.id === active?.id}
          stat={`${player.points}/${FINISH_SCORE} pts`} /></li>
      {/each}
    </ul>
    <div class="table">
      <section class="ridge" aria-label="Mountain routes">
        {#each routes as { sum, height } (sum)}
          {@const first = view.players.find(({ id }) => id === view.firstSummits[sum])}
          <div class="route">
            <div class="slope" class:claimed={!!first}>
              {#each Array.from({ length: height }, (_, i) => height - i) as step (step)}
                <div class="step">
                  {#each view.players as player, seat (player.id)}
                    {#if player.progress[sum] === step}
                      <i class={seatTone(seat)} role="img" aria-label={`${player.name}, step ${step} on route ${sum}`}></i>
                    {/if}
                  {/each}
                  {#if active && view.climb[sum] && (active.progress[sum] ?? 0) + view.climb[sum] === step}
                    <i class="unbanked" role="img" aria-label={`Unbanked step ${step} on route ${sum}`}></i>
                  {/if}
                </div>
              {/each}
            </div>
            <strong title={first ? `${first.name} reached this summit first` : 'First summit available'}>{sum}</strong>
          </div>
        {/each}
      </section>
      <Felt label="Dice table">
        <div class="controls">
          <DiceTray dice={view.dice} count={DICE_COUNT} rollId={view.rollId} />
          {#if mine && view.phase === 'choose'}
            <div class="choices" aria-label="Available routes">
              {#each view.moves as move (move.route)}
                <Button shout disabled={pending} onclick={() => send({ type: 'climb', route: move.route })}>
                  Route {move.route} · +{move.steps}
                </Button>
              {/each}
            </div>
          {:else if mine}
            <RollStopBar rollLabel="Roll dice" stopLabel="Make camp" canRoll={!pending} canStop={!pending && climbing}
              onroll={() => send({ type: 'roll' })} onstop={() => send({ type: 'camp' })} />
          {/if}
        </div>
      </Felt>
    </div>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .table { display: grid; gap: 12px; min-width: 0; }
  .seats { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; list-style: none; padding: 0; margin: 0; }
  .seats li { display: flex; gap: 4px; align-items: center; }
  i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
  .clay { background: var(--color-clay, #aa573d); }
  .felt { background: var(--color-forest-deep, #2f5a3e); }
  .mustard { background: var(--color-mustard, #d4a843); outline: 1px solid var(--color-espresso); }
  .ink { background: var(--color-espresso, #3b2f2f); }
  .ridge { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); gap: 3px; padding: 12px 6px 6px;
    border-radius: 14px; background: var(--color-linen); }
  .route { display: grid; align-content: end; text-align: center; gap: 4px; }
  .slope { display: grid; gap: 2px; }
  .step { border-radius: 3px; background: var(--color-cream); min-height: 20px;
    display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: 2px; }
  .claimed .step:first-child { background: var(--color-mustard-tint); }
  .unbanked { border: 1px dashed var(--color-espresso); background: var(--color-paper); box-sizing: border-box; }
  .controls { width: 100%; display: grid; gap: 14px; justify-items: center; --die-size: 48px; }
  .choices { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
</style>
