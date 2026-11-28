<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CardGrid, DiscardPile, DrawPile, Felt, GameOver, PlayingCard, SeatChip, TurnBanner } from '@parlor/ui';
  import { COLUMN_COUNT, columnScore } from './rules.js';
  import type { GolfAction, GolfView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: GolfView; socket: GameSocket<'golf'>; playerId: string; isHost: boolean;
  } = $props();

  let choice = $state<{ hole: number; source: 'discard' | 'stock'; slot?: number }>();
  let pending = $state(false);
  let error = $state('');
  let me = $derived(view.players.find((player) => player.id === playerId));
  let active = $derived(view.players.find((player) => player.id === view.activePlayerId));
  let acting = $derived(active?.id === playerId);
  let taken = $derived(view.canTakeDiscard && choice?.hole === view.hole && choice.source === 'discard');
  let swapping = $derived(taken || view.canDiscardDrawn);
  let selected = $derived(swapping && choice?.hole === view.hole && choice.source === (taken ? 'discard' : 'stock') ? choice.slot : undefined);
  let targets = $derived(!pending && (swapping || view.setupFlipsLeft || (acting && view.phase === 'flip')) ? view.targetSlots : []);
  let title = $derived(view.phase === 'setup' ? 'Turn two cards face up'
    : view.phase === 'hole-scoring' ? `Hole ${view.hole} complete`
    : acting ? 'Your turn' : `${active?.name}’s turn`);
  let detail = $derived(view.phase === 'setup' ? view.setupFlipsLeft
    ? `${view.setupFlipsLeft} left to turn over.` : 'Waiting for the other players.'
    : selected !== undefined ? me?.grid[selected] === null && me.grid.filter((card) => card === null).length === 1
      ? 'Tap again to turn your last card and end the hole.'
      : 'Tap the same slot again to swap.'
    : swapping ? 'Choose a slot for the card.'
    : acting && view.phase === 'flip' ? 'Turn over one of your face-down cards.'
    : acting ? 'Draw from the stock or take the discard.' : undefined);
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter((other) => other.total < player.total).length,
    detail: `${player.total} points · ${view.holes} holes`,
  })).sort((a, b) => a.place - b.place));

  async function send(action: GolfAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const result = await socket.timeout(5000).emitWithAck('game:action', action);
      if (result.ok) choice = undefined;
      else error = result.message;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function pick(slot: number) {
    if (view.phase === 'setup') return send({ type: 'reveal', slot });
    if (view.phase === 'flip') return send({ type: 'flip', slot });
    if (!swapping) return;
    if (selected === slot) return send({ type: taken ? 'take-discard' : 'swap-drawn', slot });
    choice = { hole: view.hole, source: taken ? 'discard' : 'stock', slot };
  }

  function captions(grid: GolfView['players'][number]['grid']) {
    return Array.from({ length: COLUMN_COUNT }, (_, column) => {
      const top = grid[column];
      const bottom = grid[column + COLUMN_COUNT];
      return top && bottom ? columnScore(top, bottom) : '';
    });
  }
</script>

<CardBoard label="Golf game">
  {#if view.phase === 'game-over'}
    <GameOver
      headline={view.winnerIds.length > 1 ? 'Shared win!' : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings}
      onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined}
    />
  {:else}
    <TurnBanner mine={acting || view.setupFlipsLeft > 0} title={`${title} · ${view.hole}/${view.holes}`} {detail} />
    <div class="course">
      <ul class="opponents" aria-label="Other grids">
        {#each view.players as player, seat (player.id)}
          {#if player.id !== playerId}
            <li>
              <SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected}
                active={player.id === view.activePlayerId} stat={`${player.total} total`} />
              <CardGrid cards={player.grid} columns={COLUMN_COUNT} label={`${player.name}’s grid`} captions={captions(player.grid)} />
            </li>
          {/if}
        {/each}
      </ul>
      <div class="play">
        <Felt label="Card piles">
          <div class="piles">
            <div><DrawPile count={view.stockCount} canDraw={view.canDrawStock && !pending} ondraw={() => send({ type: 'draw-stock' })} /><span>Stock</span></div>
            <div><DiscardPile card={view.discardTop} canTake={view.canTakeDiscard && !pending}
              selected={taken} onpick={() => choice = taken ? undefined : { hole: view.hole, source: 'discard' }} /><span>Discard</span></div>
            {#if view.drawn}
              <div><PlayingCard rank={view.drawn.rank} suit={view.drawn.suit} /><span>Drawn</span></div>
            {/if}
          </div>
        </Felt>
        {#if me}
          <section class="own" aria-label="Your cards">
            <CardGrid cards={me.grid} columns={COLUMN_COUNT} label="Your grid" {targets} {selected} captions={captions(me.grid)} onpick={pick} />
            <p>Showing {me.showing} · Total {me.total}</p>
            {#if view.canDiscardDrawn}
              <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'discard-drawn' })}>Discard drawn card</Button>
            {/if}
          </section>
        {/if}
      </div>
      {#if view.players[0].holeScores.length}
        <div class="scores">
          <table>
            <caption>Scorecard</caption>
            <thead><tr><th scope="col">Hole</th>{#each view.players as player (player.id)}<th scope="col">{player.name}</th>{/each}</tr></thead>
            <tbody>
              {#each view.players[0].holeScores as _, hole (hole)}
                <tr><th scope="row">{hole + 1}</th>{#each view.players as player (player.id)}<td>{player.holeScores[hole]}</td>{/each}</tr>
              {/each}
            </tbody>
            <tfoot><tr><th scope="row">Total</th>{#each view.players as player (player.id)}
              <td class:leading={standings[0].total === player.total}>{player.total}</td>
            {/each}</tr></tfoot>
          </table>
        </div>
      {/if}
    </div>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .course { display: grid; gap: 14px; min-width: 0; --card-back: var(--color-forest-deep); }
  .opponents { display: flex; gap: 8px; overflow-x: auto; margin: 0; padding: 0 0 6px; list-style: none; }
  .opponents li { display: grid; gap: 8px; min-width: max-content; padding: 8px;
    border-radius: 10px; background: var(--color-linen); --card-w: 32px; --card-grid-gap: 4px; }
  .play { display: grid; gap: 14px; }
  .piles { display: flex; width: 100%; gap: 18px; justify-content: center; --card-w: 50px; }
  .piles div { display: grid; gap: 8px; justify-items: center; text-align: center; }
  .piles span { font-weight: 800; }
  .own { display: grid; gap: 8px; justify-items: center; --card-w: clamp(50px, 16vw, 72px); }
  .own p { margin: 0; font-weight: 700; }
  .scores { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; text-align: center; font-variant-numeric: tabular-nums; }
  caption { font: 900 1.1rem var(--font-heading); text-align: left; }
  th, td { padding: 5px 8px; border-bottom: 1px solid var(--color-linen); }
  tfoot { font-weight: 900; }
  .leading { background: var(--color-mustard-tint); }
  @media (min-width: 720px) {
    .course:has(.scores) { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
    .opponents { grid-column: 1 / -1; }
  }
</style>
