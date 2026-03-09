<script lang="ts">
  import type { Pile, PilePosition } from '../../types/game.js';
  import PileSlot from './PileSlot.svelte';
  import DrawPile from './DrawPile.svelte';
  import { gameState } from '../../stores/gameStore.svelte.js';

  let {
    piles,
    drawPileCount,
    canDraw,
    ondraw,
    onpileclick,
  }: {
    piles: Pile[];
    drawPileCount: number;
    canDraw: boolean;
    ondraw: () => void;
    onpileclick: (position: PilePosition) => void;
  } = $props();

  function getPile(position: PilePosition): Pile {
    return piles.find((p) => p.position === position) ?? { position, cards: [] };
  }

  const positions: PilePosition[][] = [
    ['northwest', 'north', 'northeast'],
    ['west', 'north' /* placeholder for draw pile */, 'east'],
    ['southwest', 'south', 'southeast'],
  ];
</script>

<div class="board">
  <!-- Row 1: NW, N, NE -->
  <div class="board-row">
    <PileSlot
      pile={getPile('northwest')}
      isValidTarget={gameState.isValidTarget('northwest')}
      isSelected={gameState.isPileSelected('northwest')}
      isMovable={gameState.isPileMovable('northwest')}
      onclick={() => onpileclick('northwest')}
    />
    <PileSlot
      pile={getPile('north')}
      isValidTarget={gameState.isValidTarget('north')}
      isSelected={gameState.isPileSelected('north')}
      isMovable={gameState.isPileMovable('north')}
      onclick={() => onpileclick('north')}
    />
    <PileSlot
      pile={getPile('northeast')}
      isValidTarget={gameState.isValidTarget('northeast')}
      isSelected={gameState.isPileSelected('northeast')}
      isMovable={gameState.isPileMovable('northeast')}
      onclick={() => onpileclick('northeast')}
    />
  </div>

  <!-- Row 2: W, Draw Pile, E -->
  <div class="board-row">
    <PileSlot
      pile={getPile('west')}
      isValidTarget={gameState.isValidTarget('west')}
      isSelected={gameState.isPileSelected('west')}
      isMovable={gameState.isPileMovable('west')}
      onclick={() => onpileclick('west')}
    />
    <DrawPile count={drawPileCount} {canDraw} {ondraw} />
    <PileSlot
      pile={getPile('east')}
      isValidTarget={gameState.isValidTarget('east')}
      isSelected={gameState.isPileSelected('east')}
      isMovable={gameState.isPileMovable('east')}
      onclick={() => onpileclick('east')}
    />
  </div>

  <!-- Row 3: SW, S, SE -->
  <div class="board-row">
    <PileSlot
      pile={getPile('southwest')}
      isValidTarget={gameState.isValidTarget('southwest')}
      isSelected={gameState.isPileSelected('southwest')}
      isMovable={gameState.isPileMovable('southwest')}
      onclick={() => onpileclick('southwest')}
    />
    <PileSlot
      pile={getPile('south')}
      isValidTarget={gameState.isValidTarget('south')}
      isSelected={gameState.isPileSelected('south')}
      isMovable={gameState.isPileMovable('south')}
      onclick={() => onpileclick('south')}
    />
    <PileSlot
      pile={getPile('southeast')}
      isValidTarget={gameState.isValidTarget('southeast')}
      isSelected={gameState.isPileSelected('southeast')}
      isMovable={gameState.isPileMovable('southeast')}
      onclick={() => onpileclick('southeast')}
    />
  </div>
</div>

<style>
  .board {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 0;
  }

  .board-row {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
  }
</style>
