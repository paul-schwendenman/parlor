<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import LobbyView from '$lib/components/lobby/LobbyView.svelte';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { connectionState } from '$lib/stores/connectionStore.svelte.js';
  import { getSocket } from '$lib/stores/socketClient.js';

  let roomCode = $derived($page.params.roomCode ?? '');
  let roomNotFound = $state(false);

  onMount(() => {
    if (browser) {
      getSocket();
    }
  });

  $effect(() => {
    if (connectionState.status !== 'connected') return;
    if (lobbyState.players.length > 0) return;
    if (playerState.id) return;

    roomNotFound = true;
  });

  $effect(() => {
    if (lobbyState.gameStarting || gameState.view) {
      goto(`/game/${roomCode}`);
    }
  });
</script>

<svelte:head><title>Lobby {roomCode} - Booty Dice</title></svelte:head>

{#if roomNotFound}
  <div class="not-found">
    <h1>Room not found</h1>
    <p class="error-message">This lobby doesn't exist or has ended.</p>
    <a href="/" class="back-link">Back to home</a>
  </div>
{:else}
  <LobbyView {roomCode} />
{/if}

<style>
  .not-found {
    text-align: center;
    padding: 4rem 1rem;
    color: #888;
  }

  .not-found h1 {
    font-size: 1.5rem;
    color: #d4a574;
    margin-bottom: 1rem;
  }

  .error-message {
    color: #ccc;
    margin-bottom: 1.5rem;
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
