<script lang="ts">
  import { tick } from 'svelte';
  import type { LogEntry } from '../../types/game.js';

  let { entries }: { entries: LogEntry[] } = $props();
  let list = $state<HTMLOListElement | null>(null);

  // Keep the newest line in view.
  $effect(() => {
    if (entries.length === 0) return;
    tick().then(() => {
      if (list) list.scrollTop = list.scrollHeight;
    }).catch(console.error);
  });
</script>

<section class="log" aria-labelledby="log-title">
  <h2 id="log-title" class="title">Captain's log</h2>
  {#if entries.length === 0}
    <p class="empty">Nothing yet. The first roll starts the story.</p>
  {:else}
    <ol class="entries" bind:this={list} aria-live="polite">
      {#each entries as entry, i (`${entry.timestamp}-${i}`)}
        <li class="entry entry-{entry.type}">{entry.message}</li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .log {
    padding: 14px 16px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-paper);
  }

  .title {
    margin: 0 0 8px;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.125rem;
  }

  .empty {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-ink-muted);
  }

  .entries {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 168px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .entry {
    padding: 3px 0;
    border-bottom: 1.5px solid var(--color-linen);
  }

  .entry:last-child {
    border-bottom: 0;
  }

  .entry-combo,
  .entry-elimination,
  .entry-win {
    font-weight: 700;
  }

  .entry-summary {
    color: var(--color-ink-muted);
  }
</style>
