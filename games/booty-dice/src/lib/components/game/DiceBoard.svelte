<script lang="ts">
  import type { Die } from '../../types/game.js';
  import Dice from './Dice.svelte';

  interface Props {
    dice: Die[];
    canSelect?: boolean;
    onToggleLock?: (index: number) => void;
  }

  let { dice, canSelect = false, onToggleLock }: Props = $props();
</script>

<div class="dice-board" role="group" aria-label="Dice">
  {#each dice as die, index (die.id)}
    <Dice {die} selectable={canSelect} onclick={() => onToggleLock?.(index)} />
  {/each}
</div>

<style>
  .dice-board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    padding: 1.5rem;
    background: #1a1a1a;
    border-radius: 12px;
    border: 2px solid #333;
    max-width: 280px;
  }
</style>
