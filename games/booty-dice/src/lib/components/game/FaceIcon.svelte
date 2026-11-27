<script lang="ts">
  /**
   * Booty Dice's drawn icons: the six die faces, plus the heart used for
   * lives. One stroke family (2.2px, round caps) at any size.
   */
  import type { DiceFace } from '../../types/game.js';

  let { face, size = 24 }: { face: DiceFace | 'heart'; size?: number | string } = $props();
</script>

<svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if face === 'doubloon'}
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
  {:else if face === 'x_marks_spot'}
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke-width="3" />
  {:else if face === 'jolly_roger'}
    <path d="M12 3.5a7 7 0 0 0-7 7c0 2.3 1.1 4 2.6 5v3.2h8.8v-3.2c1.5-1 2.6-2.7 2.6-5a7 7 0 0 0-7-7z" />
    <circle cx="9.3" cy="10.8" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="14.7" cy="10.8" r="1.5" fill="currentColor" stroke="none" />
    <path d="M10.6 18.7v-2.2M13.4 18.7v-2.2" />
  {:else if face === 'cutlass'}
    <path d="M19.5 4.5C15 6 11 9.5 8.5 14" stroke-width="2.6" />
    <path d="M6 12l6 6" />
    <path d="M8 16.5L4.5 20" stroke-width="2.6" />
  {:else if face === 'walk_plank'}
    <path d="M3 9.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    <path d="M3 15.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
  {:else if face === 'shield'}
    <path d="M12 3l7.5 3v5.2c0 4.8-3.2 8.3-7.5 9.8-4.3-1.5-7.5-5-7.5-9.8V6z" />
  {:else}
    <path d="M12 20s-7.5-4.5-8.6-9.3C2.6 7.3 4.6 4.5 7.6 4.5c2 0 3.4 1 4.4 2.6 1-1.6 2.4-2.6 4.4-2.6 3 0 5 2.8 4.2 6.2C19.5 15.5 12 20 12 20z" />
  {/if}
</svg>

<style>
  .icon {
    display: block;
    flex-shrink: 0;
  }
</style>
