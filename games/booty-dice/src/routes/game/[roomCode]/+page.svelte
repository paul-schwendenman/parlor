<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { connectionState } from '$lib/stores/connectionStore.svelte.js';
  import { getSocket } from '$lib/stores/socketClient.js';
  import { Modal } from '@parlor/ui';
  import RulesDrawer from '$lib/components/ui/RulesDrawer.svelte';
  import DiceBoard from '$lib/components/game/DiceBoard.svelte';
  import PlayerCard from '$lib/components/game/PlayerCard.svelte';
  import GameLog from '$lib/components/game/GameLog.svelte';
  import type { PendingAction } from '$lib/types/game.js';

  let roomCode = $derived($page.params.roomCode ?? '');
  let roomNotFound = $state(false);
  let showRules = $state(false);
  let showWinner = $state(false);
  let selectingTargetFor = $state<PendingAction | null>(null);

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

  // Show winner modal when game ends
  $effect(() => {
    if (view?.phase === 'ended' && view.winnerId) {
      showWinner = true;
    }
  });

  let currentPlayer = $derived(gameState.currentPlayer);
  let isMyTurn = $derived(gameState.isMyTurn);
  let targets = $derived(gameState.otherAlivePlayers);

  let unresolvedActions = $derived(
    view ? view.pendingActions.filter((a) => !a.resolved) : [],
  );
  let canRoll = $derived(
    isMyTurn && view && view.rollsRemaining > 0 && view.turnPhase === 'rolling',
  );
  let hasRolled = $derived(view && view.rollsRemaining < 3);
  let canFinishRolling = $derived(
    isMyTurn && view && view.turnPhase === 'rolling' && hasRolled,
  );
  let needsTargetSelection = $derived(
    isMyTurn && view && view.turnPhase === 'selecting_targets' && unresolvedActions.length > 0,
  );
  let canEndTurn = $derived(
    isMyTurn && view && hasRolled && unresolvedActions.length === 0 && view.turnPhase !== 'rolling',
  );

  let winnerName = $derived.by(() => {
    if (!view || !view.winnerId) return '';
    return view.players.find((p) => p.id === view!.winnerId)?.name ?? 'Unknown';
  });

  let winReason = $derived.by(() => {
    if (!view || !view.winnerId) return '';
    const winner = view.players.find((p) => p.id === view!.winnerId);
    return winner && winner.doubloons >= 25
      ? 'riches'
      : 'being the last pirate standing';
  });

  function toggleDiceLock(index: number) {
    if (!view || !isMyTurn || view.turnPhase !== 'rolling') return;

    const currentLocked = view.dice.filter((d) => d.locked).map((d) => d.id);
    let newLocked: number[];
    if (currentLocked.includes(index)) {
      newLocked = currentLocked.filter((i) => i !== index);
    } else {
      newLocked = [...currentLocked, index];
    }

    getSocket().emit('game:action', { type: 'lockDice', diceIndices: newLocked });
  }

  function roll() {
    getSocket().emit('game:action', { type: 'roll' });
  }

  function finishRolling() {
    getSocket().emit('game:action', { type: 'finishRolling' });
  }

  function selectTarget(targetId: string) {
    if (!selectingTargetFor) return;
    getSocket().emit('game:action', {
      type: 'selectTarget',
      dieIndex: selectingTargetFor.dieIndex,
      targetPlayerId: targetId,
    });
    selectingTargetFor = null;
  }

  function endTurn() {
    getSocket().emit('game:action', { type: 'endTurn' });
  }

  function startTargetSelection(action: PendingAction) {
    selectingTargetFor = action;
  }

  function backToLobby() {
    getSocket().emit('lobby:resetGame');
    gameState.reset();
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
  <main class="container">
    <div class="game-header">
      <div class="header-spacer"></div>
      <div class="turn-info">
        {#if currentPlayer}
          <span class="turn-label">
            {isMyTurn ? "Your Turn" : `${currentPlayer.name}'s Turn`}
          </span>
          <span class="rolls-left">Rolls left: {view.rollsRemaining}</span>
        {/if}
      </div>
      <button class="rules-btn" onclick={() => (showRules = true)} aria-label="Show rules">
        ?
      </button>
    </div>

    <div class="game-layout">
      <div class="main-area">
        <DiceBoard
          dice={view.dice}
          canSelect={isMyTurn && view.turnPhase === 'rolling' && view.rollsRemaining < 3}
          onToggleLock={toggleDiceLock}
        />

        {#if isMyTurn}
          <div class="action-buttons">
            {#if canRoll}
              <button class="btn btn-primary" onclick={roll}>
                {view.rollsRemaining === 3 ? 'Roll Dice!' : 'Roll Again'}
              </button>
            {/if}

            {#if canFinishRolling}
              <button class="btn btn-secondary" onclick={finishRolling}>
                Resolve Dice
              </button>
            {/if}

            {#if needsTargetSelection}
              <div class="target-prompt">
                <p>Select targets for your attacks/steals:</p>
                {#each unresolvedActions as action (action.dieIndex)}
                  <button
                    class="btn btn-secondary"
                    onclick={() => startTargetSelection(action)}
                  >
                    {action.face === 'cutlass' ? '\u2694\uFE0F Attack' : '\u2620\uFE0F Steal'} (Die #{action.dieIndex + 1})
                  </button>
                {/each}
              </div>
            {/if}

            {#if canEndTurn}
              <button class="btn btn-primary" onclick={endTurn}>End Turn</button>
            {/if}
          </div>
        {:else if currentPlayer}
          <p class="waiting-msg">Waiting for {currentPlayer.name}...</p>
        {/if}
      </div>

      <div class="sidebar">
        <div class="players-section">
          <h3>Pirates</h3>
          <div class="players-list">
            {#each view.players as gamePlayer (gamePlayer.id)}
              <PlayerCard
                player={gamePlayer}
                isCurrentTurn={gamePlayer.id === currentPlayer?.id}
                isMe={gamePlayer.id === view.players[view.myIndex]?.id}
                isTargetable={selectingTargetFor !== null &&
                  gamePlayer.id !== view.players[view.myIndex]?.id &&
                  !gamePlayer.isEliminated}
                onSelect={() => selectTarget(gamePlayer.id)}
              />
            {/each}
          </div>
        </div>

        <GameLog entries={view.gameLog} />
      </div>
    </div>

    {#if selectingTargetFor}
      <div class="target-overlay" onclick={() => (selectingTargetFor = null)} role="presentation">
        <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
        <div class="target-modal" onclick={(e) => e.stopPropagation()} role="dialog">
          <h3>
            Select target for {selectingTargetFor.face === 'cutlass' ? '\u2694\uFE0F Cutlass Attack' : '\u2620\uFE0F Jolly Roger Steal'}
          </h3>
          <div class="target-list">
            {#each targets as target (target.id)}
              <button class="target-btn" onclick={() => selectTarget(target.id)}>
                <span class="target-name">{target.name}</span>
                <span class="target-stats">
                  {'\u{1FA99}'}{target.doubloons} {'\u2764\uFE0F'}{target.lives} {'\u{1F6E1}\uFE0F'}{target.shields}
                </span>
              </button>
            {/each}
          </div>
          <button class="btn btn-secondary" onclick={() => (selectingTargetFor = null)}>
            Cancel
          </button>
        </div>
      </div>
    {/if}

    <Modal bind:open={showWinner} title="Victory!">
      <div class="winner-content">
        <p class="winner-name">{winnerName}</p>
        <p class="winner-reason">wins by {winReason}!</p>
        <button class="btn btn-primary" onclick={backToLobby}>Play Again</button>
      </div>
    </Modal>

    <RulesDrawer open={showRules} onclose={() => (showRules = false)} />
  </main>
{/if}

<style>
  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1rem;
    min-height: 100vh;
  }

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

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .header-spacer {
    width: 36px;
    flex-shrink: 0;
  }

  .turn-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    text-align: center;
  }

  .turn-label {
    font-size: 1.5rem;
    font-weight: bold;
    color: #d4a574;
  }

  .rolls-left {
    color: #888;
  }

  .rules-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #333;
    border: 2px solid #444;
    color: #d4a574;
    font-size: 1.25rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .rules-btn:hover {
    background: #3a3a3a;
    border-color: #d4a574;
  }

  .game-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 2rem;
  }

  @media (max-width: 800px) {
    .game-layout {
      grid-template-columns: 1fr;
    }
  }

  .main-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  .btn {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
  }

  .btn:active { transform: scale(0.98); }

  .btn-primary {
    background: #d97706;
    color: white;
  }

  .btn-primary:hover {
    background: #b45309;
  }

  .btn-secondary {
    background: #333;
    color: #eee;
    border: 1px solid #444;
  }

  .btn-secondary:hover {
    background: #3a3a3a;
  }

  .target-prompt {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    padding: 1rem;
    background: #2a2a2a;
    border-radius: 8px;
  }

  .target-prompt p {
    color: #888;
    margin-bottom: 0.5rem;
  }

  .waiting-msg {
    color: #888;
    font-style: italic;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }

  .players-section {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex-shrink: 1;
  }

  .players-section h3 {
    font-size: 0.9rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.5rem;
    flex-shrink: 0;
  }

  .players-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow-y: auto;
    max-height: 50vh;
  }

  .target-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .target-modal {
    background: #2a2a2a;
    padding: 2rem;
    border-radius: 12px;
    max-width: 400px;
    width: 90%;
  }

  .target-modal h3 {
    text-align: center;
    margin-bottom: 1.5rem;
    color: #d4a574;
  }

  .target-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
    max-height: 50vh;
    overflow-y: auto;
  }

  .target-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #333;
    border: 2px solid #444;
    border-radius: 8px;
    color: #eee;
    cursor: pointer;
    transition: all 0.2s;
  }

  .target-btn:hover {
    border-color: #c44;
    background: #3a2a2a;
  }

  .target-name {
    font-weight: 600;
  }

  .target-stats {
    font-size: 0.9rem;
    color: #888;
  }

  .winner-content {
    text-align: center;
  }

  .winner-name {
    font-size: 2rem;
    font-weight: bold;
    color: #d4a574;
    margin-bottom: 0.5rem;
  }

  .winner-reason {
    color: #888;
    margin-bottom: 1.5rem;
  }
</style>
