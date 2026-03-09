<script lang="ts">
  import type { KingsCornerPlayerInfo } from '../../types/game.js';

  let {
    players,
    activePlayerIndex,
    myIndex,
  }: {
    players: KingsCornerPlayerInfo[];
    activePlayerIndex: number;
    myIndex: number;
  } = $props();

  let opponents = $derived(
    players
      .map((p, i) => ({ ...p, index: i }))
      .filter((p) => p.index !== myIndex),
  );
</script>

<div class="opponent-bar">
  {#each opponents as opponent}
    <div class="opponent" class:active={opponent.index === activePlayerIndex} class:disconnected={!opponent.connected}>
      <span class="name">{opponent.name}</span>
      <span class="card-count">{opponent.cardCount} cards</span>
      {#if opponent.index === activePlayerIndex}
        <span class="turn-dot"></span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .opponent-bar {
    display: flex;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .opponent {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    background: white;
    border: 1.5px solid #e5e7eb;
    font-size: 0.85rem;
    position: relative;
  }

  .opponent.active {
    border-color: #f59e0b;
    background: #fffbeb;
  }

  .opponent.disconnected {
    opacity: 0.5;
  }

  .name {
    font-weight: 600;
    color: #374151;
  }

  .card-count {
    color: #6b7280;
    font-size: 0.8rem;
  }

  .turn-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b;
  }
</style>
