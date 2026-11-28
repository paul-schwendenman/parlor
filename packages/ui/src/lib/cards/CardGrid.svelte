<script lang="ts">
  import PlayingCard from './PlayingCard.svelte';
  import { cardName, type CardSuit } from './suits.js';

  interface Props {
    cards: readonly ({ rank: string; suit: CardSuit } | null)[];
    columns: number;
    label: string;
    targets?: readonly number[];
    selected?: number;
    captions?: readonly (string | number)[];
    onpick?: (slot: number) => void;
  }

  let { cards, columns, label, targets = [], selected, captions, onpick }: Props = $props();
</script>

<div class="grid" role="group" aria-label={label} style:grid-template-columns={`repeat(${columns}, max-content)`}>
  {#each cards as card, slot (slot)}
    {#if onpick && targets.includes(slot)}
      <button type="button" class="slot" aria-pressed={selected === slot}
        aria-label={`Slot ${slot + 1}: ${card ? cardName(card.rank, card.suit) : 'face down'}`}
        onclick={() => onpick?.(slot)}>
        {@render face(card)}
      </button>
    {:else}
      <div class="static-slot" aria-label={card ? undefined : `Slot ${slot + 1}: face down`}>{@render face(card)}</div>
    {/if}
  {/each}
  {#if captions}
    {#each captions as caption, column (column)}
      <small aria-label={`Column ${column + 1}: ${caption}`}>{caption}</small>
    {/each}
  {/if}
</div>

{#snippet face(card: Props['cards'][number])}
  <PlayingCard rank={card?.rank} suit={card?.suit} faceDown={!card} />
{/snippet}

<style>
  .grid { display: grid; gap: var(--card-grid-gap, 8px); justify-content: center; text-align: center; }
  .slot { padding: 0; background: transparent; border: 0; border-radius: 8px; cursor: pointer;
    outline: 2px solid var(--color-mustard); outline-offset: 2px; }
  .slot[aria-pressed='true'] { transform: translateY(-4px); box-shadow: 0 0 0 5px var(--color-mustard-tint); }
  .slot:focus-visible { outline: 3px solid var(--color-espresso); }
  small { font-weight: 800; font-variant-numeric: tabular-nums; }
</style>
