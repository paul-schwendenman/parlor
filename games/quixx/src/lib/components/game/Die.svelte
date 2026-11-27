<script lang="ts">
  /**
   * A Quixx die: the shared printed die, inked in its row colour. White dice
   * are paper with ink pips; coloured dice carry cream pips, except yellow,
   * which keeps ink pips (cream on mustard fails contrast).
   */
  import { PipDie } from '@parlor/ui';
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

  const FACE: Record<'white' | RowColor, [string, string]> = {
    white: ['var(--color-paper)', 'var(--color-espresso)'],
    red: ['var(--row-red)', 'var(--color-cream)'],
    yellow: ['var(--row-yellow)', 'var(--color-espresso)'],
    green: ['var(--row-green)', 'var(--color-cream)'],
    blue: ['var(--row-blue)', 'var(--color-cream)'],
  };
</script>

{#if removed}
  <!-- A die leaves the game when its row is locked. -->
  <span class="removed" role="img" aria-label="{color} die, out of the game"></span>
{:else}
  <span class="tint" style:--die-face={FACE[color][0]} style:--die-pip={FACE[color][1]}>
    <PipDie {value} label="{color} die, {value}" />
  </span>
{/if}

<style>
  .tint {
    display: contents;
  }

  .removed {
    display: block;
    width: var(--die-size, 44px);
    height: var(--die-size, 44px);
    box-sizing: border-box;
    border: 2px dashed var(--color-cream);
    border-radius: calc(var(--die-size, 44px) * 0.24);
    opacity: 0.6;
  }
</style>
