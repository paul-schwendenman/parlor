<script lang="ts">
  import { tick } from 'svelte';
  import { Modal } from '@parlor/ui';
  import { transferHostAction } from '$lib/stores/socketClient.js';

  interface Props {
    /** The player the actions are for: a connected human, not you. Host only. */
    playerId: string;
    playerName: string;
    /** Called after the server accepted the hand-over. */
    onDone?: () => void;
  }

  let { playerId, playerName, onDone }: Props = $props();

  const menuId = $props.id();
  let wrap = $state<HTMLElement | null>(null);
  let trigger = $state<HTMLButtonElement | null>(null);
  let firstAction = $state<HTMLButtonElement | null>(null);

  let menuOpen = $state(false);
  /** Open upward when the row sits near the bottom of the screen. */
  let dropUp = $state(false);

  let confirmOpen = $state(false);
  let pending = $state(false);
  let error = $state('');

  async function toggleMenu() {
    if (menuOpen) {
      menuOpen = false;
      return;
    }
    const rect = trigger?.getBoundingClientRect();
    dropUp = !!rect && window.innerHeight - rect.bottom < 96;
    menuOpen = true;
    await tick();
    firstAction?.focus();
  }

  function closeMenu(returnFocus = false) {
    menuOpen = false;
    if (returnFocus) trigger?.focus();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && menuOpen) {
      e.stopPropagation();
      closeMenu(true);
    }
  }

  // Close on a tap or click anywhere else, and when focus leaves the menu.
  $effect(() => {
    if (!menuOpen) return;
    const away = (e: PointerEvent) => {
      if (wrap && !wrap.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  });

  function onFocusOut(e: FocusEvent) {
    if (menuOpen && wrap && !wrap.contains(e.relatedTarget as Node | null)) closeMenu();
  }

  function askMakeHost() {
    closeMenu();
    error = '';
    confirmOpen = true;
  }

  function closeConfirm() {
    if (pending) return;
    confirmOpen = false;
    error = '';
  }

  async function confirm() {
    if (pending) return;
    pending = true;
    error = '';
    try {
      await transferHostAction(playerId);
      confirmOpen = false;
      onDone?.();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not pass the host role on. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="actions" bind:this={wrap} onkeydown={onKeydown} onfocusout={onFocusOut}>
  <button
    type="button"
    class="trigger"
    bind:this={trigger}
    onclick={toggleMenu}
    aria-label="Options for {playerName}"
    aria-expanded={menuOpen}
    aria-controls={menuId}
    data-testid="player-actions"
  >
    <span class="disc" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.25" stroke-linecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>
    </span>
  </button>

  {#if menuOpen}
    <span class="menu" class:up={dropUp} id={menuId}>
      <button type="button" class="menu-item" bind:this={firstAction} onclick={askMakeHost}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l-1-9 5 4 4-7 4 7 5-4-1 9z"/><path d="M5 21h14"/></svg>
        Make {playerName} the host
      </button>
    </span>
  {/if}
</span>

{#if confirmOpen}
<Modal open={true} onclose={closeConfirm} title="Make {playerName} the host?">
  <p class="body">{playerName} will pick games and start them. You'll stay in the room.</p>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
  <div class="footer">
    <button type="button" class="btn btn-cancel" onclick={closeConfirm} disabled={pending}>Cancel</button>
    <button type="button" class="btn btn-confirm" onclick={confirm} aria-disabled={pending || undefined}>
      Make {playerName} host
    </button>
  </div>
</Modal>
{/if}

<style>
  /* Sits at the row's right edge. The 44px target overlaps the row's 12px gap
     (the status chip beside it isn't interactive) and most of its right
     padding, so it costs the name about 22px, not 56. The -4px top and bottom
     keep a 56px row from growing. */
  .actions {
    position: relative;
    flex-shrink: 0;
    display: inline-flex;
    margin: -4px -10px -4px -12px;
  }

  .trigger {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-espresso);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  /* The visible disc is 36px inside the 44px target, so it never crowds the
     row's outline. */
  .disc {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  /* Open: the dots sit on a linen disc, so the trigger reads as pressed. */
  .trigger[aria-expanded='true'] .disc {
    background: var(--color-linen);
  }

  .trigger:active {
    transform: scale(0.96);
  }

  .trigger:focus-visible {
    outline: none;
  }

  .trigger:focus-visible .disc,
  .menu-item:focus-visible,
  .btn:focus-visible {
    outline: 3px solid var(--color-terracotta-deep);
    outline-offset: 2px;
  }

  /* A small raised sheet: it overlaps the rows below, so it may cast a shadow. */
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    padding: 6px;
    border: 2px solid var(--color-espresso);
    border-radius: 14px;
    background: var(--color-paper);
    width: max-content;
    max-width: calc(100vw - 48px);
    box-shadow: 0 10px 24px rgba(59, 47, 47, 0.16);
    animation: menu-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: top right;
  }

  .menu.up {
    top: auto;
    bottom: calc(100% + 4px);
    transform-origin: bottom right;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 16px 0 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--color-espresso);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 700;
    line-height: 1.3;
    text-align: left;
    cursor: pointer;
  }

  .menu-item svg {
    flex-shrink: 0;
    color: var(--color-terracotta-deep);
  }

  .menu-item:active {
    background: rgba(59, 47, 47, 0.08);
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .menu {
      animation: none;
    }
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
    .trigger:hover .disc,
    .menu-item:hover,
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
