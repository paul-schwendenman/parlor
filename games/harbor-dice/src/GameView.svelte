<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, DiceTray, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { categories, DICE_COUNT } from './rules.js';
  import type { HarborAction, HarborView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: HarborView; socket: GameSocket<'harbor-dice'>; playerId: string; isHost: boolean;
  } = $props();

  let selection = $state<{ round: number; indices: number[] }>();
  let pending = $state(false);
  let error = $state('');
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let mine = $derived(view.activePlayerId === playerId && view.phase === 'rolling');
  let held = $derived(mine && selection?.round === view.round ? selection.indices : []);
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter(({ total }) => total > player.total).length, detail: `${player.total} points`,
  })).sort((a, b) => a.place - b.place));

  function toggle(index: number) {
    selection = { round: view.round, indices: held.includes(index) ? held.filter((die) => die !== index) : [...held, index] };
  }

  async function send(action: HarborAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!reply.ok) error = reply.message;
      else if (action.type === 'score') selection = undefined;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<CardBoard label="Harbor Dice game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerIds.length > 1 ? 'Shared win!' : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine} title={view.lastScore ? `${active?.name} scored ${view.lastScore.points}` : mine ? 'Your turn' : `${active?.name}’s turn`}
      detail={view.lastScore ? categories.find(({ id }) => id === view.lastScore?.category)?.label
        : mine && view.dice.length ? view.rollsLeft ? 'Tap dice to hold them, or score an open category.' : 'Choose an open category.'
        : undefined} />
    <ul class="seats" aria-label="Scores">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected}
          you={player.id === playerId} active={player.id === active?.id} stat={`${player.total} pts`} /></li>
      {/each}
    </ul>
    <div class="board">
      <Felt label="Dice table" tone="night">
        <div class="dice">
          <p>Round {view.round} of {categories.length}</p>
          <DiceTray dice={view.dice} count={DICE_COUNT} rollId={view.rollId} selected={held}
            onpick={mine && view.dice.length && view.rollsLeft ? toggle : undefined} disabled={pending} />
          {#if mine}
            <Button shout disabled={pending || !view.rollsLeft || held.length === DICE_COUNT}
              onclick={() => send({ type: 'roll', held: [...held] })}>
              {view.dice.length ? `Reroll · ${view.rollsLeft} left` : 'Roll dice'}
            </Button>
          {/if}
        </div>
      </Felt>
      {#if active}
        <section class="scorecard" aria-label="Scorecard">
          <h3>{active.id === playerId ? 'Your scorecard' : `${active.name}’s scorecard`}</h3>
          <ul>
            {#each categories as category (category.id)}
              {@const value = active.scorecard[category.id]}
              {@const preview = view.preview[category.id]}
              <li>
                <span><strong>{category.label}</strong><small>{category.description}</small></span>
                {#if mine && preview !== undefined}
                  <Button variant="secondary" disabled={pending}
                    onclick={() => send({ type: 'score', category: category.id })}>Score {preview}</Button>
                {:else}
                  <strong class="points">{value ?? '–'}</strong>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .board { display: grid; gap: 12px; align-items: start; min-width: 0; }
  .dice { display: grid; width: 100%; justify-items: center; gap: 14px; --die-size: clamp(38px, 11vw, 58px); }
  .dice p { margin: 0; font-weight: 800; }
  .scorecard { background: var(--color-linen); border-radius: 14px; padding: 10px 14px; }
  .scorecard h3 { margin: 0 0 4px; font: 900 1.2rem var(--font-heading); }
  .scorecard ul { list-style: none; margin: 0; padding: 0; }
  .scorecard li { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--color-mustard-tint); padding: 7px 0; min-height: 38px; }
  .scorecard span { display: grid; gap: 2px; }
  .points { min-width: 36px; text-align: center; font-variant-numeric: tabular-nums; }
  @media (min-width: 720px) { .board { grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr); } }
</style>
