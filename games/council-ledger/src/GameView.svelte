<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, Countdown, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { goal, maxRounds, permitIds, permits, type Permit } from './rules.js';
  import type { CouncilAction, CouncilView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: CouncilView; socket: GameSocket<'council-ledger'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let selected = $state<{ turn: number; permit: Permit }>();
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let proposing = $derived(view.phase === 'proposal' && active?.id === playerId);
  let selectedPermit = $derived(selected?.turn === view.turn ? selected.permit : undefined);
  let headline = $derived(view.phase === 'response' ? `${active?.name} claims ${view.claim ? permits[view.claim].label : ''}`
    : view.phase === 'reveal' ? view.outcome?.accepted ? 'Proposal accepted' : 'Bluff caught'
    : proposing ? 'Make a proposal' : `${active?.name} is proposing`);
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter(({ standing }) => standing > player.standing).length,
    detail: `${player.standing} standing`,
  })).sort((a, b) => a.place - b.place));

  async function send(action: CouncilAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!reply.ok) error = reply.message;
      else selected = undefined;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<CardBoard label="Council Ledger game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerIds.length > 1 ? 'Shared win!' : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner mine={proposing || view.canRespond} title={headline}
      detail={view.canRespond ? 'Challenge or stand. A wrong challenge costs one coin.' : `Round ${view.round} of ${maxRounds} · Goal ${goal} standing`} />
    <ul class="seats" aria-label="Council">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected} you={player.id === playerId}
          active={active?.id === player.id} stat={`${player.standing} standing · ${player.coins} coins${view.phase === 'response' && player.answered ? ' · Ready' : ''}`} /></li>
      {/each}
    </ul>
    <Felt label="Council table" tone="night">
      <div class="table">
        {#if proposing}
          <p>Your private permit is <strong>{view.myPermit ? permits[view.myPermit].label : ''}</strong>.</p>
          <div class="permits" role="group" aria-label="Permit claims">
            {#each permitIds as permit (permit)}
              <button type="button" class="permit" aria-pressed={selectedPermit === permit}
                disabled={pending || (active?.coins ?? 0) < permits[permit].cost} onclick={() => selected = { turn: view.turn, permit }}>
                <strong>{permits[permit].label}</strong><small>{permits[permit].detail}</small>
              </button>
            {/each}
          </div>
          <div class="actions">
            <Button shout disabled={!selectedPermit || pending} onclick={() => {
              if (selectedPermit) void send({ type: 'claim', turn: view.turn, permit: selectedPermit });
            }}>Claim permit</Button>
            <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'service', turn: view.turn })}>
              Public service · +1 coin, +1 standing
            </Button>
          </div>
        {:else if view.phase === 'response'}
          {#if view.deadline !== null}<p class="clock"><Countdown deadline={view.deadline} /></p>{/if}
          {#if view.claim}<p>{permits[view.claim].detail}</p>{/if}
          {#if view.canRespond}
            <div class="actions">
              <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'respond', turn: view.turn, challenge: false })}>Stand</Button>
              <Button shout disabled={pending} onclick={() => send({ type: 'respond', turn: view.turn, challenge: true })}>Challenge</Button>
            </div>
          {/if}
        {:else if view.outcome}
          {#if view.outcome.shown}<p>{active?.name} showed <strong>{permits[view.outcome.shown].label}</strong>.</p>{/if}
          <p>{view.outcome.challengerIds.length
            ? view.outcome.accepted ? 'Each challenger lost one coin.' : 'Each challenger gained one standing. The proposer lost up to one coin.'
            : view.claim ? permits[view.claim].detail : 'Public service earned one coin and one standing.'}</p>
        {:else}
          <p>Waiting for the next proposal.</p>
        {/if}
      </div>
    </Felt>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats, .actions, .permits { display: flex; justify-content: center; flex-wrap: wrap; gap: 7px; }
  .seats { list-style: none; padding: 0; margin: 0; }
  .table { width: 100%; display: grid; gap: 12px; }
  .table p { margin: 0; text-align: center; }
  .permit { display: grid; gap: 3px; min-height: 66px; padding: 8px; border: 2px solid var(--color-espresso);
    border-radius: 9px; background: var(--color-linen); color: var(--color-espresso); font: inherit; }
  .permit:not(:disabled) { cursor: pointer; }
  .permit[aria-pressed='true'] { outline: 3px solid var(--color-mustard); }
  .permit:focus-visible { outline: 3px solid var(--color-paper); outline-offset: 2px; }
  .clock { font: 900 1.5rem var(--font-heading); font-variant-numeric: tabular-nums; }
</style>
