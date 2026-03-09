<script lang="ts">
  import type { Card } from '../../types/game.js';

  let {
    card,
    faceDown = false,
    playable = false,
    selected = false,
    highlighted = false,
    small = false,
    onclick,
  }: {
    card: Card;
    faceDown?: boolean;
    playable?: boolean;
    selected?: boolean;
    highlighted?: boolean;
    small?: boolean;
    onclick?: () => void;
  } = $props();

  const SUIT_SYMBOLS: Record<string, string> = {
    hearts: '\u2665',
    diamonds: '\u2666',
    clubs: '\u2663',
    spades: '\u2660',
  };

  let suitSymbol = $derived(SUIT_SYMBOLS[card.suit] ?? '');
  let isRed = $derived(card.suit === 'hearts' || card.suit === 'diamonds');
</script>

{#if faceDown}
  <div class="card face-down" class:small>
    <div class="card-back"></div>
  </div>
{:else}
  <button
    class="card"
    class:playable
    class:selected
    class:highlighted
    class:red={isRed}
    class:black={!isRed}
    class:small
    onclick={onclick}
    disabled={!playable && !onclick}
  >
    <span class="rank">{card.rank}</span>
    <span class="suit">{suitSymbol}</span>
  </button>
{/if}

<style>
  .card {
    width: 56px;
    height: 80px;
    border-radius: 8px;
    border: 2px solid #d1d5db;
    background: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-family: 'Georgia', serif;
    cursor: default;
    transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
    flex-shrink: 0;
    padding: 0;
    position: relative;
  }

  .card.small {
    width: 40px;
    height: 58px;
  }

  .card.small .rank {
    font-size: 13px;
  }

  .card.small .suit {
    font-size: 14px;
  }

  .card.red {
    color: #dc2626;
  }

  .card.black {
    color: #1f2937;
  }

  .card.playable {
    cursor: pointer;
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px #3b82f6;
  }

  .card.playable:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .card.selected {
    transform: translateY(-8px);
    border-color: #2563eb;
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
    background: #eff6ff;
  }

  .card.highlighted {
    border-color: #f59e0b;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
  }

  .rank {
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
  }

  .suit {
    font-size: 20px;
    line-height: 1;
  }

  .face-down {
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #1e40af 100%);
    border-color: #1e3a8a;
    cursor: default;
  }

  .card-back {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 4px,
      rgba(255, 255, 255, 0.1) 4px,
      rgba(255, 255, 255, 0.1) 8px
    );
  }
</style>
