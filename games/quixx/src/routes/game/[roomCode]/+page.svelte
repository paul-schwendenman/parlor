<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { getSocket } from '$lib/stores/socketClient.js';
  import DiceDisplay from '$lib/components/game/DiceDisplay.svelte';
  import Scoresheet from '$lib/components/game/Scoresheet.svelte';
  import PhaseIndicator from '$lib/components/game/PhaseIndicator.svelte';
  import PlayerList from '$lib/components/game/PlayerList.svelte';
  import GameOverScreen from '$lib/components/game/GameOverScreen.svelte';
  import type { RowColor } from '$lib/types/game.js';
  import { scoreRow } from '$lib/game/scoring.js';
  import { ROW_COLORS } from '$lib/types/game.js';

  onMount(() => {
    if (browser) {
      getSocket();
    }
  });

  let view = $derived(gameState.view);

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

  function handleMark(row: RowColor, cellIndex: number) {
    if (!view) return;
    const socket = getSocket();
    if (view.phase === 'phase1') {
      socket.emit('game:action', { type: 'phase1-mark', row, cellIndex });
    } else if (view.phase === 'phase2') {
      socket.emit('game:action', { type: 'phase2-mark', row, cellIndex });
    }
  }

  function handlePass() {
    if (!view) return;
    const socket = getSocket();
    if (view.phase === 'phase1') {
      socket.emit('game:action', { type: 'phase1-pass' });
    } else if (view.phase === 'phase2') {
      socket.emit('game:action', { type: 'phase2-pass' });
    }
  }

  function handleRoll() {
    getSocket().emit('game:action', { type: 'roll-dice' });
  }

  // If game resets, go back to lobby
  $effect(() => {
    if (!gameState.view && !lobbyState.gameStarting) {
      // Game was reset
    }
  });
</script>

{#if !view}
  <div class="loading">
    <p>Loading game...</p>
  </div>
{:else if view.gameOver && view.scores}
  <GameOverScreen scores={view.scores} myPlayerId={playerState.id} />
{:else}
  <div class="game-page">
    <div class="round-info">
      Round {view.round} &middot; {view.players[view.activePlayerIndex]?.name}'s turn
    </div>

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
      onpass={handlePass}
      onroll={handleRoll}
    />

    <Scoresheet
      sheet={view.players[view.myIndex].sheet}
      penalties={view.players[view.myIndex].penalties}
      score={myScore}
      lockedRows={view.players[view.myIndex].lockedRows}
      availableMoves={view.availableMoves}
      onmark={handleMark}
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
  .round-info {
    text-align: center;
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 12px;
  }
  .loading {
    text-align: center;
    padding: 64px 16px;
    color: #6b7280;
  }
</style>
