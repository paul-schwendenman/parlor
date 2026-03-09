<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import type { Card, PilePosition, KingsCornerPlayerView } from '../../types/game.js';
  import { gameState } from '../../stores/gameStore.svelte.js';
  import Hand from './Hand.svelte';
  import BoardLayout from './BoardLayout.svelte';
  import OpponentBar from './OpponentBar.svelte';
  import TurnBanner from './TurnBanner.svelte';
  import GameOverScreen from './GameOverScreen.svelte';

  let {
    view,
    socket,
    playerId,
    onBackToLobby,
  }: {
    view: KingsCornerPlayerView;
    socket: GameSocket;
    playerId: string;
    onBackToLobby?: () => void;
  } = $props();

  let activePlayerName = $derived(
    view.players[view.activePlayerIndex]?.name ?? null,
  );

  // Sync view prop into gameState so child components can access playableCards, movablePiles, etc.
  $effect(() => {
    gameState.setView(view);
  });

  let canDraw = $derived(view.isActivePlayer && view.phase === 'drawing' && view.drawPileCount > 0);

  function handleDraw() {
    socket.emit('game:action', { type: 'draw-card' } as never);
    gameState.clearSelection();
  }

  function handleCardSelect(card: Card) {
    if (gameState.isCardSelected(card)) {
      // Deselect
      gameState.clearSelection();
    } else {
      gameState.selectCard(card);
    }
  }

  function handlePileClick(position: PilePosition) {
    // If we have a selected card and this pile is a valid target, play the card
    if (gameState.selectedCard && gameState.isValidTarget(position)) {
      socket.emit('game:action', {
        type: 'play-card',
        card: gameState.selectedCard,
        target: position,
      } as never);
      gameState.clearSelection();
      return;
    }

    // If we have a selected pile and this pile is a valid target, move the pile
    if (gameState.selectedPile && gameState.isValidTarget(position)) {
      socket.emit('game:action', {
        type: 'move-pile',
        from: gameState.selectedPile,
        to: position,
      } as never);
      gameState.clearSelection();
      return;
    }

    // If no card selected and this pile is movable, select it
    if (!gameState.selectedCard && gameState.isPileMovable(position)) {
      if (gameState.isPileSelected(position)) {
        gameState.clearSelection();
      } else {
        gameState.selectPile(position);
      }
      return;
    }

    // Otherwise clear selection
    gameState.clearSelection();
  }

  function handleEndTurn() {
    socket.emit('game:action', { type: 'end-turn' } as never);
    gameState.clearSelection();
  }
</script>

{#if view.gameOver}
  <GameOverScreen winner={view.winner} players={view.players} myPlayerId={playerId} />
{:else}
  <div class="game-page">
    <TurnBanner
      isActivePlayer={view.isActivePlayer}
      {activePlayerName}
      phase={view.phase}
      mustPlayKing={view.mustPlayKing}
      canEndTurn={view.canEndTurn}
    />

    <OpponentBar
      players={view.players}
      activePlayerIndex={view.activePlayerIndex}
      myIndex={view.myIndex}
    />

    <BoardLayout
      piles={view.piles}
      drawPileCount={view.drawPileCount}
      {canDraw}
      ondraw={handleDraw}
      onpileclick={handlePileClick}
    />

    {#if view.isActivePlayer && view.phase === 'playing'}
      <div class="actions-area">
        <button
          class="btn-end-turn"
          onclick={handleEndTurn}
          disabled={!view.canEndTurn}
        >
          End Turn
        </button>
      </div>
    {/if}

    <Hand cards={view.myHand} onplaycard={handleCardSelect} />
  </div>
{/if}

<style>
  .game-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }
  .actions-area {
    text-align: center;
    margin: 8px 0;
  }
  .btn-end-turn {
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
  .btn-end-turn:hover:not(:disabled) {
    background: #4b5563;
  }
  .btn-end-turn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
