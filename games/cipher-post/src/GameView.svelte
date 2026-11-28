<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { faces, rounds, type Face } from './rules.js';
  import type { CipherAction, CipherView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: CipherView; socket: GameSocket<'cipher-post'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let selection = $state<{ round: number; phase: CipherView['phase']; sealId?: number; target?: string; face?: Face }>();
  let choice = $derived(selection?.round === view.round && selection?.phase === view.phase ? selection : undefined);
  let me = $derived(view.players.find(({ id }) => id === playerId));
  let mine = $derived(!!me && !me.ready && view.phase !== 'reveal' && view.phase !== 'game-over');
  let recipient = $derived(view.players.find(({ id }) => id === (view.sent?.to ?? view.sentTo)));
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter(({ score }) => score > player.score).length, detail: `${player.score} points`,
  })).sort((a, b) => a.place - b.place));

  function select(values: { sealId?: number; target?: string; face?: Face }) {
    selection = { ...choice, ...values, round: view.round, phase: view.phase };
  }

  async function send(action: CipherAction) {
    if (!mine || pending) return;
    pending = true;
    error = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!reply.ok) error = reply.message;
      else selection = undefined;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<CardBoard label="Cipher Post game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerIds.length > 1 ? 'Shared win!' : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine} title={view.phase === 'reveal' ? 'Seals opened' : !mine ? 'Waiting for the table'
      : view.phase === 'pass' ? 'Pass a seal' : view.phase === 'expose' ? 'Expose a clue' : 'Guess a sealed value'}
      detail={`Round ${view.round} of ${rounds}`} />
    <ul class="seats" aria-label="Scores">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected} you={player.id === playerId}
          stat={`${player.score} pts${player.ready ? ' · Ready' : ''}`} /></li>
      {/each}
    </ul>
    <Felt label="Cipher table" tone="night">
      <div class="table">
        {#if view.phase === 'pass' || view.phase === 'expose'}
          {#if view.hand.length}
            <p>{view.phase === 'pass' ? `Send to ${recipient?.name}.` : 'Reveal one value to everyone. Keep the other sealed.'}</p>
            <div class="options" role="group" aria-label="Your seals">
              {#each view.hand as seal (seal.id)}
                <button type="button" class="seal" aria-pressed={(choice?.sealId ?? view.choice) === seal.id}
                  disabled={!mine || pending} onclick={() => select({ sealId: seal.id })}>Seal {seal.face}</button>
              {/each}
            </div>
            {#if mine}
              <div class="options">
                <Button shout disabled={choice?.sealId === undefined || pending} onclick={() => {
                  if (choice?.sealId !== undefined && (view.phase === 'pass' || view.phase === 'expose')) {
                    void send({ type: view.phase, round: view.round, sealId: choice.sealId });
                  }
                }}>{view.phase === 'pass' ? 'Send seal' : 'Expose seal'}</Button>
              </div>
            {/if}
          {:else}
            <p>Choices stay private until everyone is ready.</p>
          {/if}
        {:else if view.phase === 'guess'}
          {#if view.sent}<p>You sent <strong>{view.sent.face}</strong> to {recipient?.name}.</p>{/if}
          {#if view.hand.length}<p>Your sealed value is <strong>{view.hand[0].face}</strong>.</p>{/if}
          <div class="options clues" role="group" aria-label="Exposed clues">
            {#each view.players as player (player.id)}
              <button type="button" class="seal" aria-pressed={(choice?.target ?? view.myGuess?.target) === player.id}
                disabled={player.id === playerId || !mine || pending} onclick={() => select({ target: player.id })}>
                <strong>{player.name}</strong> · {player.exposed}
              </button>
            {/each}
          </div>
          {#if mine}
            <div class="options" role="group" aria-label="Guess value">
              {#each faces as face (face)}
                <Button variant="secondary" pressed={choice?.face === face} disabled={pending} onclick={() => select({ face })}>{face}</Button>
              {/each}
            </div>
            <div class="options">
              <Button shout disabled={!choice?.target || !choice.face || pending} onclick={() => {
                if (choice?.target && choice.face) void send({ type: 'guess', round: view.round, target: choice.target, face: choice.face });
              }}>Lock guess</Button>
            </div>
          {/if}
        {:else if view.phase === 'reveal'}
          <ul class="results">
            {#each view.results as result (result.id)}
              {@const player = view.players.find(({ id }) => id === result.id)}
              {@const rival = view.players.find(({ id }) => id === result.guess.target)}
              <li><strong>{player?.name} · +{result.points}</strong>
                <span>Sealed {result.sealed}{result.guessed ? ' · Found' : ' · Safe'}</span>
                <span>Guessed {rival?.name} held {result.guess.face} · {result.right ? 'Correct' : 'Missed'}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </Felt>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats, .options { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px; }
  .seats, .results { list-style: none; margin: 0; padding: 0; }
  .table { display: grid; gap: 12px; width: 100%; }
  .table p { margin: 0; text-align: center; }
  .seal { min-height: 50px; min-width: 78px; padding: 8px; border: 2px solid var(--color-espresso);
    border-radius: 10px; background: var(--color-linen); color: var(--color-espresso); font: 900 1rem var(--font-heading); }
  .seal:not(:disabled) { cursor: pointer; }
  .seal[aria-pressed='true'] { outline: 3px solid var(--color-mustard); }
  .seal:focus-visible { outline: 3px solid var(--color-paper); outline-offset: 2px; }
  .results { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap: 7px; }
  .results li { display: grid; gap: 4px; border-radius: 8px; padding: 8px; background: var(--color-linen); color: var(--color-espresso); }
</style>
