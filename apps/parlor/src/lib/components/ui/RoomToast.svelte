<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { roomNotice } from '$lib/stores/roomNotice.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';

  // Only for the room the viewer is in (a stale notice never follows them home).
  let visible = $derived(!!roomNotice.message && !!playerState.roomCode && roomNotice.roomCode === playerState.roomCode);

  function reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function enter(node: Element) {
    return fly(node, { y: -12, duration: reducedMotion() ? 0 : 260, easing: cubicOut });
  }
</script>

<!-- The live region stays mounted so screen readers hear each notice. It never
     takes taps: the notice is read-only and leaves on its own. -->
<div class="room-toast" role="status" aria-live="polite" aria-atomic="true">
  {#if visible}
    {#key roomNotice.seq}
      <p class="notice" data-testid="room-toast" in:enter>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l-1-9 5 4 4-7 4 7 5-4-1 9z"/><path d="M5 21h14"/></svg>
        <span>{roomNotice.message}</span>
      </p>
    {/key}
  {/if}
</div>

<style>
  /* Pinned under the top edge, over the lid: the bottom of the screen holds
     each page's main action, which a notice must never cover. */
  .room-toast {
    position: fixed;
    top: max(12px, env(safe-area-inset-top));
    left: 0;
    right: 0;
    z-index: 110;
    display: flex;
    justify-content: center;
    padding: 0 16px;
    pointer-events: none;
  }

  .notice {
    margin: 0;
    max-width: 28rem;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-paper);
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 700;
    line-height: 1.35;
    text-wrap: pretty;
    /* Raised sheet: it physically sits on top of the page. */
    box-shadow: 0 10px 24px rgba(59, 47, 47, 0.16);
  }

  svg {
    flex-shrink: 0;
    color: var(--color-terracotta-deep);
  }
</style>
