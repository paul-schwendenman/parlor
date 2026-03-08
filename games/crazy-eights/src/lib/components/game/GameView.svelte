<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import type { Card, Suit, CrazyEightsPlayerView } from '../../types/game.js';
  import Hand from './Hand.svelte';
  import DiscardPile from './DiscardPile.svelte';
  import DrawPile from './DrawPile.svelte';
  import OpponentBar from './OpponentBar.svelte';
  import SuitPicker from './SuitPicker.svelte';
  import TurnBanner from './TurnBanner.svelte';
  import GameOverScreen from './GameOverScreen.svelte';

  let {
    view,
    socket,
    playerId,
  }: {
    view: CrazyEightsPlayerView;
    socket: GameSocket;
    playerId: string;
  } = $props();

  let selectedCard = $state<Card | null>(null);

  function cardEquals(a: Card, b: Card): boolean {
    return a.suit === b.suit && a.rank === b.rank;
  }

  function isCardSelected(card: Card): boolean {
    return selectedCard !== null && cardEquals(selectedCard, card);
  }

  let activePlayerName = $derived(
    view.players[view.activePlayerIndex]?.name ?? null,
  );

  function handlePlayCard(card: Card) {
    if (isCardSelected(card)) {
      socket.emit('game:action', { type: 'play-card', card });
      selectedCard = null;
    } else {
      selectedCard = card;
    }
  }

  function handleDraw() {
    socket.emit('game:action', { type: 'draw-card' });
  }

  function handlePass() {
    socket.emit('game:action', { type: 'pass' });
  }

  function handleChooseSuit(suit: Suit) {
    socket.emit('game:action', { type: 'choose-suit', suit });
  }
</script>

{#if view.gameOver}
  <GameOverScreen winner={view.winner} players={view.players} myPlayerId={playerId} />
{:else}
  <div class="game-page">
    <TurnBanner
      isActivePlayer={view.isActivePlayer}
      activePlayerName={activePlayerName}
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
</style>
