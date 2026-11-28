<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { displayScore, goods, picksPerSeason, seasons, type Pick } from './rules.js';
  import type { MarketView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: MarketView; socket: GameSocket<'night-market'>; playerId: string; isHost: boolean;
  } = $props();

  let choice = $state<{ id: number; season: number; pickNumber: number }>();
  let pending = $state(false);
  let error = $state('');
  let me = $derived(view.players.find(({ id }) => id === playerId));
  let mine = $derived(!!me && view.phase === 'draft' && !view.selection);
  let selected = $derived(choice?.season === view.season && choice.pickNumber === view.pickNumber
    ? view.hand.find(({ id }) => id === choice?.id) : undefined);
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter(({ total }) => total > player.total).length,
    detail: `${player.total} points`,
  })).sort((a, b) => a.place - b.place));

  async function submit(use: Pick['use']) {
    if (!selected || !mine || pending) return;
    pending = true;
    error = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', {
        type: 'pick', tileId: selected.id, use, season: view.season, pickNumber: view.pickNumber,
      });
      if (!reply.ok) error = reply.message;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<CardBoard label="Night Market game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerIds.length > 1 ? 'Shared win!' : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine} title={mine ? 'Choose a good' : view.phase === 'reveal' ? 'Goods revealed'
      : view.phase === 'season-end' ? 'Season scores' : 'Waiting for picks'}
      detail={`Season ${view.season}/${seasons} · Pick ${view.pickNumber}/${picksPerSeason}`} />
    <ul class="seats" aria-label="Players">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected}
          you={player.id === playerId} active={view.phase === 'draft' && !player.locked}
          stat={`${player.total} pts${player.locked ? ' · Ready' : ''}`} /></li>
      {/each}
    </ul>
    <Felt label="Market table" tone="night">
      <div class="market">
        {#if view.phase === 'draft' && me}
          <div class="goods" role="group" aria-label="Your goods">
            {#each view.hand as tile (tile.id)}
              <button type="button" class="tile" data-good={tile.good} aria-pressed={selected?.id === tile.id}
                disabled={!mine || pending} onclick={() => choice = { id: tile.id, season: view.season, pickNumber: view.pickNumber }}>
                <strong>{goods[tile.good].label}</strong>
                <small>{goods[tile.good].detail}</small>
                <span>{goods[tile.good].sale} coins</span>
              </button>
            {/each}
          </div>
          {#if mine}
            <div class="actions">
              <Button shout disabled={!selected || pending} onclick={() => submit('display')}>Display</Button>
              <Button variant="secondary" disabled={!selected || pending} onclick={() => submit('sell')}>
                {selected ? `Sell for ${goods[selected.good].sale}` : 'Sell'}
              </Button>
            </div>
          {:else if view.selection}
            <p>Pick locked · {view.selection.use === 'sell' ? 'Sell' : 'Display'} {goods[view.hand.find(({ id }) => id === view.selection?.tileId)!.good].label}</p>
          {/if}
        {:else if view.phase === 'reveal'}
          <ul class="results">
            {#each view.revealed as { playerId: id, tile, use } (id)}
              <li><strong>{view.players.find((player) => player.id === id)?.name}</strong>
                <span>{use === 'sell' ? 'Sold' : 'Displayed'} {goods[tile.good].label}</span></li>
            {/each}
          </ul>
        {:else if view.phase === 'season-end'}
          <ul class="results">
            {#each [...view.players].sort((a, b) => b.seasonScores[view.season - 1] - a.seasonScores[view.season - 1]) as player (player.id)}
              <li><strong>{player.name}</strong><span>{player.coins} coins + {displayScore(player.stall)} stall</span></li>
            {/each}
          </ul>
        {:else}
          <p>Picks are revealed when everyone is ready.</p>
        {/if}
      </div>
    </Felt>
    <ul class="stalls" aria-label="Stalls">
      {#each view.players as player (player.id)}
        <li>
          <strong>{player.id === playerId ? 'Your stall' : `${player.name}’s stall`}</strong>
          <span>{player.coins} coins · {displayScore(player.stall)} display pts</span>
          {#if player.stall.length}
            <div class="labels">
              {#each player.stall as tile (tile.id)}<span data-good={tile.good}>{goods[tile.good].label}</span>{/each}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats, .actions, .labels { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .market { width: 100%; display: grid; gap: 12px; }
  .market p { text-align: center; margin: 0; }
  .goods { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 92px), 1fr)); gap: 6px; }
  .tile { display: grid; gap: 2px; min-height: 87px; padding: 6px; border: 2px solid var(--color-espresso);
    border-radius: 11px; background: var(--good); color: var(--color-espresso); font: inherit; text-align: left; }
  .tile span { font-size: .78rem; font-weight: 800; }
  .tile:not(:disabled) { cursor: pointer; }
  .tile[aria-pressed='true'] { outline: 3px solid var(--color-mustard); }
  .tile:focus-visible { outline: 3px solid var(--color-paper); outline-offset: 2px; }
  [data-good='lantern'] { --good: #f9df9e; }
  [data-good='silk'] { --good: #eac7ce; }
  [data-good='tea'] { --good: #c4dfb7; }
  [data-good='pottery'] { --good: #d8d3eb; }
  [data-good='spice'] { --good: #f3c6a7; }
  .seats, .results, .stalls { list-style: none; margin: 0; padding: 0; }
  .results li { display: flex; justify-content: space-between; gap: 6px; padding: 6px 0; }
  .stalls { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 7px; }
  .stalls li { display: grid; align-content: start; gap: 3px; border-radius: 10px; padding: 8px; background: var(--color-linen); }
  .labels { justify-content: start; margin-top: 4px; }
  .labels span { padding: 2px 6px; border-radius: 6px; background: var(--good); font-size: .8rem; }
</style>
