<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, Countdown, Felt, SeatChip, TurnBanner } from '@parlor/ui';
  import { antennas, fits, levels } from './rules.js';
  import type { RelayAction, RelayView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: RelayView; socket: GameSocket<'signal-relay'>; playerId: string; isHost: boolean;
  } = $props();

  let choice = $state<{ id: number; level: number }>();
  let pending = $state(false);
  let error = $state('');
  let rerouting = $state(false);
  let selected = $derived(choice?.level === view.level ? view.hand.find(({ id }) => id === choice?.id) : undefined);
  let canReroute = $derived(view.rerouteAvailable && rerouting && !!selected);
  let me = $derived(view.players.find(({ id }) => id === playerId));

  async function send(antenna: RelayAction['antenna']) {
    if (!selected || pending) return;
    pending = true;
    error = '';
    try {
      const current = view.antennas[antenna];
      const action: RelayAction = {
        type: canReroute ? 'reroute' : 'send', level: view.level, signal: selected.id, antenna, version: current.version,
      };
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      if (reply.ok) {
        choice = undefined;
        rerouting = false;
      } else error = reply.message;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function pick(id: number) {
    choice = { id, level: view.level };
    rerouting = false;
  }
</script>

<CardBoard label="Signal Relay game">
  <TurnBanner mine={view.phase === 'playing' && view.hand.length > 0}
    title={view.phase === 'game-over' ? view.won ? 'Relay complete!' : 'Signal lost'
      : view.phase === 'clear' ? `Relay ${view.level} cleared` : `Relay ${view.level} of ${levels}`}
    detail={view.phase === 'game-over' ? view.won ? 'Your team cleared every relay.' : 'Time ran out before the team cleared its signals.'
      : view.phase === 'playing' && me ? selected ? 'Choose an antenna.' : view.hand.length ? 'Select a signal to send.' : 'Waiting for the rest of the team.'
      : undefined} />
  {#if view.phase === 'game-over'}
    {#if isHost}
      <div class="actions">
        <Button shout onclick={() => socket.emit('lobby:restartGame')}>Play again</Button>
        <Button variant="secondary" onclick={() => socket.emit('lobby:resetGame')}>Back to lobby</Button>
      </div>
    {/if}
  {:else}
    <ul class="seats" aria-label="Team">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected}
          you={player.id === playerId} stat={`${player.remaining} left`} /></li>
      {/each}
    </ul>
    <Felt label="Antennas" tone="night">
      <div class="console">
        {#if view.deadline !== null}
          <p class="clock"><Countdown deadline={view.deadline} /></p>
        {/if}
        <div class="antennas">
          {#each antennas as antenna (antenna)}
            {@const current = view.antennas[antenna].signal}
            <button type="button" class="signal" data-channel={current.channel}
              disabled={!selected || pending || view.phase !== 'playing' || (!canReroute && !fits(selected, current))}
              onclick={() => send(antenna)}>
              <small>Antenna {antenna + 1}</small><strong>{current.strength}</strong><span>{current.channel}</span>
            </button>
          {/each}
        </div>
        {#if view.last}
          <p>{view.players.find(({ id }) => id === view.last?.playerId)?.name}
            {view.last.rerouted ? 'rerouted' : 'sent'} {view.last.signal.channel} {view.last.signal.strength}</p>
        {/if}
      </div>
    </Felt>
    {#if view.phase === 'playing' && view.hand.length}
      <div class="hand" role="group" aria-label="Your signals">
        {#each view.hand as signal (signal.id)}
          <button type="button" class="signal" data-channel={signal.channel} aria-pressed={selected?.id === signal.id}
            onclick={() => pick(signal.id)} disabled={pending}>
            <strong>{signal.strength}</strong><span>{signal.channel}</span>
          </button>
        {/each}
      </div>
      {#if view.rerouteAvailable}
        <div class="actions">
          <Button variant="secondary" pressed={canReroute} disabled={!selected || pending}
            onclick={() => rerouting = !rerouting}>{canReroute ? 'Cancel reroute' : 'Use team reroute'}</Button>
        </div>
      {/if}
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats, .actions, .hand { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; }
  .seats { margin: 0; padding: 0; list-style: none; }
  .console { width: 100%; display: grid; gap: 8px; text-align: center; }
  .console p { margin: 0; }
  .clock { font: 900 1.5rem var(--font-heading); font-variant-numeric: tabular-nums; }
  .antennas { display: grid; grid-template-columns: repeat(2, minmax(0, 120px)); gap: 10px; justify-content: center; }
  .signal { display: grid; justify-items: center; gap: 2px; padding: 8px; border-radius: 11px;
    border: 2px solid var(--color-espresso); background: var(--channel); color: var(--color-espresso); font: inherit; }
  .signal:not(:disabled) { cursor: pointer; }
  .signal strong { font: 900 1.75rem/1 var(--font-heading); }
  .signal span { text-transform: capitalize; font-weight: 800; }
  .signal[aria-pressed='true'], .antennas .signal:not(:disabled) { outline: 3px solid var(--color-mustard); }
  .signal:focus-visible { outline: 3px solid var(--color-espresso); outline-offset: 2px; }
  .antennas .signal:focus-visible { outline-color: var(--color-paper); }
  [data-channel='amber'] { --channel: #f9dd9a; }
  [data-channel='blue'] { --channel: #c4dceb; }
  [data-channel='green'] { --channel: #c6debb; }
</style>
