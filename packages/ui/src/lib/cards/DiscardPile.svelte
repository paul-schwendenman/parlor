<script lang="ts">
  import PlayingCard from './PlayingCard.svelte';
  import type { CardSuit } from './suits.js';

  let { card, canTake = false, selected = false, onpick }: {
    card: { rank: string; suit: CardSuit } | null;
    canTake?: boolean;
    selected?: boolean;
    onpick?: () => void;
  } = $props();
</script>

{#if card}
  <div class="pile" class:ready={canTake && !selected}>
    <PlayingCard rank={card.rank} suit={card.suit} playable={canTake} {selected} onclick={canTake ? onpick : undefined} />
  </div>
{:else}
  <div class="empty">Empty</div>
{/if}

<style>
  .pile { border-radius: calc(var(--card-w, 64px) * 0.14); }
  .ready { outline: 3px solid var(--color-mustard); outline-offset: 4px; }
  .empty { display: grid; place-items: center; box-sizing: border-box;
    width: var(--card-w, 64px); height: calc(var(--card-w, 64px) * 1.42);
    border: 2px dashed currentColor; border-radius: calc(var(--card-w, 64px) * 0.14); }
</style>
