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
    background: #f59e0b;
    color: #000;
  }
  .connection-bar.error {
    background: #ef4444;
    color: #fff;
  }
  .connection-bar.reconnecting {
    background: #3b82f6;
    color: #fff;
  }
</style>
