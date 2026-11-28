<script lang="ts">
  import { onMount } from 'svelte';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import type { WordSplitAction, WordSplitView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: WordSplitView; socket: GameSocket<'word-split'>; playerId: string; isHost: boolean;
  } = $props();

  let draft = $state<{ deadline: number; text: string }>();
  let word = $derived(draft?.deadline === view.deadline ? draft.text : '');
  let pending = $state(false);
  let feedback = $state<{ deadline: number; message: string }>();
  let error = $derived(feedback?.deadline === view.deadline ? feedback.message : '');
  let now = $state(Date.now());
  let localDeadline = $derived(Date.now() + view.deadline - view.serverNow);
  let seconds = $derived(Math.max(0, Math.ceil((localDeadline - now) / 1000)));
  let writing = $derived(view.canWrite && seconds > 0);
  let names = $derived(new Map(view.players.map(({ id, name }) => [id, id === playerId ? 'You' : name])));
  let standings = $derived(view.players.map((player, seat) => {
    const place = 1 + view.players.filter((other) => other.score > player.score).length;
    return { ...player, seat, place, detail: `${player.score} pts`, winner: place === 1, you: player.id === playerId };
  }).sort((a, b) => a.place - b.place));

  onMount(() => {
    const timer = setInterval(() => { now = Date.now(); }, 250);
    return () => clearInterval(timer);
  });

  async function send(action: WordSplitAction) {
    if (pending) return;
    const { deadline } = view;
    pending = true;
    feedback = undefined;
    try {
      const result = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!result.ok) feedback = { deadline, message: result.message };
      else if (action.type === 'submit' && draft?.deadline === deadline && draft.text === action.word) draft = undefined;
    } catch {
      feedback = { deadline, message: 'The table did not respond. Try again.' };
    } finally {
      pending = false;
    }
  }

  function addWord(event: SubmitEvent) {
    event.preventDefault();
    if (writing && /^[a-z]{3,8}$/i.test(word.trim())) {
      void send({ type: 'submit', round: view.round, word: word.trim() });
    }
  }
</script>

<CardBoard label="Word Split game">
  {#if view.phase === 'game-over'}
    <GameOver
      headline={standings[1]?.winner ? 'Shared win!' : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings}
      onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined}
    />
  {:else}
    <TurnBanner mine={writing}
      title={view.phase === 'reveal' ? `Round ${view.round} results` : `Round ${view.round} of ${view.totalRounds}`}
      detail={view.phase === 'reveal' ? 'Words found by multiple players cancel out.'
        : writing ? 'Make words with the shared letters.'
        : 'Waiting for the round to end.'} />
    <ul class="seats" aria-label="Scores">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} you={player.id === playerId} connected={player.connected}
          stat={`${player.score} pts${view.phase === 'writing' && player.ready ? ' · Ready' : ''}`} /></li>
      {/each}
    </ul>
    <Felt label="Shared letter tiles">
      <div class="rack">
        <span class="clock" role="timer" aria-label={view.phase === 'writing' ? 'Round time remaining' : 'Time to next round'}>{seconds}s</span>
        <ul class="tiles" aria-label="Available letters">
          {#each view.letters as letter, index (index)}
            <li>{letter}</li>
          {/each}
        </ul>
      </div>
    </Felt>
  {/if}

  {#if view.phase !== 'writing'}
    <section aria-label="Round results" class="results">
      <h2>Round {view.round} words</h2>
      {#if view.results.length}
        <ul>
          {#each view.results as result (result.word)}
            <li><strong>{result.word}</strong><span>{result.playerIds.map((id) => names.get(id)).join(', ')}</span>
              <span>{result.points ? `+${result.points}` : 'Shared · 0'}</span></li>
          {/each}
        </ul>
      {:else}
        <p>No words submitted.</p>
      {/if}
    </section>
  {:else}
    {#key view.round}
      {#if writing}
        <form onsubmit={addWord} class="entry">
          <label for="word-split-entry">Your word</label>
          <div class="entry-row">
            <input id="word-split-entry" bind:value={() => word, (value) => { draft = { deadline: view.deadline, text: value }; }} minlength="3" maxlength="8" pattern={'[A-Za-z]{3,8}'}
              autocapitalize="none" autocomplete="off" spellcheck={false} required />
            <button type="submit" disabled={pending}>Add word</button>
          </div>
        </form>
        <div class="finish">
          <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'finish', round: view.round })}>Finish round</Button>
        </div>
      {/if}
      {#if error}<p role="alert">{error}</p>{/if}
      {#if view.myWords.length}
        <section aria-label="Your submitted words" class="found">
          <h2>Your words · {view.myWords.length}</h2>
          <ul>
            {#each view.myWords as found (found)}
              <li>{found}</li>
            {/each}
          </ul>
        </section>
      {/if}
    {/key}
  {/if}
</CardBoard>

<style>
  ul { margin: 0; padding: 0; list-style: none; }
  .seats, .found ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .rack { display: grid; justify-items: center; gap: 14px; width: 100%; }
  .clock { font-weight: 800; font-variant-numeric: tabular-nums; }
  .tiles { display: grid; width: min(100%, 25rem); grid-template-columns: repeat(8, minmax(0, 1fr)); gap: clamp(4px, 1.3vw, 8px); }
  .tiles li {
    display: grid;
    aspect-ratio: 1;
    place-items: center;
    border: 2px solid var(--color-espresso);
    border-radius: 8px;
    background: var(--color-espresso);
    color: var(--color-cream);
    box-shadow: 0 3px 0 rgb(0 0 0 / 35%);
    font: 900 clamp(1.1rem, 4vw, 1.6rem) var(--font-heading);
    text-transform: uppercase;
  }
  .entry, .results, .found { width: min(100%, 34rem); margin: 0 auto; }
  .entry label { display: block; margin-bottom: 6px; font-weight: 700; }
  .entry-row { display: flex; gap: 8px; }
  input, button { min-height: 46px; border: 2px solid var(--color-espresso); font: inherit; }
  input { flex: 1; min-width: 0; border-radius: 10px; padding: 0 10px; }
  button { border-radius: 999px; padding: 0 16px; background: var(--color-espresso); color: var(--color-cream); font-weight: 800; }
  button:disabled { opacity: 0.6; }
  .finish { text-align: center; }
  h2 { margin: 0 0 8px; font: 900 1.15rem var(--font-heading); }
  .found ul { justify-content: flex-start; }
  .found li { background: var(--color-linen); border-radius: 999px; padding: 4px 12px; }
  .results li { display: grid; grid-template-columns: minmax(5.5rem, 1fr) 1.3fr auto; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--color-linen); }
  .results li span { overflow-wrap: anywhere; }
</style>
