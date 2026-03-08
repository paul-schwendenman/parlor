<script lang="ts">
  import { connectionState } from '../../stores/connectionStore.svelte.js';
</script>

{#if connectionState.status !== 'connected'}
  <div class="connection-bar" class:error={connectionState.status === 'error'} class:reconnecting={connectionState.status === 'reconnecting'}>
    {#if connectionState.status === 'disconnected'}
      Disconnected from server
    {:else if connectionState.status === 'reconnecting'}
      Reconnecting...
    {:else if connectionState.status === 'error'}
      {connectionState.errorMessage ?? 'Connection error'}
    {/if}
  </div>
{/if}

<style>
  .connection-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: 8px 16px;
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    z-index: 100;
    background: var(--color-mustard);
    color: var(--color-espresso);
  }
  .connection-bar.error {
    background: #dc2626;
    color: #fff;
  }
  .connection-bar.reconnecting {
    background: var(--color-terracotta);
    color: #fff;
  }
</style>
