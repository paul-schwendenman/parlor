<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    onclose?: () => void;
    title?: string;
    children: Snippet;
  }

  let { open = $bindable(), onclose, title, children }: Props = $props();

  function handleBackdropClick() {
    open = false;
    onclose?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
      onclose?.();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="backdrop" onclick={handleBackdropClick} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      {#if title}
        <h2 class="modal-title">{title}</h2>
      {/if}
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .modal {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    min-width: 20rem;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-title {
    margin: 0 0 1rem;
    font-size: 1.25rem;
  }
</style>
