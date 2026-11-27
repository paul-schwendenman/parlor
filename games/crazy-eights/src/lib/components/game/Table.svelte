<script lang="ts">
  import { PlayingCard, SuitIcon, SUIT_NAMES } from '@parlor/ui';
  import { SUITS, type Card, type Suit } from '../../types/game.js';

  let {
    topCard,
    declaredSuit,
    drawCount,
    canDraw,
    choosingSuit,
    ondraw,
    onchoosesuit,
  }: {
    topCard: Card | null;
    declaredSuit: Suit | null;
    drawCount: number;
    canDraw: boolean;
    /** It's the viewer's eight: the table becomes the suit picker. */
    choosingSuit: boolean;
    ondraw: () => void;
    onchoosesuit: (suit: Suit) => void;
  } = $props();
</script>

<section class="table" aria-label="Table">
  {#if choosingSuit}
    <div class="suits" role="group" aria-label="Pick the suit for the next player">
      {#each SUITS as suit (suit)}
        <button type="button" class="suit-btn" class:red={suit === 'hearts' || suit === 'diamonds'} onclick={() => onchoosesuit(suit)}>
          <SuitIcon {suit} size={34} />
          <span>{SUIT_NAMES[suit]}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="piles">
      <div class="pile">
        {#if drawCount > 0}
          <button
            type="button"
            class="stack draw"
            class:ready={canDraw}
            disabled={!canDraw}
            onclick={ondraw}
            aria-label={canDraw ? `Draw a card, ${drawCount} left` : `Draw pile, ${drawCount} left`}
          >
            {#if drawCount > 2}<span class="under two"><PlayingCard faceDown /></span>{/if}
            {#if drawCount > 1}<span class="under one"><PlayingCard faceDown /></span>{/if}
            <PlayingCard faceDown />
          </button>
        {:else}
          <div class="empty">Empty</div>
        {/if}
        <p class="caption" aria-hidden="true">{canDraw ? 'Tap to draw' : `${drawCount} left`}</p>
      </div>

      <div class="pile">
        {#if topCard}
          <div class="stack">
            <span class="under tilt"><PlayingCard faceDown /></span>
            <PlayingCard rank={topCard.rank} suit={topCard.suit} />
          </div>
        {:else}
          <div class="empty">Empty</div>
        {/if}
        {#if declaredSuit}
          <p class="called" class:red={declaredSuit === 'hearts' || declaredSuit === 'diamonds'}>
            <SuitIcon suit={declaredSuit} size={16} />
            <span>{SUIT_NAMES[declaredSuit]} called</span>
          </p>
        {:else}
          <p class="caption">Discard</p>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .table {
    min-height: calc(var(--card-w) * 1.42 + 96px);
    box-sizing: border-box;
    padding: 24px 16px 18px;
    border: 2.5px solid var(--color-espresso);
    border-radius: 18px;
    background: var(--color-forest-deep);
    box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.25);
    color: var(--color-cream);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .piles {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: clamp(28px, 10vw, 56px);
  }

  .pile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .stack {
    position: relative;
    display: block;
    padding: 0;
    border: 0;
    background: none;
    border-radius: calc(var(--card-w) * 0.14);
  }

  .under {
    position: absolute;
    inset: 0;
  }

  .under.one { transform: translate(3px, 3px); }
  .under.two { transform: translate(6px, 6px); }
  .under.tilt { transform: rotate(-7deg) translate(-4px, 2px); }

  /* The top card is the last child, so it sits on the stack. */
  .stack > :global(:last-child) {
    position: relative;
  }

  .draw {
    cursor: default;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .draw.ready {
    cursor: pointer;
    outline: 3px solid var(--color-mustard);
    outline-offset: 4px;
  }

  @media (hover: hover) {
    .draw.ready:hover {
      transform: translateY(-4px);
    }
  }

  .draw.ready:active {
    transform: scale(0.98);
  }

  .draw:focus-visible {
    outline: 3px solid var(--color-cream);
    outline-offset: 4px;
  }

  .empty {
    width: var(--card-w);
    height: calc(var(--card-w) * 1.42);
    box-sizing: border-box;
    border: 2px dashed var(--color-cream);
    border-radius: calc(var(--card-w) * 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .caption {
    margin: 0;
    min-height: 28px;
    display: flex;
    align-items: center;
    font-size: 0.875rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  /* The called suit is the thing to notice after an eight: a cream chip. */
  .called {
    margin: 0;
    min-height: 28px;
    box-sizing: border-box;
    padding: 0 12px 0 9px;
    border: 2px solid var(--color-espresso);
    border-radius: 999px;
    background: var(--color-cream);
    color: var(--color-espresso);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8125rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .called.red :global(.suit) {
    color: var(--color-danger);
  }

  .suits {
    width: 100%;
    max-width: 420px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .suit-btn {
    min-height: 88px;
    padding: 12px 4px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-paper);
    color: var(--color-espresso);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: clamp(0.8125rem, 3.4vw, 0.9375rem);
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease;
  }

  .suit-btn.red :global(.suit) {
    color: var(--color-danger);
  }

  @media (hover: hover) {
    .suit-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }
  }

  .suit-btn:active {
    transform: scale(0.98);
  }

  .suit-btn:focus-visible {
    outline: 3px solid var(--color-cream);
    outline-offset: 2px;
  }

  @media (max-width: 380px) {
    .suits {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
