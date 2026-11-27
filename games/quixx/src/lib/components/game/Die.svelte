<script lang="ts">
  /**
   * A printed die: ink outline, drawn pips. White dice are paper with ink
   * pips; coloured dice are their row's ink with cream pips (yellow keeps ink
   * pips, cream on mustard fails contrast).
   */
  import type { RowColor } from '../../types/game.js';

  let {
    value,
    color,
    removed = false,
  }: {
    value: number;
    color: 'white' | RowColor;
    removed?: boolean;
  } = $props();

  // Pip centres on a 3×3 grid (0 = left/top, 1 = middle, 2 = right/bottom).
  const PIPS: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };

  let label = $derived(removed ? `${color} die, out of the game` : `${color} die, ${value}`);
</script>

<div class="die die-{color}" class:removed role="img" aria-label={label}>
  {#if !removed}
    <svg viewBox="0 0 30 30" aria-hidden="true">
      {#each PIPS[value] ?? [] as [x, y], i (i)}
        <circle cx={7 + x * 8} cy={7 + y * 8} r="3.1" />
      {/each}
    </svg>
  {/if}
</div>

<style>
  .die {
    --die: var(--die-size, 44px);
    width: var(--die);
    height: var(--die);
    box-sizing: border-box;
    flex-shrink: 0;
    border: 2px solid var(--color-espresso);
    border-radius: calc(var(--die) * 0.24);
    padding: calc(var(--die) * 0.08);
    color: var(--color-cream);
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  .die-white { background: var(--color-paper); color: var(--color-espresso); }
  .die-red { background: var(--row-red); }
  .die-yellow { background: var(--row-yellow); color: var(--color-espresso); }
  .die-green { background: var(--row-green); }
  .die-blue { background: var(--row-blue); }

  /* A die leaves the game when its row is locked. */
  .die.removed {
    background: transparent;
    border-style: dashed;
    border-color: var(--color-cream);
    opacity: 0.6;
  }
</style>
