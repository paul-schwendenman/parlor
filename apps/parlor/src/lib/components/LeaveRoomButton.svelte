<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Modal } from '@parlor/ui';
  import { leaveRoomAction } from '$lib/stores/socketClient.js';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';

  let leaving = $state(false);
  let error = $state('');
  let confirmOpen = $state(false);

  // A spectator holds no seat, so leaving loses nothing: no confirmation.
  let spectator = $derived(!playerState.id);
  let isHost = $derived(!!playerState.id && lobbyState.hostId === playerState.id);
  let code = $derived(playerState.roomCode);
  let hostName = $derived(lobbyState.players.find((p) => p.id === lobbyState.hostId)?.name);

  // Who the server would pick: the first other connected human, else the first other human.
  let nextHost = $derived.by(() => {
    const others = lobbyState.players.filter((p) => !p.isBot && p.id !== playerState.id);
    return (others.find((p) => p.connected) ?? others[0])?.name;
  });

  let title = $derived(isHost ? 'Leave your room?' : hostName ? `Leave ${hostName}'s room?` : 'Leave this room?');

  function onLeaveClick() {
    error = '';
    if (spectator) void leave();
    else confirmOpen = true;
  }

  function closeConfirm() {
    if (leaving) return;
    confirmOpen = false;
    error = '';
  }

  async function leave() {
    if (leaving) return;
    leaving = true;
    error = '';
    try {
      await leaveRoomAction();
      confirmOpen = false;
      await goto(resolve('/'));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not leave the room. Try again.';
    } finally {
      leaving = false;
    }
  }
</script>

<div class="leave">
  <button type="button" class="trigger" onclick={onLeaveClick} disabled={leaving && !confirmOpen}><span class="face">Leave room</span></button>
  {#if error && !confirmOpen}
    <p class="trigger-error" role="alert">{error}</p>
  {/if}
</div>

{#if confirmOpen}
<Modal open={true} onclose={closeConfirm} {title}>
  <p class="body">
    {#if isHost && nextHost}
      {nextHost} will become the host. You can rejoin with the code <span class="code">{code}</span>.
    {:else if isHost}
      No one else is here, so the room closes.
    {:else}
      You can rejoin with the code <span class="code">{code}</span>.
    {/if}
  </p>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
  <div class="footer">
    <button type="button" class="btn btn-cancel" onclick={closeConfirm} disabled={leaving}>Cancel</button>
    <button type="button" class="btn btn-confirm" onclick={leave} aria-disabled={leaving || undefined}>Leave room</button>
  </div>
</Modal>
{/if}

<style>
  .leave {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  /* The button is the 44px hit area; the visible pill inside stays 40px so the
     lid doesn't get heavier. Cream fill + ink outline: readable on the
     terracotta lid and on cream. */
  .trigger {
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-espresso);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
  }

  .face {
    height: 40px;
    box-sizing: border-box;
    padding: 0 16px;
    border: 2px solid var(--color-espresso);
    border-radius: 999px;
    background: var(--color-cream);
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  @media (hover: hover) {
    .trigger:hover:not(:disabled) .face {
      background: var(--color-paper);
    }
  }

  .trigger:active:not(:disabled) .face {
    transform: scale(0.98);
  }

  .trigger:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .trigger:focus-visible {
    outline: none;
  }

  .trigger:focus-visible .face,
  .btn:focus-visible {
    outline: 3px solid var(--color-cream);
    outline-offset: 2px;
  }

  .btn:focus-visible {
    outline-color: var(--color-terracotta-deep);
  }

  .trigger-error {
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

  .body {
    margin: 0;
    max-width: 26rem;
    font-size: 1rem;
    line-height: 1.45;
    color: var(--color-espresso);
    text-wrap: pretty;
  }

  /* The code as it's read out: wide Nunito, never split across lines. */
  .code {
    font-family: var(--font-heading);
    font-weight: 900;
    letter-spacing: 0.08em;
    white-space: nowrap;
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
