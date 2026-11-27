<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    onclose?: () => void;
    title?: string;
    children: Snippet;
  }

  let { open = $bindable(), onclose, title, children }: Props = $props();

  const titleId = $props.id();
  let dialog = $state<HTMLDialogElement | null>(null);

  // Native <dialog>: focus moves inside and returns to the opener, Escape
  // closes, and the page behind is inert.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first control, which on a long sheet is often
      // a footer button: the dialog would open scrolled to its end. Start at
      // the top with the dialog itself focused; Tab still reaches controls.
      dialog.focus();
      dialog.scrollTop = 0;
    }
    if (!open && dialog.open) dialog.close();
  });

  // Fires for Escape and for close(). Only a user dismissal (open still true)
  // reports onclose; a parent setting open=false does not, as before.
  function handleClose() {
    if (open) {
      open = false;
      onclose?.();
    }
  }

  function handleClick(e: MouseEvent) {
    // The dialog box has no padding of its own, so a click whose target is the
    // dialog element itself landed on the backdrop.
    if (e.target === dialog) dialog?.close();
  }
</script>

<dialog
  bind:this={dialog}
  class="modal"
  tabindex="-1"
  aria-labelledby={title ? titleId : undefined}
  onclose={handleClose}
  onclick={handleClick}
>
  {#if open}
    <div class="modal-body">
      {#if title}
        <h2 id={titleId} class="modal-title">{title}</h2>
      {/if}
      {@render children()}
    </div>
  {/if}
</dialog>

<style>
  /* Tokens come from the Parlor app; fallbacks keep standalone games on-palette. */
  .modal {
    margin: auto;
    padding: 0;
    min-width: min(20rem, calc(100vw - 32px));
    max-width: min(90vw, 40rem);
    max-height: 90vh;
    box-sizing: border-box;
    overflow-y: auto;
    border: 2.5px solid var(--color-espresso, #3B2F2F);
    border-radius: 20px;
    background: var(--color-paper, #FFFFFF);
    color: var(--color-espresso, #3B2F2F);
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    box-shadow: 0 8px 32px rgba(59, 47, 47, 0.15);
  }

  .modal:focus-visible {
    outline: none;
  }

  .modal::backdrop {
    background: rgba(59, 47, 47, 0.5);
  }

  .modal-body {
    padding: 24px;
  }

  .modal-title {
    margin: 0 0 16px;
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
    color: inherit;
  }
</style>
