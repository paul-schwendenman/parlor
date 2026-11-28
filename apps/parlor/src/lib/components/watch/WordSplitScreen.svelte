<script lang="ts">
  import { onMount } from 'svelte';
  import type { GameView } from '@parlor/game-types';
  import SharedBoard from './SharedBoard.svelte';
  import SharedScores from './SharedScores.svelte';

  let { view }: { view: GameView<'word-split'> } = $props();
  let now = $state(Date.now());
  let localDeadline = $derived(Date.now() + view.deadline - view.serverNow);
  let seconds = $derived(Math.max(0, Math.ceil((localDeadline - now) / 1000)));
  let players = $derived([...view.players].sort((a, b) => b.score - a.score));
  let names = $derived(new Map(players.map(({ id, name }) => [id, name])));
  let winners = $derived(players.filter(({ score }) => score === players[0]?.score));
  let title = $derived(view.phase === 'game-over'
    ? winners.length === 1 ? `${winners[0].name} wins!` : 'Shared win!'
    : view.phase === 'writing' ? `Round ${view.round} of ${view.totalRounds}` : `Round ${view.round} reveal`);

  onMount(() => {
    const timer = setInterval(() => { now = Date.now(); }, 250);
    return () => clearInterval(timer);
  });
</script>

<SharedBoard {title} detail={view.phase === 'writing' ? 'Find words on your phone' : 'Shared words score zero'}>
  {#if view.phase === 'writing'}
    <ul class="tiles" aria-label="Shared letters">
      {#each view.letters as letter, index (index)}<li>{letter}</li>{/each}
    </ul>
    <p class="clock" role="timer" aria-label="Round time remaining">{seconds}s</p>
  {:else}
    {#if view.results.length}
      <ul class="words" aria-label="Revealed words">
        {#each view.results as result (result.word)}
          <li><strong>{result.word}</strong><span>{result.playerIds.map((id) => names.get(id)).join(', ')}</span><b>{result.points ? `+${result.points}` : '0'}</b></li>
        {/each}
      </ul>
    {:else}
      <p>No words submitted.</p>
    {/if}
    {#if view.phase === 'reveal'}<p role="timer" aria-label="Time to next round">Next round in {seconds}s</p>{/if}
  {/if}
  {#snippet sidebar()}
    <SharedScores rows={players.map((player) => ({ ...player, value: player.score, detail: view.phase === 'writing' ? player.ready ? 'Ready' : player.connected ? 'Finding words' : 'Away' : undefined }))} />
  {/snippet}
</SharedBoard>

<style>
  ul { margin: 0; padding: 0; list-style: none; }
  .tiles { display: grid; width: min(100%, 52rem); grid-template-columns: repeat(8, minmax(0, 1fr)); gap: clamp(4px, 1vw, 12px); }
  .tiles li { display: grid; place-items: center; aspect-ratio: 1; border: 2px solid var(--color-espresso); border-radius: 12px; background: var(--color-linen); color: var(--color-espresso); font: 900 clamp(1.15rem, 4vw, 4.5rem) var(--font-heading); text-transform: uppercase; }
  .clock { font: 900 clamp(2.4rem, 6vw, 6rem)/1 var(--font-heading); font-variant-numeric: tabular-nums; }
  .words { width: min(100%, 48rem); max-height: min(40vh, 27rem); overflow: auto; background: var(--color-cream); color: var(--color-espresso); border-radius: 12px; }
  .words li { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--color-linen); text-align: left; overflow-wrap: anywhere; font-size: clamp(1rem, 1.55vw, 1.5rem); }
  p { margin: 0; }
</style>
