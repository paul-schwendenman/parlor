<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { connectionState } from '$lib/stores/connectionStore.svelte.js';
  import { getSocket } from '$lib/stores/socketClient.js';
  import GameView from '$lib/components/game/GameView.svelte';

  let roomCode = $derived($page.params.roomCode ?? '');
  let roomNotFound = $state(false);

  onMount(() => {
    if (browser) {
      getSocket();
    }
  });

  // Detect missing game state
  $effect(() => {
    if (connectionState.status !== 'connected') return;
    if (gameState.view) return;
    if (playerState.id) return;

    roomNotFound = true;
  });

  let view = $derived(gameState.view);
  let hadView = false;

  // Navigate back to lobby on game reset
  $effect(() => {
    if (view) {
      hadView = true;
    } else if (hadView) {
      goto(`/lobby/${roomCode}`);
    }
  });

  function backToLobby() {
    getSocket().emit('lobby:resetGame');
    gameState.reset();
    lobbyState.gameStarting = false;
    goto(`/lobby/${roomCode}`);
  }
</script>

<svelte:head><title>Booty Dice - Parlor</title></svelte:head>

{#if !view}
  <div class="loading">
    {#if roomNotFound}
      <h1>Game not found</h1>
      <p>This game doesn't exist or has ended.</p>
      <a href="/" class="back-link">Back to home</a>
    {:else}
      <p>Loading game...</p>
    {/if}
  </div>
{:else}
  <GameView
    {view}
    socket={getSocket()}
    playerId={playerState.id ?? ''}
    onBackToLobby={backToLobby}
  />
{/if}

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    color: #888;
    gap: 1rem;
  }

  .loading h1 {
    font-size: 1.5rem;
    color: #d4a574;
  }

  .back-link {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: #d97706;
    color: white;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    transition: background 0.2s;
  }

  .back-link:hover {
    background: #b45309;
  }
</style>
