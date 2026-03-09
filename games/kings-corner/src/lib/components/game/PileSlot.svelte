<script lang="ts">
  import type { Pile, PilePosition } from '../../types/game.js';
  import { isCornerPosition } from '../../game/validation.js';
  import Card from './Card.svelte';

  let {
    pile,
    isValidTarget = false,
    isSelected = false,
    isMovable = false,
    onclick,
  }: {
    pile: Pile;
    isValidTarget?: boolean;
    isSelected?: boolean;
    isMovable?: boolean;
    onclick?: () => void;
  } = $props();

  let isEmpty = $derived(pile.cards.length === 0);
  let topCard = $derived(pile.cards.length > 0 ? pile.cards[pile.cards.length - 1] : null);
  let isCorner = $derived(isCornerPosition(pile.position));
  let cardCount = $derived(pile.cards.length);
</script>

<button
  class="pile-slot"
  class:empty={isEmpty}
  class:corner={isCorner}
  class:valid-target={isValidTarget}
  class:selected={isSelected}
  class:movable={isMovable}
  onclick={onclick}
  disabled={!onclick && !isValidTarget && !isMovable}
>
  {#if topCard}
    <div class="card-stack">
      {#if cardCount > 1}
        <div class="stack-indicator">{cardCount}</div>
      {/if}
      <Card card={topCard} small={true} />
    </div>
  {:else if isCorner}
    <span class="corner-label">K</span>
  {:else}
    <span class="empty-label">&mdash;</span>
  {/if}
</button>

<style>
  .pile-slot {
    width: 56px;
    height: 74px;
    border-radius: 10px;
    border: 2px dashed #d1d5db;
    background: #f9fafb;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    padding: 0;
    position: relative;
  }

  .pile-slot:not(:disabled) {
    cursor: pointer;
  }

  .pile-slot:not(.empty) {
    border-style: solid;
    border-color: #d1d5db;
    background: transparent;
  }

  .pile-slot.corner.empty {
    border-color: #e5e7eb;
    background: #fefce8;
  }

  .pile-slot.valid-target {
    border-color: #22c55e;
    border-style: solid;
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
    background: #f0fdf4;
    cursor: pointer;
  }

  .pile-slot.valid-target:hover {
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.4);
  }

  .pile-slot.selected {
    border-color: #2563eb;
    border-style: solid;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
  }

  .pile-slot.movable:not(.selected):not(.valid-target) {
    border-color: #a78bfa;
    border-style: solid;
    cursor: pointer;
  }

  .pile-slot.movable:not(.selected):not(.valid-target):hover {
    box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.3);
  }

  .card-stack {
    position: relative;
  }

  .stack-indicator {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #6b7280;
    color: white;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }

  .corner-label {
    font-family: 'Georgia', serif;
    font-size: 20px;
    font-weight: 700;
    color: #d1d5db;
  }

  .empty-label {
    font-size: 18px;
    color: #d1d5db;
  }
</style>
