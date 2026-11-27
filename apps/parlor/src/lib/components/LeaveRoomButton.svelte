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
      error = err instanceof Error ? err.message : 'Could not leave the room. Try again.';
    } finally {
      leaving = false;
    }
  }
</script>

<div class="leave">
  <button type="button" onclick={leave} disabled={leaving}>Leave room</button>
  {#if error}
    <p role="alert">{error}</p>
  {/if}
</div>

<style>
  .leave {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  /* Cream fill + ink outline: readable on the terracotta lid and on cream. */
  button {
    height: 40px;
    padding: 0 16px;
    border: 2px solid var(--color-espresso);
    border-radius: 999px;
    background: var(--color-cream);
    color: var(--color-espresso);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  button:hover:not(:disabled) {
    background: var(--color-paper);
  }

  button:active:not(:disabled) {
    transform: scale(0.98);
  }

  button:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  p {
    margin: 0;
    padding: 4px 10px;
    border-radius: 10px;
    background: var(--color-cream);
    color: var(--color-danger);
    font-size: 0.8125rem;
    font-weight: 600;
    max-width: 16rem;
    text-align: right;
  }
</style>
