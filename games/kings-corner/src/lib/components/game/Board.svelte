<script lang="ts">
  import { PlayingCard, DrawPile, Felt, cardName } from '@parlor/ui';
  import type { Pile, PilePosition } from '../../types/game.js';
  import { isCornerPosition } from '../../game/validation.js';

  let {
    piles,
    drawCount,
    canDraw,
    targets,
    movable,
    selectedPile,
    ondraw,
    onpile,
  }: {
    piles: Pile[];
    drawCount: number;
    canDraw: boolean;
    /** Piles the selected card or pile can go to: they wear the mustard ring. */
    targets: PilePosition[];
    /** Piles the viewer could pick up and move (nothing selected yet). */
    movable: PilePosition[];
    selectedPile: PilePosition | null;
    ondraw: () => void;
    onpile: (position: PilePosition) => void;
  } = $props();

  // Reading order of the 3×3 grid; null is the stock in the middle.
  const LAYOUT: (PilePosition | null)[] = [
    'northwest', 'north', 'northeast',
    'west', null, 'east',
    'southwest', 'south', 'southeast',
  ];

  const PLACE_NAMES: Record<PilePosition, string> = {
    north: 'North pile',
    south: 'South pile',
    east: 'East pile',
    west: 'West pile',
    northeast: 'North-east corner',
    northwest: 'North-west corner',
    southeast: 'South-east corner',
    southwest: 'South-west corner',
  };

  const pileAt = (position: PilePosition): Pile =>
    piles.find((p) => p.position === position) ?? { position, cards: [] };

  function describe(pile: Pile, isTarget: boolean, isSelected: boolean): string {
    const parts = [PLACE_NAMES[pile.position]];
    const { cards } = pile;
    if (cards.length === 0) {
      parts.push(isCornerPosition(pile.position) ? 'empty, Kings only' : 'empty');
    } else {
      const top = cards[cards.length - 1];
      parts.push(`top card ${cardName(top.rank, top.suit)}`);
      if (cards.length > 1) parts.push(`starts with ${cardName(cards[0].rank, cards[0].suit)}, ${cards.length} cards`);
    }
    if (isSelected) parts.push('picked up');
    else if (isTarget) parts.push('you can play here');
    return parts.join(', ');
  }
</script>

<Felt>
  <div class="grid">
    {#each LAYOUT as position, i (position ?? `stock-${i}`)}
      {#if position === null}
        <div class="cell stock">
          <DrawPile count={drawCount} {canDraw} {ondraw} />
          {#if drawCount > 0}<span class="count" aria-hidden="true">{drawCount}</span>{/if}
        </div>
      {:else}
        {@const pile = pileAt(position)}
        {@const isTarget = targets.includes(position)}
        {@const isSelected = selectedPile === position}
        {@const isMovable = movable.includes(position)}
        {@const interactive = isTarget || isSelected || isMovable}
        {@const base = pile.cards[0]}
        {@const top = pile.cards[pile.cards.length - 1]}
        <button
          type="button"
          class="cell pile"
          class:corner={isCornerPosition(position)}
          class:target={isTarget}
          class:selected={isSelected}
          class:movable={isMovable && !isSelected && !isTarget}
          disabled={!interactive}
          aria-label={describe(pile, isTarget, isSelected)}
          onclick={() => onpile(position)}
        >
          {#if pile.cards.length === 0}
            <span class="slot" aria-hidden="true">
              {#if isCornerPosition(position)}<span class="k">K</span>{/if}
            </span>
          {:else}
            <!-- The pile's first card peeks out above its top card: that's the
                 card that has to fit when the whole pile moves. -->
            {#if pile.cards.length > 1}
              <span class="base" aria-hidden="true"><PlayingCard rank={base.rank} suit={base.suit} /></span>
            {/if}
            <span class="top" class:stacked={pile.cards.length > 1} aria-hidden="true">
              <PlayingCard rank={top.rank} suit={top.suit} />
            </span>
          {/if}
        </button>
      {/if}
    {/each}
  </div>
</Felt>

<style>
  .grid {
    --peek: calc(var(--card-w) * 0.3);
    display: grid;
    grid-template-columns: repeat(3, var(--card-w));
    grid-auto-rows: calc(var(--card-w) * 1.42 + var(--peek));
    gap: 10px clamp(14px, 6vw, 36px);
    justify-content: center;
  }

  .cell {
    position: relative;
    width: var(--card-w);
    display: flex;
    align-items: flex-end;
  }

  .stock {
    align-items: center;
  }

  .count {
    position: absolute;
    right: -10px;
    bottom: calc(var(--peek) / 2 - 10px);
    min-width: 28px;
    height: 24px;
    padding: 0 6px;
    box-sizing: border-box;
    border: 2px solid var(--color-espresso);
    border-radius: 999px;
    background: var(--color-cream);
    color: var(--color-espresso);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }

  .pile {
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    border-radius: calc(var(--card-w) * 0.14);
    cursor: default;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .pile:not(:disabled) {
    cursor: pointer;
  }

  .slot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--card-w);
    height: calc(var(--card-w) * 1.42);
    box-sizing: border-box;
    border: 2px dashed rgba(253, 246, 236, 0.55);
    border-radius: calc(var(--card-w) * 0.14);
  }

  .k {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: calc(var(--card-w) * 0.42);
    color: var(--color-cream);
    opacity: 0.55;
  }

  .base {
    position: absolute;
    top: 0;
    left: 0;
  }

  .top {
    position: relative;
    display: block;
  }

  /* The mustard ring means "you can play here", as on the stock. */
  .pile.target {
    outline: 3px solid var(--color-mustard);
    outline-offset: 4px;
  }

  .pile.target .slot {
    border-color: var(--color-mustard);
    border-style: solid;
  }

  /* A picked-up pile lifts and wears butter, like a picked card in the hand. */
  .pile.selected {
    transform: translateY(-8px);
  }

  .pile.selected :global(.card) {
    background: var(--color-mustard-tint);
  }

  .pile.selected .top :global(.card) {
    border-width: 3px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }

  .pile.movable {
    outline: 2px dashed var(--color-cream);
    outline-offset: 4px;
  }

  @media (hover: hover) {
    .pile.target:hover,
    .pile.movable:hover {
      transform: translateY(-4px);
    }
  }

  .pile:focus-visible {
    outline: 3px solid var(--color-cream);
    outline-offset: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .pile {
      transition: none;
    }
  }
</style>
