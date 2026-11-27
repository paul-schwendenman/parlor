<script lang="ts">
  import { SUITS, SUIT_SYMBOLS, type Suit } from '@parlor/cards';

  let {
    onchoose,
  }: {
    onchoose: (suit: Suit) => void;
  } = $props();

  const SUIT_DISPLAY: Record<Suit, { color: string; name: string }> = {
    hearts: { color: '#dc2626', name: 'Hearts' },
    diamonds: { color: '#dc2626', name: 'Diamonds' },
    clubs: { color: '#1f2937', name: 'Clubs' },
    spades: { color: '#1f2937', name: 'Spades' },
  };
</script>

<div class="suit-picker-overlay">
  <div class="suit-picker">
    <h3 class="title">Choose a suit</h3>
    <div class="suits">
      {#each SUITS as suit (suit)}
        <button
          class="suit-btn"
          style="color: {SUIT_DISPLAY[suit].color}"
          onclick={() => onchoose(suit)}
        >
          <span class="symbol">{SUIT_SYMBOLS[suit]}</span>
          <span class="name">{SUIT_DISPLAY[suit].name}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .suit-picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .suit-picker {
    background: white;
    border-radius: 16px;
    padding: 24px 32px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    text-align: center;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 16px;
  }

  .suits {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .suit-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 24px;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    background: white;
    cursor: pointer;
    transition: transform 0.1s, border-color 0.15s, background 0.15s;
  }

  .suit-btn:hover {
    border-color: currentColor;
    background: #f9fafb;
    transform: scale(1.05);
  }

  .suit-btn:active {
    transform: scale(0.98);
  }

  .symbol {
    font-size: 32px;
    line-height: 1;
  }

  .name {
    font-size: 0.8rem;
    font-weight: 600;
    color: #6b7280;
  }
</style>
