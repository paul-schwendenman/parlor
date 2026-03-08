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
  import Hand from '$lib/components/game/Hand.svelte';
  import DiscardPile from '$lib/components/game/DiscardPile.svelte';
  import DrawPile from '$lib/components/game/DrawPile.svelte';
  import OpponentBar from '$lib/components/game/OpponentBar.svelte';
  import SuitPicker from '$lib/components/game/SuitPicker.svelte';
  import TurnBanner from '$lib/components/game/TurnBanner.svelte';
  import GameOverScreen from '$lib/components/game/GameOverScreen.svelte';
  import type { Card, Suit } from '$lib/types/game.js';

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

  function handlePlayCard(card: Card) {
    if (gameState.isCardSelected(card)) {
      // Second tap = confirm play
      getSocket().emit('game:action', { type: 'play-card', card });
      gameState.clearSelection();
    } else {
      gameState.selectCard(card);
    }
  }

  function handleDraw() {
    getSocket().emit('game:action', { type: 'draw-card' });
  }

  function handlePass() {
    getSocket().emit('game:action', { type: 'pass' });
  }

  function handleChooseSuit(suit: Suit) {
    getSocket().emit('game:action', { type: 'choose-suit', suit });
  }
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
{:else if view.gameOver}
  <GameOverScreen winner={view.winner} players={view.players} myPlayerId={playerState.id} />
{:else}
  <div class="game-page">
    <TurnBanner
      isActivePlayer={view.isActivePlayer}
      activePlayerName={gameState.activePlayerName}
      phase={view.phase}
      drewCard={view.drewCard !== null}
    />

    <OpponentBar
      players={view.players}
      activePlayerIndex={view.activePlayerIndex}
      myIndex={view.myIndex}
    />

    <div class="table-area">
      <DrawPile
        count={view.drawPileCount}
        canDraw={view.canDraw}
        ondraw={handleDraw}
      />
      <DiscardPile
        topCard={view.topDiscard}
        declaredSuit={view.declaredSuit}
      />
    </div>

    {#if view.canPass}
      <div class="pass-area">
        <button class="btn-pass" onclick={handlePass}>Pass</button>
      </div>
    {/if}

    <Hand cards={view.myHand} onplaycard={handlePlayCard} />

    {#if view.phase === 'choosing-suit' && view.isActivePlayer}
      <SuitPicker onchoose={handleChooseSuit} />
    {/if}
  </div>
{/if}

<style>
  .game-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }
  .table-area {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 32px;
    padding: 16px 0;
  }
  .pass-area {
    text-align: center;
    margin: 8px 0;
  }
  .btn-pass {
    padding: 8px 24px;
    border: none;
    border-radius: 8px;
    background: #6b7280;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-pass:hover {
    background: #4b5563;
  }
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
