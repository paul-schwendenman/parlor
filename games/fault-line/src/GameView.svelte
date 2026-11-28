<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { cacheName, cacheSupply, maxBounty, type Cache } from './rules.js';
  import type { FaultAction, FaultView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: FaultView; socket: GameSocket<'fault-line'>; playerId: string; isHost: boolean;
  } = $props();

  let choice = $state<{ round: number; cache?: Cache; bounty: number; target?: string }>();
  let pending = $state(false);
  let error = $state('');
  let me = $derived(view.players.find(({ id }) => id === playerId));
  let mine = $derived(!!me && !me.ready && (view.phase === 'plant' || view.phase === 'open'));
  let current = $derived(choice?.round === view.round ? choice : undefined);
  let bounty = $derived(current?.bounty ?? 0);
  let options = $derived([...new Set(view.myHand)]);
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter(({ score }) => score > player.score).length, detail: `${player.score} points`,
  })).sort((a, b) => a.place - b.place));

  async function send(action: FaultAction) {
    if (!mine || pending) return;
    pending = true;
    error = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!reply.ok) error = reply.message;
      else choice = undefined;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function choose(cache: Cache) {
    choice = { ...current, round: view.round, bounty, cache };
  }

  function setBounty(next: number) {
    choice = { ...current, round: view.round, bounty: next };
  }
</script>

<CardBoard label="Fault Line game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerIds.length > 1 ? 'Shared win!' : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine} title={view.phase === 'reveal' ? 'Caches revealed' : !mine ? 'Waiting for the table'
      : view.phase === 'plant' ? 'Plant your cache' : 'Open a rival cache or pass'} detail={`Round ${view.round} of ${cacheSupply.length}`} />
    <ul class="seats" aria-label="Scores">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected}
          you={player.id === playerId} stat={`${player.score} pts${player.ready ? ' · Ready' : ''}`} /></li>
      {/each}
    </ul>
    <Felt label="Dig site" tone="night">
      <div class="site">
        {#if view.phase === 'plant' && mine && me}
          <div class="tokens" role="group" aria-label="Your caches">
            {#each options as cache (cache)}
              <button type="button" class="token" data-cache={cache} aria-pressed={current?.cache === cache}
                disabled={pending} onclick={() => choose(cache)}>
                <strong>{cacheName[cache]}</strong>
                <small>{view.myHand.filter((value) => value === cache).length} left</small>
              </button>
            {/each}
          </div>
          <div class="actions" role="group" aria-label="Bounty">
            <span>{me.chips} bounty chips</span>
            {#each Array.from({ length: Math.min(maxBounty, me.chips) + 1 }, (_, i) => i) as amount (amount)}
              <Button variant="secondary" pressed={bounty === amount} disabled={pending} onclick={() => setBounty(amount)}>
                {amount} offered
              </Button>
            {/each}
          </div>
          <div class="actions">
            <Button shout disabled={current?.cache === undefined || pending} onclick={() => {
              if (current?.cache !== undefined) void send({ type: 'plant', cache: current.cache, bounty, round: view.round });
            }}>Plant cache</Button>
          </div>
        {:else if view.phase === 'open'}
          <div class="tokens" role="group" aria-label="Rival caches">
            {#each view.players.filter(({ id }) => id !== playerId) as player (player.id)}
              <button type="button" class="token" aria-pressed={current?.target === player.id}
                disabled={!mine || pending} onclick={() => choice = { round: view.round, bounty, target: player.id }}>
                <strong>{player.name}</strong><small>{player.bounty} bounty</small>
              </button>
            {/each}
          </div>
          {#if mine}
            <div class="actions">
              <Button shout disabled={!current?.target || pending} onclick={() => {
                if (current?.target) void send({ type: 'open', round: view.round, target: current.target });
              }}>Open cache</Button>
              <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'open', round: view.round, target: null })}>Pass</Button>
            </div>
          {/if}
        {:else if view.phase === 'reveal'}
          <ul class="results">
            {#each view.last as entry (entry.id)}
              <li><strong>{view.players.find(({ id }) => id === entry.id)?.name}</strong>
                <span>{cacheName[entry.cache]}{entry.target ? ` · Opened ${view.players.find(({ id }) => id === entry.target)?.name}’s cache` : ''}</span>
                <strong>{entry.points >= 0 ? '+' : ''}{entry.points}</strong></li>
            {/each}
          </ul>
        {:else if view.myCache !== null}
          <p>Your {cacheName[view.myCache].toLowerCase()} cache is planted.</p>
        {:else}
          <p>Players are planting caches.</p>
        {/if}
      </div>
    </Felt>
    {#if view.round > 1 && view.phase !== 'reveal'}
      <ul class="history" aria-label="Past caches">
        {#each view.players as player (player.id)}
          <li><strong>{player.name}</strong><span>{player.history.map((cache) => cacheName[cache]).join(' · ')}</span></li>
        {/each}
      </ul>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats, .tokens, .actions { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; align-items: center; }
  .site { width: 100%; display: grid; gap: 12px; }
  .site p { margin: 0; text-align: center; }
  .seats, .history, .results { margin: 0; padding: 0; list-style: none; }
  .token { display: grid; gap: 4px; min-height: 64px; min-width: 76px; max-width: 150px;
    border: 2px solid var(--color-espresso); border-radius: 16px; padding: 6px;
    background: var(--cache, var(--color-linen)); color: var(--color-espresso); font: inherit; overflow-wrap: anywhere; }
  .token:not(:disabled) { cursor: pointer; }
  .token[aria-pressed='true'] { outline: 3px solid var(--color-mustard); }
  .token:focus-visible { outline: 3px solid var(--color-paper); outline-offset: 2px; }
  [data-cache='0'] { --cache: #e6b0ab; }
  [data-cache='1'] { --cache: #d9dfed; }
  [data-cache='2'] { --cache: #f9df9e; }
  .history, .results { display: grid; gap: 6px; }
  .history li, .results li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; padding: 6px; }
  .history li { background: var(--color-linen); border-radius: 6px; }
</style>
