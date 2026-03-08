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
  import DiceDisplay from '$lib/components/game/DiceDisplay.svelte';
  import Scoresheet from '$lib/components/game/Scoresheet.svelte';
  import PhaseIndicator from '$lib/components/game/PhaseIndicator.svelte';
  import PlayerList from '$lib/components/game/PlayerList.svelte';
  import GameOverScreen from '$lib/components/game/GameOverScreen.svelte';
  import TurnBanner from '$lib/components/game/TurnBanner.svelte';
  import OptionsSummary from '$lib/components/game/OptionsSummary.svelte';
  import type { RowColor } from '$lib/types/game.js';
  import { scoreRow } from '$lib/game/scoring.js';
  import { ROW_COLORS } from '$lib/types/game.js';

  let roomNotFound = $state(false);

  onMount(() => {
    if (browser) {
      getSocket();
    }
  });

  // Detect when we're connected but have no game state and no player session
  $effect(() => {
    if (connectionState.status !== 'connected') return;
    if (gameState.view) return;
    if (playerState.id) return;

    // Connected but no session and no game — room doesn't exist or session expired
    roomNotFound = true;
  });

  let view = $derived(gameState.view);
  let hadView = false;

  $effect(() => {
    if (view) {
      hadView = true;
    } else if (hadView) {
      // Game was reset, navigate back to lobby
      const roomCode = $page.params.roomCode;
      goto(`/lobby/${roomCode}`);
    }
  });

  let myScore = $derived.by(() => {
    if (!view) return 0;
    const me = view.players[view.myIndex];
    if (!me) return 0;
    let total = 0;
    for (const row of ROW_COLORS) {
      const hasLock = me.lockedRows.includes(row);
      total += scoreRow(me.sheet[row], hasLock);
    }
    total -= me.penalties * 5;
    return total;
  });

  let submittedCount = $derived(
    view ? view.players.filter((p) => p.phase1Submitted).length : 0,
  );

  function handleSelect(row: RowColor, cellIndex: number) {
    gameState.selectMove(row, cellIndex);
  }

  function handleConfirm() {
    if (!view || !gameState.selectedMove) return;
    const socket = getSocket();
    const { row, cellIndex } = gameState.selectedMove;
    if (view.phase === 'phase1') {
      socket.emit('game:action', { type: 'phase1-mark', row, cellIndex });
    } else if (view.phase === 'phase2') {
      socket.emit('game:action', { type: 'phase2-mark', row, cellIndex });
    }
  }

  function handlePass() {
    if (!view) return;
    const socket = getSocket();
    gameState.clearSelection();
    if (view.phase === 'phase1') {
      socket.emit('game:action', { type: 'phase1-pass' });
    } else if (view.phase === 'phase2') {
      socket.emit('game:action', { type: 'phase2-pass' });
    }
  }

  function handleRoll() {
    getSocket().emit('game:action', { type: 'roll-dice' });
  }

</script>

{#if !view}
  <div class="loading">
    <a href="/" class="header">
      <span class="parlor">Parlor</span>
      <span class="separator">/</span>
      <span class="game-name">Quixx</span>
    </a>
    {#if roomNotFound}
      <p class="error-message">This game doesn't exist or has ended.</p>
      <a href="/" class="back-link">Back to home</a>
    {:else}
      <p>Loading game...</p>
    {/if}
  </div>
{:else if view.gameOver && view.scores}
  <GameOverScreen scores={view.scores} players={view.players} myPlayerId={playerState.id} />
{:else}
  <div class="game-page">
    <TurnBanner
      round={view.round}
      isActivePlayer={view.isActivePlayer}
      activePlayerName={gameState.activePlayerName}
      phase={view.phase}
    />

    {#if view.dice.rolled}
      <DiceDisplay dice={view.dice} removedDice={view.removedDice} />
    {/if}

    <PhaseIndicator
      phase={view.phase}
      isActivePlayer={view.isActivePlayer}
      activePlayerName={gameState.activePlayerName}
      phase1Submitted={gameState.phase1Submitted}
      {submittedCount}
      totalPlayers={view.players.length}
      hasSelection={gameState.selectedMove !== null}
      activePlayerPhase1Passed={view.activePlayerPhase1Passed}
      onpass={handlePass}
      onroll={handleRoll}
      onconfirm={handleConfirm}
    />

    <OptionsSummary
      phase={view.phase}
      isActivePlayer={view.isActivePlayer}
      whiteSum={gameState.whiteSum}
      availableMoves={view.availableMoves}
      phase2Preview={gameState.phase2Preview}
      phase1Submitted={gameState.phase1Submitted}
    />

    <Scoresheet
      sheet={view.players[view.myIndex].sheet}
      penalties={view.players[view.myIndex].penalties}
      score={myScore}
      lockedRows={view.players[view.myIndex].lockedRows}
      availableMoves={view.availableMoves}
      selectedMove={gameState.selectedMove}
      phase2Preview={gameState.phase2Preview}
      onselect={handleSelect}
    />

    <PlayerList {view} />
  </div>
{/if}

<style>
  .game-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
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
