<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { leaveRoomAction } from '$lib/stores/socketClient.js';

  let leaving = $state(false);
  let error = $state('');

  async function leave() {
    leaving = true;
    error = '';
    try {
      await leaveRoomAction();
      await goto(resolve('/'));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not leave the room';
    } finally {
      leaving = false;
    }
  }
</script>

<button type="button" onclick={leave} disabled={leaving}>Leave room</button>
{#if error}
  <p role="alert">{error}</p>
{/if}

<style>
  button {
    border: 1px solid #d6cdc3;
    border-radius: 8px;
    background: var(--color-linen);
    color: var(--color-espresso);
    padding: 0.5rem 0.85rem;
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: var(--color-terracotta);
  }

  button:disabled {
    opacity: 0.55;
    cursor: default;
  }

  p {
    color: #991b1b;
    font-size: 0.875rem;
    margin: 0.5rem 0 0;
  }
</style>
