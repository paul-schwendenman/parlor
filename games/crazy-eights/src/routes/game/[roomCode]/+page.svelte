<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { connectionState } from '$lib/stores/connectionStore.svelte.js';
  import { getSocket } from '$lib/stores/socketClient.js';
  import GameView from '$lib/components/game/GameView.svelte';

  let roomNotFound = $state(false);

  onMount(() => {
    if (browser) {
      getSocket();
    }
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
      const roomCode = $page.params.roomCode;
      goto(`/lobby/${roomCode}`);
    }
  });
</script>

<svelte:head><title>Crazy Eights - Parlor</title></svelte:head>

{#if !view}
  <div class="loading">
    <a href="/" class="header">
      <span class="parlor">Parlor</span>
      <span class="separator">/</span>
      <span class="game-name">Crazy Eights</span>
    </a>
    {#if roomNotFound}
      <p class="error-message">This game doesn't exist or has ended.</p>
      <a href="/" class="back-link">Back to home</a>
    {:else}
      <p>Loading game...</p>
    {/if}
  </div>
{:else}
  <GameView {view} socket={getSocket()} playerId={playerState.id} />
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
