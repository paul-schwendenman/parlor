<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { connectionState } from '$lib/stores/connectionStore.svelte.js';
  import { getSocket } from '$lib/stores/socketClient.js';
  import LeaveRoomButton from '$lib/components/LeaveRoomButton.svelte';
  import GameRenderer from '$lib/components/games/GameRenderer.svelte';

  let roomCode = $derived($page.params.roomCode ?? '');
  let roomNotFound = $state(false);

  onMount(() => {
    if (browser) getSocket();
  });

  $effect(() => {
    if (playerState.roomCode === roomCode) {
      roomNotFound = false;
      return;
    }
    if (connectionState.status !== 'connected') return;
    // Wait for the reconnect handshake before declaring the game gone.
    if (connectionState.reconnectPending) return;
    roomNotFound = true;
  });

  let view = $derived(gameState.state);
  let hadView = false;

  $effect(() => {
    if (view) {
      hadView = true;
    } else if (hadView && playerState.roomCode === roomCode) {
      goto(resolve('/lobby/[roomCode]', { roomCode })).catch(console.error);
    }
  });

  function handleBackToLobby() {
    getSocket().emit('lobby:resetGame');
    gameState.reset();
    lobbyState.gameStarting = false;
    goto(resolve('/lobby/[roomCode]', { roomCode })).catch(console.error);
  }
</script>

<svelte:head><title>Playing - Parlor</title></svelte:head>

<header class="lid">
  <div class="lid-inner">
    <span class="wordmark">PARLOR</span>
    {#if playerState.roomCode === roomCode}
      <span class="code-chip" aria-label="Room code {roomCode}">{roomCode}</span>
      {#if !playerState.id}<span class="spectating">Watching as spectator</span>{/if}
      <div class="leave"><LeaveRoomButton /></div>
    {/if}
  </div>
</header>

{#if !view}
  <div class="loading">
    {#if roomNotFound}
      <h1 class="state-title">This game doesn't exist or has ended.</h1>
      <p class="state-body">Check the code with whoever invited you, or start a new room.</p>
      <a href={resolve('/')} class="back-link">Back to home</a>
    {:else}
      <p class="state-body" role="status">Loading game…</p>
    {/if}
  </div>
{:else}
  <GameRenderer
    state={view}
    socket={getSocket()}
    playerId={playerState.id}
    onBackToLobby={playerState.id ? handleBackToLobby : undefined}
  />
{/if}

<style>
  /* A slim lid: identity and the room code without taking the board's space. */
  .lid {
    background: var(--color-terracotta);
    border-bottom: 3px solid var(--color-espresso);
    margin-bottom: 12px;
  }

  .lid-inner {
    max-width: 800px;
    margin: 0 auto;
    padding: 10px 16px;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
  }

  .wordmark {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--color-cream);
  }

  .code-chip {
    padding: 4px 10px;
    border: 2px solid var(--color-espresso);
    border-radius: 10px;
    background: var(--color-mustard);
    color: var(--color-espresso);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1rem;
    letter-spacing: 0.14em;
    font-variant-numeric: tabular-nums;
  }

  .spectating {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--color-cream);
    color: var(--color-espresso);
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .leave {
    margin-left: auto;
  }

  .lid :global(:focus-visible) {
    outline-color: var(--color-cream);
  }

  .loading {
    max-width: 480px;
    margin: 0 auto;
    padding: 32px 20px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .state-title {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.5rem;
    line-height: 1.15;
    color: var(--color-espresso);
  }

  .state-body {
    margin: 0 0 8px;
    font-size: 1rem;
    line-height: 1.45;
    color: var(--color-ink-muted);
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    height: 52px;
    padding: 0 28px;
    border-radius: 999px;
    background: var(--color-terracotta-deep);
    color: var(--color-cream);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.0625rem;
    text-decoration: none;
    transition: background 0.2s ease;
  }

  .back-link:hover {
    background: var(--color-terracotta-press);
  }
</style>
