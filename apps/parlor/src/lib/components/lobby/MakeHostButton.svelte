<script lang="ts">
  import { Modal } from '@parlor/ui';
  import { transferHostAction } from '$lib/stores/socketClient.js';

  interface Props {
    /** The player who would become host: a connected human, not you. */
    playerId: string;
    playerName: string;
    /** Called after the server accepted the hand-over. */
    onDone?: () => void;
  }

  let { playerId, playerName, onDone }: Props = $props();

  let open = $state(false);
  let pending = $state(false);
  let error = $state('');

  function openConfirm() {
    error = '';
    open = true;
  }

  function close() {
    if (pending) return;
    open = false;
    error = '';
  }

  async function confirm() {
    if (pending) return;
    pending = true;
    error = '';
    try {
      await transferHostAction(playerId);
      open = false;
      onDone?.();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not pass the host role on. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<button type="button" class="make-host" onclick={openConfirm} aria-label="Make {playerName} the host">
  Make host
</button>

{#if open}
<Modal open={true} onclose={close} title="Make {playerName} the host?">
  <p class="body">{playerName} will pick games and start them. You'll stay in the room.</p>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
  <div class="footer">
    <button type="button" class="btn btn-cancel" onclick={close} disabled={pending}>Cancel</button>
    <button type="button" class="btn btn-confirm" onclick={confirm} aria-disabled={pending || undefined}>
      Make {playerName} host
    </button>
  </div>
</Modal>
{/if}

<style>
  /* A quiet outline pill in a player row: 44px target, row-sized type. */
  .make-host {
    flex-shrink: 0;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    border: 2px solid var(--color-espresso);
    background: transparent;
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.875rem;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  .make-host:active {
    transform: scale(0.98);
  }

  .make-host:focus-visible,
  .btn:focus-visible {
    outline: 3px solid var(--color-terracotta-deep);
    outline-offset: 2px;
  }

  .body {
    margin: 0;
    max-width: 26rem;
    font-size: 1rem;
    line-height: 1.45;
    color: var(--color-espresso);
  }

  .error {
    margin: 12px 0 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-danger);
  }

  .footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }

  .btn {
    min-height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  .btn-cancel {
    background: transparent;
    border: 2px solid var(--color-espresso);
    color: var(--color-espresso);
  }

  /* Deep Clay: cream text at this size never sits on Kiln Terracotta. */
  .btn-confirm {
    background: var(--color-terracotta-deep);
    border: 2px solid var(--color-terracotta-deep);
    color: var(--color-cream);
  }

  .btn-confirm[aria-disabled='true'] {
    cursor: progress;
    opacity: 0.8;
  }

  .btn:disabled {
    cursor: not-allowed;
    border-style: dashed;
    color: var(--color-ink-muted);
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  @media (hover: hover) {
    .make-host:hover,
    .btn-cancel:hover:not(:disabled) {
      background: rgba(59, 47, 47, 0.06);
    }

    .btn-confirm:hover:not([aria-disabled='true']) {
      background: var(--color-terracotta-press);
      border-color: var(--color-terracotta-press);
    }
  }

  @media (max-width: 519px) {
    .btn {
      flex: 1 1 auto;
    }
  }
</style>
