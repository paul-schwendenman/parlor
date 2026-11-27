<script lang="ts">
  import { connectionState } from '../../stores/connectionStore.svelte.js';
</script>

<!-- The live region stays mounted so screen readers hear status changes. -->
<div class="connection" role="status" aria-live="polite">
  {#if connectionState.status !== 'connected'}
    <div
      class="connection-bar"
      class:error={connectionState.status === 'error'}
      class:reconnecting={connectionState.status === 'reconnecting'}
    >
      {#if connectionState.status === 'disconnected'}
        Disconnected from the server
      {:else if connectionState.status === 'reconnecting'}
        Reconnecting…
      {:else if connectionState.status === 'error'}
        {connectionState.errorMessage ?? 'Connection error'}
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Sits above the lid (sticky, not overlaid) so it never hides the wordmark. */
  .connection {
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .connection-bar {
    padding: 8px 16px;
    border-bottom: 2px solid var(--color-espresso);
    background: var(--color-mustard);
    color: var(--color-espresso);
    text-align: center;
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 700;
  }

  /* Deep Clay, not Kiln Terracotta: cream text at 14px needs 4.5:1. */
  .connection-bar.reconnecting {
    background: var(--color-terracotta-deep);
    color: var(--color-cream);
  }

  .connection-bar.error {
    background: var(--color-danger);
    color: var(--color-cream);
  }
</style>
