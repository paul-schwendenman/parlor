<script lang="ts">
  import type { LogEntry } from '../../types/game.js';
  import { tick } from 'svelte';

  interface Props {
    entries: LogEntry[];
  }

  let { entries }: Props = $props();
  let container: HTMLDivElement;

  $effect(() => {
    if (entries.length > 0) {
      tick().then(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  });
</script>

<div class="game-log" bind:this={container}>
  <h3>Game Log</h3>
  <div class="entries">
    {#each entries as entry, index (`${entry.timestamp}-${index}`)}
      <div class="entry entry-{entry.type}">
        {entry.message}
      </div>
    {/each}
  </div>
</div>

<style>
  .game-log {
    background: #1a1a1a;
    border-radius: 10px;
    padding: 1rem;
    height: 200px;
    overflow-y: auto;
  }

  h3 {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .entry {
    font-size: 0.85rem;
    padding: 0.5rem;
    border-radius: 4px;
    background: #222;
    color: #ccc;
  }

  .entry-combo {
    background: #3d2a1a;
    color: #d4a574;
    font-weight: 600;
  }

  .entry-elimination {
    background: #3a1a1a;
    color: #e77;
  }

  .entry-win {
    background: #2a3d1a;
    color: #9d9;
    font-weight: 600;
  }

  .entry-summary {
    background: #1a2a3d;
    color: #7aa8d4;
    border-left: 3px solid #4a8cc4;
    font-style: italic;
  }
</style>
