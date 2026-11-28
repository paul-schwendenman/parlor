<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { PLAYER_NAME_MAX_LENGTH } from '@parlor/game-types';
  import { createRoomAction } from '$lib/stores/socketClient.js';
  import { findGame } from '$lib/games/catalog.js';

  interface Props {
    open: boolean;
    /** The game to start with, or undefined for a room that votes first. */
    gameId?: string;
    onclose: () => void;
  }

  let { open, gameId, onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let name = $state('');
  let error = $state('');
  let loading = $state(false);
  let game = $derived(findGame(gameId));

  // Native <dialog>: focus moves inside, Escape closes, background is inert.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  function cancel() {
    name = '';
    error = '';
    onclose();
  }

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    if (!name.trim()) { error = 'Add a name so everyone knows who’s hosting.'; return; }
    loading = true;
    error = '';
    try {
      const roomCode = await createRoomAction(name.trim(), gameId);
      await goto(resolve('/lobby/[roomCode]', { roomCode }));
    } catch (err) {
      // The server's own reason when it gives one; otherwise say what to try.
      const reason = err instanceof Error ? err.message : '';
      error = reason && reason !== 'Failed to create room' ? reason : 'Couldn’t create the room. Check your connection and try again.';
    } finally {
      loading = false;
    }
  }

  function backdrop(e: MouseEvent) {
    // A click on the dialog element itself (not its contents) is the backdrop.
    if (e.target === dialog) cancel();
  }
</script>

<dialog
  bind:this={dialog}
  class="create"
  aria-labelledby="create-title"
  aria-describedby="create-desc"
  onclose={() => { if (open) cancel(); }}
  onclick={backdrop}
>
  {#if open}
    <form class="create-form" onsubmit={create} novalidate>
      <h2 id="create-title" class="create-title">{game ? `Play ${game.name}` : 'Create a room'}</h2>
      <p id="create-desc" class="create-desc">{game ? 'You’ll get a code to share, and everyone joins from their own device.' : 'Invite friends and vote on what to play.'}</p>
      <label class="field">
        <span class="field-label">Your name</span>
        <input
          type="text"
          bind:value={name}
          placeholder="Enter your name"
          maxlength={PLAYER_NAME_MAX_LENGTH}
          autocomplete="nickname"
          class="input"
          aria-invalid={!!error && !name.trim()}
          aria-describedby={error ? 'create-error' : undefined}
        />
      </label>
      {#if error}
        <p id="create-error" class="error" role="alert">{error}</p>
      {/if}
      <div class="create-actions">
        <button type="button" class="pill" onclick={cancel}>Cancel</button>
        <button type="submit" class="btn-accent" disabled={loading}>{loading ? 'Creating…' : 'Create room'}</button>
      </div>
    </form>
  {/if}
</dialog>

<style>
  .create {
    /* Tailwind preflight zeroes dialog margins; restore centring. */
    margin: auto;
    width: min(420px, calc(100% - 32px));
    box-sizing: border-box;
    padding: 24px;
    border: 2.5px solid var(--color-espresso);
    border-radius: 20px;
    background: var(--color-paper);
    color: var(--color-espresso);
    box-shadow: 0 8px 32px rgba(59, 47, 47, 0.15);
  }

  .create::backdrop {
    background: rgba(59, 47, 47, 0.5);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .create-title {
    margin: 0 0 6px;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .create-desc {
    margin: -4px 0 4px;
    font-size: 0.875rem;
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .input {
    height: 50px;
    width: 100%;
    box-sizing: border-box;
    padding: 0 14px;
    border: 2px solid var(--color-espresso);
    border-radius: 12px;
    background: var(--color-paper);
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-size: 1rem;
  }

  .input::placeholder {
    color: var(--color-ink-muted);
  }

  .input[aria-invalid='true'] {
    border-color: var(--color-danger);
  }

  .error {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-danger);
  }

  .create-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .pill,
  .btn-accent {
    height: 50px;
    padding: 0 20px;
    border-radius: 999px;
    border: 2px solid var(--color-espresso);
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  .pill {
    background: transparent;
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 1rem;
  }

  .btn-accent {
    padding: 0 24px;
    white-space: nowrap;
    background: var(--color-terracotta-deep);
    border-color: var(--color-terracotta-deep);
    color: var(--color-cream);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1rem;
  }

  .btn-accent:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .pill:active,
  .btn-accent:active:not(:disabled) {
    transform: scale(0.98);
  }

  @media (hover: hover) {
    .pill:hover {
      background: rgba(59, 47, 47, 0.06);
    }

    .btn-accent:hover:not(:disabled) {
      background: var(--color-terracotta-press);
      border-color: var(--color-terracotta-press);
    }
  }

  @media (max-width: 600px) {
    .create-actions > * {
      flex: 1;
      padding: 0 12px;
    }
  }
</style>
