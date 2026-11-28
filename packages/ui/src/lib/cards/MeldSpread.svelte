<script lang="ts">
  import type { Card } from '@parlor/cards';
  import PlayingCard from './PlayingCard.svelte';

  type Group = { kind: 'set' | 'run'; cards: Card[] };
  let { melds, deadwood = [], layoffs = [] }: {
    melds: readonly Group[];
    deadwood?: readonly Card[];
    layoffs?: readonly Card[];
  } = $props();
</script>

<div class="spread">
  {#each melds as meld, index (index)}
    {@render group(meld.kind === 'run' ? 'Run' : 'Set', meld.cards)}
  {/each}
  {#if layoffs.length}{@render group('Laid off', layoffs, true)}{/if}
  {#if deadwood.length}{@render group('Deadwood', deadwood)}{/if}
</div>

{#snippet group(label: string, cards: readonly Card[], marked = false)}
  <div class="group" role="group" aria-label={label}>
    <div class="cards">
      {#each cards as card (card.rank + card.suit)}
        <PlayingCard rank={card.rank} suit={card.suit} {marked} />
      {/each}
    </div>
    <small>{label}</small>
  </div>
{/snippet}

<style>
  .spread { display: flex; flex-wrap: wrap; gap: 12px; }
  .group { display: grid; gap: 4px; text-align: center; }
  .cards { display: flex; overflow-wrap: anywhere; }
  .cards :global(.card + .card) { margin-left: calc(var(--card-w, 35px) * -0.58); }
  small { font-weight: 800; }
</style>
