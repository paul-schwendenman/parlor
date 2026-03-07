<script lang="ts">
  import type { DiceState, RowColor } from '../../types/game.js';
  import Die from './Die.svelte';

  let {
    dice,
    removedDice,
  }: {
    dice: DiceState;
    removedDice: RowColor[];
  } = $props();

  let whiteSum = $derived(dice.white1 + dice.white2);
</script>

<div class="dice-display">
  <div class="dice-row">
    <Die value={dice.white1} color="white" />
    <Die value={dice.white2} color="white" />
    <div class="separator"></div>
    <Die value={dice.red} color="red" removed={removedDice.includes('red')} />
    <Die value={dice.yellow} color="yellow" removed={removedDice.includes('yellow')} />
    <Die value={dice.green} color="green" removed={removedDice.includes('green')} />
    <Die value={dice.blue} color="blue" removed={removedDice.includes('blue')} />
  </div>
  {#if dice.rolled}
    <div class="white-sum">
      White sum: <strong>{whiteSum}</strong>
    </div>
  {/if}
</div>

<style>
  .dice-display {
    text-align: center;
    padding: 16px;
    background: #f9fafb;
    border-radius: 12px;
    margin-bottom: 16px;
  }
  .dice-row {
    display: flex;
    justify-content: center;
    gap: 8px;
    align-items: center;
  }
  .separator {
    width: 2px;
    height: 40px;
    background: #d1d5db;
    margin: 0 4px;
  }
  .white-sum {
    margin-top: 12px;
    font-size: 18px;
    color: #374151;
  }
</style>
