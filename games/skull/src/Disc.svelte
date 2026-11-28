<script lang="ts">
  /** A round printed disc: a clay back, a paper flower face, or an espresso skull face. */
  import type { Disc } from './types.js';

  let { face, size = 44, label }: { face: Disc | 'back'; size?: number; label?: string } = $props();
</script>

<span class="disc {face}" style:--size="{size}px" role="img" aria-label={label ?? (face === 'back' ? 'Face-down disc' : face === 'flower' ? 'Flower' : 'Skull')}>
  {#if face === 'flower'}
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 13v8" stroke="var(--color-forest)" stroke-width="2" stroke-linecap="round" />
      {#each [0, 72, 144, 216, 288] as turn (turn)}
        <ellipse cx="12" cy="6.5" rx="2.6" ry="3.6" transform="rotate({turn} 12 10)" fill="var(--color-terracotta)" stroke="var(--color-espresso)" stroke-width="1" />
      {/each}
      <circle cx="12" cy="10" r="2.2" fill="var(--color-mustard)" stroke="var(--color-espresso)" stroke-width="1" />
    </svg>
  {:else if face === 'skull'}
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4 2.6 4.9V18a1.2 1.2 0 0 0 1.2 1.2h7.4a1.2 1.2 0 0 0 1.2-1.2v-2.6c1.5-.9 2.6-2.5 2.6-4.9 0-4-3.1-7-7.5-7Z" fill="var(--color-cream)" />
      <circle cx="9" cy="11" r="1.9" fill="var(--color-espresso)" />
      <circle cx="15" cy="11" r="1.9" fill="var(--color-espresso)" />
      <path d="M10.5 16.5v2.5M13.5 16.5v2.5" stroke="var(--color-espresso)" stroke-width="1.2" />
    </svg>
  {/if}
</span>

<style>
  .disc { box-sizing: border-box; display: inline-grid; place-items: center; flex: 0 0 auto; width: var(--size); height: var(--size);
    border-radius: 50%; border: 2px solid var(--color-espresso); }
  .back { background: var(--color-terracotta-deep); box-shadow: inset 0 0 0 calc(var(--size) * .14) var(--color-terracotta-deep), inset 0 0 0 calc(var(--size) * .18) var(--color-cream); }
  .flower { background: var(--color-paper); }
  .skull { background: var(--color-espresso); }
  svg { width: 74%; height: 74%; }
</style>
