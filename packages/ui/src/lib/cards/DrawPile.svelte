<script lang="ts">
  /**
   * The stock: face-down cards stacked a few deep, printed in the game's back
   * colour. When the viewer can draw, it wears the mustard "act here" ring.
   * Made for felt: focus is a cream ring.
   */
  import PlayingCard from './PlayingCard.svelte';

  interface Props {
    count: number;
    canDraw: boolean;
    ondraw: () => void;
  }

  let { count, canDraw, ondraw }: Props = $props();
</script>

{#if count > 0 || canDraw}
  <button
    type="button"
    class="stack"
    class:ready={canDraw}
    disabled={!canDraw}
    onclick={ondraw}
    aria-label={canDraw ? (count ? `Draw a card, ${count} left` : 'Recycle discards and draw a card') : `Draw pile, ${count} left`}
  >
    {#if count > 2}<span class="under two"><PlayingCard faceDown /></span>{/if}
    {#if count > 1}<span class="under one"><PlayingCard faceDown /></span>{/if}
    <span class="top"><PlayingCard faceDown /></span>
  </button>
{:else}
  <div class="empty" role="img" aria-label="Draw pile, empty">Empty</div>
{/if}

<style>
  .stack {
    position: relative;
    display: block;
    padding: 0;
    border: 0;
    background: none;
    border-radius: calc(var(--card-w, 64px) * 0.14);
    cursor: default;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .under {
    position: absolute;
    inset: 0;
  }

  .under.one { transform: translate(3px, 3px); }
  .under.two { transform: translate(6px, 6px); }

  .top {
    position: relative;
    display: block;
  }

  .stack.ready {
    cursor: pointer;
    outline: 3px solid var(--color-mustard, #D4A843);
    outline-offset: 4px;
  }

  @media (hover: hover) {
    .stack.ready:hover {
      transform: translateY(-4px);
    }
  }

  .stack.ready:active {
    transform: scale(0.98);
  }

  .stack:focus-visible {
    outline: 3px solid var(--color-cream, #FDF6EC);
    outline-offset: 4px;
  }

  .empty {
    width: var(--card-w, 64px);
    height: calc(var(--card-w, 64px) * 1.42);
    box-sizing: border-box;
    border: 2px dashed var(--color-cream, #FDF6EC);
    border-radius: calc(var(--card-w, 64px) * 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-cream, #FDF6EC);
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    font-size: 0.8125rem;
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .stack {
      transition: none;
    }
  }
</style>
