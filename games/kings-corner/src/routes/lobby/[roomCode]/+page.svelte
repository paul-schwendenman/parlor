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

<svelte:head><title>Lobby {roomCode} - Parlor Kings Corner</title></svelte:head>

{#if roomNotFound}
  <div class="loading">
    <a href="/" class="header">
      <span class="parlor">Parlor</span>
      <span class="separator">/</span>
      <span class="game-name">Kings Corner</span>
    </a>
    <p class="error-message">This lobby doesn't exist or has ended.</p>
    <a href="/" class="back-link">Back to home</a>
  </div>
{:else}
  <div class="lobby-page">
    <a href="/" class="header">
      <span class="parlor">Parlor</span>
      <span class="separator">/</span>
      <span class="game-name">Kings Corner</span>
    </a>
    <LobbyView {roomCode} />
  </div>
{/if}

<style>
  .loading {
    text-align: center;
    padding: 64px 16px;
    color: #6b7280;
  }
  .header {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    text-decoration: none;
    margin-bottom: 24px;
  }
  .parlor {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
  }
  .separator {
    font-size: 20px;
    color: #d1d5db;
  }
  .game-name {
    font-size: 20px;
    font-weight: 600;
    color: #6b7280;
  }
  .header:hover .parlor {
    color: #3b82f6;
  }
  .lobby-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    text-align: center;
  }
  .lobby-page .header {
    margin-bottom: 16px;
  }
  .error-message {
    color: #991b1b;
    font-size: 18px;
    margin-bottom: 16px;
  }
  .back-link {
    display: inline-block;
    padding: 10px 24px;
    background: #3b82f6;
    color: white;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
  }
  .back-link:hover {
    background: #2563eb;
  }
</style>
