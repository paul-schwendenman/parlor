<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
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
      goto(`/lobby/${roomCode}`).catch(console.error);
    }
  });

  function handleBackToLobby() {
    getSocket().emit('lobby:resetGame');
    gameState.reset();
    lobbyState.gameStarting = false;
    goto(`/lobby/${roomCode}`).catch(console.error);
  }
</script>

<svelte:head><title>Playing - Parlor</title></svelte:head>

{#if playerState.roomCode === roomCode}
  <div class="room-nav">
    {#if !playerState.id}<span>Watching as spectator</span>{/if}
    <LeaveRoomButton />
  </div>
{/if}

{#if !view}
  <div class="loading">
    <a href="/" class="logo">Parlor</a>
    {#if roomNotFound}
      <p class="error-message">This game doesn't exist or has ended.</p>
      <a href="/" class="back-link">Back to home</a>
    {:else}
      <p>Loading game...</p>
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
  .room-nav {
    max-width: 800px;
    margin: 0 auto;
    padding: 0.75rem 1rem 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: baseline;
    gap: 0.75rem;
    color: var(--color-espresso);
  }

  .loading {
    text-align: center;
    padding: 64px 16px;
    color: #a8a29e;
  }
  .logo {
    display: block;
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-espresso);
    text-decoration: none;
    margin-bottom: 1.5rem;
  }
  .logo:hover {
    color: var(--color-terracotta);
  }
  .error-message {
    color: #991b1b;
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }
  .back-link {
    display: inline-block;
    padding: 0.7rem 1.5rem;
    background: var(--color-terracotta);
    color: white;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
  }
</style>
