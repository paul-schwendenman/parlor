<script lang="ts">
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

  const colorMap: Record<string, string> = {
    white: '#f9fafb',
    red: '#dc2626',
    yellow: '#eab308',
    green: '#16a34a',
    blue: '#2563eb',
  };

  let dotColor = $derived(color === 'white' || color === 'yellow' ? '#111' : '#fff');
</script>

<div
  class="die"
  class:removed
  style="background: {colorMap[color]}; --dot-color: {dotColor}"
>
  {#if removed}
    <span class="removed-x">X</span>
  {:else}
    <span class="pips" data-value={value}>{value}</span>
  {/if}
</div>

<style>
  .die {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 900;
    color: var(--dot-color);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    border: 2px solid rgba(0, 0, 0, 0.1);
    transition: transform 0.3s;
  }
  .die.removed {
    opacity: 0.3;
    background: #e5e7eb !important;
  }
  .removed-x {
    color: #9ca3af;
    font-size: 20px;
  }
</style>
