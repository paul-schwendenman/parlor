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
  import GameRenderer from '$lib/components/games/GameRenderer.svelte';

  let roomCode = $derived($page.params.roomCode ?? '');
  let roomNotFound = $state(false);

  onMount(() => {
    if (browser) getSocket();
  });

  $effect(() => {
    if (connectionState.status !== 'connected') return;
    if (gameState.view) return;
    if (playerState.id) return;
    roomNotFound = true;
  });

  let view = $derived(gameState.view);
  let hadView = false;

  $effect(() => {
    if (view) {
      hadView = true;
    } else if (hadView) {
      goto(`/lobby/${roomCode}`);
    }
  });

  function handleBackToLobby() {
    getSocket().emit('lobby:resetGame');
    gameState.reset();
    lobbyState.gameStarting = false;
    goto(`/lobby/${roomCode}`);
  }
</script>

<svelte:head><title>Playing - Parlor</title></svelte:head>

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
    gameId={gameState.gameId}
    {view}
    socket={getSocket()}
    playerId={playerState.id}
    onBackToLobby={handleBackToLobby}
  />
{/if}

<style>
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
