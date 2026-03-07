<script lang="ts">
  import type { RowColor } from '../../types/game.js';

  let {
    number,
    marked,
    available,
    selected = false,
    locked,
    color,
    isLockCell = false,
    onselect,
  }: {
    number: number;
    marked: boolean;
    available: boolean;
    selected?: boolean;
    locked: boolean;
    color: RowColor;
    isLockCell?: boolean;
    onselect?: () => void;
  } = $props();

  function handleClick() {
    if (available && !marked && !locked && onselect) {
      onselect();
    }
  }
</script>

<button
  class="cell {color}"
  class:marked
  class:available
  class:selected
  class:locked
  class:lock-cell={isLockCell}
  disabled={!available || marked || locked}
  onclick={handleClick}
>
  {#if isLockCell}
    {#if marked}
      <span class="lock-icon">&#128274;</span>
    {:else}
      <span class="lock-icon">&#128275;</span>
    {/if}
  {:else if marked}
    <span class="x-mark">X</span>
  {:else}
    {number}
  {/if}
</button>

<style>
  .cell {
    width: 36px;
    height: 36px;
    border: 2px solid transparent;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    background: #f3f4f6;
    color: #9ca3af;
    padding: 0;
  }
  .cell.red { background: #fee2e2; color: #991b1b; }
  .cell.yellow { background: #fef9c3; color: #854d0e; }
  .cell.green { background: #dcfce7; color: #166534; }
  .cell.blue { background: #dbeafe; color: #1e3a5f; }

  .cell.available {
    cursor: pointer;
    border-color: currentColor;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .cell.available:hover {
    transform: scale(1.1);
  }
  .cell.selected {
    cursor: pointer;
    border-color: currentColor;
    border-width: 3px;
    transform: scale(1.15);
    animation: none;
    box-shadow: 0 0 8px currentColor;
  }
  .cell.marked {
    opacity: 1;
  }
  .cell.marked.red { background: #dc2626; color: white; }
  .cell.marked.yellow { background: #eab308; color: white; }
  .cell.marked.green { background: #16a34a; color: white; }
  .cell.marked.blue { background: #2563eb; color: white; }

  .cell.locked {
    opacity: 0.4;
  }
  .x-mark {
    font-size: 18px;
    font-weight: 900;
  }
  .lock-cell {
    font-size: 16px;
  }
  .lock-icon {
    font-size: 14px;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 transparent; }
    50% { box-shadow: 0 0 0 3px currentColor; }
  }

  @media (min-width: 640px) {
    .cell {
      width: 42px;
      height: 42px;
      font-size: 16px;
    }
  }
</style>
