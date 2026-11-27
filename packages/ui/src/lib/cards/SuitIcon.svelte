<script lang="ts">
  import type { CardSuit } from './suits.js';

  interface Props {
    suit: CardSuit;
    size?: number | string;
  }

  let { suit, size = 24 }: Props = $props();
</script>

<svg class="suit" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  {#if suit === 'hearts'}
    <path d="M12 21.2s-8.2-5-9.9-10.3C.9 7.1 3.2 3.6 6.8 3.6c2.2 0 3.9 1.2 5.2 3.1 1.3-1.9 3-3.1 5.2-3.1 3.6 0 5.9 3.5 4.7 7.3C20.2 16.2 12 21.2 12 21.2z" />
  {:else if suit === 'diamonds'}
    <path d="M12 1.8c2.3 3.7 5.1 7.1 8.3 10.2-3.2 3.1-6 6.5-8.3 10.2C9.7 18.5 6.9 15.1 3.7 12 6.9 8.9 9.7 5.5 12 1.8z" />
  {:else if suit === 'clubs'}
    <circle cx="12" cy="7" r="4.4" />
    <circle cx="6.6" cy="13.6" r="4.4" />
    <circle cx="17.4" cy="13.6" r="4.4" />
    <path d="M11 11h2c0 4.4.9 7.6 3.4 10.6H7.6C10.1 18.6 11 15.4 11 11z" />
  {:else}
    <path d="M12 1.8C9.2 6.2 3 9.4 3 14.2c0 2.9 2.2 4.8 4.8 4.8 1.5 0 2.7-.6 3.4-1.6-.3 1.8-1.2 3.1-2.8 4.2h7.2c-1.6-1.1-2.5-2.4-2.8-4.2.7 1 1.9 1.6 3.4 1.6 2.6 0 4.8-1.9 4.8-4.8C21 9.4 14.8 6.2 12 1.8z" />
  {/if}
</svg>

<style>
  .suit {
    display: block;
    flex-shrink: 0;
  }
</style>
