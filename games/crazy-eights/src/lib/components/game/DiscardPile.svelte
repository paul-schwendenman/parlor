<script lang="ts">
  import type { Card as CardType, Suit } from '../../types/game.js';
  import Card from './Card.svelte';

  let {
    topCard,
    declaredSuit,
  }: {
    topCard: CardType | null;
    declaredSuit: Suit | null;
  } = $props();

  const SUIT_SYMBOLS: Record<string, string> = {
    hearts: '\u2665',
    diamonds: '\u2666',
    clubs: '\u2663',
    spades: '\u2660',
  };

  const SUIT_COLORS: Record<string, string> = {
    hearts: '#dc2626',
    diamonds: '#dc2626',
    clubs: '#1f2937',
    spades: '#1f2937',
  };
</script>

<div class="discard-pile">
  <p class="label">Discard</p>
  <div class="pile-area">
    {#if topCard}
      <Card card={topCard} />
    {:else}
      <div class="empty-pile">Empty</div>
    {/if}
    {#if declaredSuit}
      <div class="declared-suit" style="color: {SUIT_COLORS[declaredSuit]}">
        {SUIT_SYMBOLS[declaredSuit]}
      </div>
    {/if}
  </div>
</div>

<style>
  .discard-pile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .pile-area {
    position: relative;
  }

  .empty-pile {
    width: 56px;
    height: 80px;
    border-radius: 8px;
    border: 2px dashed #d1d5db;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    font-size: 12px;
  }

  .declared-suit {
    position: absolute;
    top: -8px;
    right: -12px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: white;
    border: 2px solid currentColor;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
</style>
