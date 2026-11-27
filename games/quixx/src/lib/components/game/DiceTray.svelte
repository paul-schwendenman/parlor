<script lang="ts">
  import { Felt } from '@parlor/ui';
  import type { DiceState, RowColor } from '../../types/game.js';
  import Die from './Die.svelte';

  let { dice, removedDice }: { dice: DiceState; removedDice: RowColor[] } = $props();

  const COLOURS: RowColor[] = ['red', 'yellow', 'green', 'blue'];
</script>

<Felt label="Dice">
  <div class="tray">
    {#if dice.rolled}
      <div class="dice">
        <div class="group" role="group" aria-label="White dice">
          <Die value={dice.white1} color="white" />
          <Die value={dice.white2} color="white" />
        </div>
        <div class="group" role="group" aria-label="Coloured dice">
          {#each COLOURS as c (c)}
            <Die value={dice[c]} color={c} removed={removedDice.includes(c)} />
          {/each}
        </div>
      </div>
      <p class="sum">White sum <strong>{dice.white1 + dice.white2}</strong></p>
    {:else}
      <p class="idle">Waiting for the roll</p>
    {/if}
  </div>
</Felt>

<style>
  .tray {
    width: 100%;
    min-height: calc(var(--die-size, 44px) + 44px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .dice {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px clamp(12px, 4vw, 24px);
  }

  .group {
    display: flex;
    gap: 6px;
  }

  .sum,
  .idle {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .sum strong {
    margin-left: 4px;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.375rem;
    font-variant-numeric: tabular-nums;
  }
</style>
