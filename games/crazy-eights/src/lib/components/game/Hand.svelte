<script lang="ts">
  import type { Card as CardType } from '../../types/game.js';
  import Card from './Card.svelte';
  import { gameState } from '../../stores/gameStore.svelte.js';

  let {
    cards,
    onplaycard,
  }: {
    cards: CardType[];
    onplaycard: (card: CardType) => void;
  } = $props();
</script>

<div class="hand">
  {#each cards as card (card.suit + card.rank)}
    <div class="hand-card">
      <Card
        {card}
        playable={gameState.isCardPlayable(card)}
        selected={gameState.isCardSelected(card)}
        onclick={() => {
          if (gameState.isCardPlayable(card)) {
            onplaycard(card);
          }
        }}
      />
    </div>
  {/each}
</div>

<style>
  .hand {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 0;
  }

  .hand-card {
    transition: transform 0.15s;
  }
</style>
