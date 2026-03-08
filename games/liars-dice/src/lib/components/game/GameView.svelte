<script lang="ts">
  import { Modal } from '@parlor/ui';
  import RulesDrawer from '../ui/RulesDrawer.svelte';
  import type { LiarsDicePlayerView } from '../../types/game.js';
  import type { GameSocket } from '@parlor/multiplayer/client';

  interface Props {
    view: LiarsDicePlayerView;
    socket: GameSocket;
    playerId: string;
    onBackToLobby: () => void;
  }

  let { view, socket, playerId, onBackToLobby }: Props = $props();

  let showRules = $state(false);
  let showWinner = $state(false);
  let bidQuantity = $state(1);
  let bidFaceValue = $state(2);

  // Show winner modal when game ends
  $effect(() => {
    if (view?.gameOver && view.winner) {
      showWinner = true;
    }
  });

  // Update bid inputs when minimum bid changes
  $effect(() => {
    if (view?.minimumBid) {
      bidQuantity = view.minimumBid.quantity;
      bidFaceValue = view.minimumBid.faceValue;
    }
  });

  let activePlayer = $derived(view ? view.players[view.activePlayerIndex] ?? null : null);
  let isMyTurn = $derived(view?.isMyTurn ?? false);
  let isRevealing = $derived(
    view?.phase === 'challenge' || view?.phase === 'spot-on',
  );

  let winnerName = $derived.by(() => {
    if (!view?.winner) return '';
    return view.players.find((p) => p.id === view!.winner)?.name ?? 'Unknown';
  });

  function placeBid() {
    socket.emit('game:action', {
      type: 'bid',
      quantity: bidQuantity,
      faceValue: bidFaceValue,
    });
  }

  function callChallenge() {
    socket.emit('game:action', { type: 'challenge' });
  }

  function callSpotOn() {
    socket.emit('game:action', { type: 'spot-on' });
  }

  function nextRound() {
    socket.emit('game:action', { type: 'nextRound' });
  }

  function backToLobby() {
    onBackToLobby();
  }

  function dieFace(value: number): string {
    const faces = ['', '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];
    return faces[value] ?? '?';
  }

  function isHighlighted(dieValue: number): boolean {
    if (!view?.currentBid || !isRevealing) return false;
    const bidFace = view.currentBid.faceValue;
    if (dieValue === bidFace) return true;
    if (dieValue === 1 && bidFace !== 1) return true; // wild ones
    return false;
  }
</script>

<main class="container">
  <div class="game-header">
    <div class="header-spacer"></div>
    <div class="turn-info">
      {#if view.phase === 'game-over'}
        <span class="turn-label">Game Over</span>
      {:else if isRevealing}
        <span class="turn-label">
          {view.phase === 'challenge' ? 'Challenge!' : 'Spot On!'}
        </span>
      {:else if activePlayer}
        <span class="turn-label">
          {isMyTurn ? 'Your Turn' : `${activePlayer.name}'s Turn`}
        </span>
      {/if}
      <span class="dice-count">{view.totalDiceInPlay} dice in play &middot; Round {view.round}</span>
    </div>
    <button class="rules-btn" onclick={() => (showRules = true)} aria-label="Show rules">
      ?
    </button>
  </div>

  <div class="game-layout">
    <div class="main-area">
      <!-- Current bid display -->
      {#if view.currentBid}
        <div class="current-bid" class:challenged={isRevealing}>
          <span class="bid-label">Current Bid</span>
          <span class="bid-value">
            {view.currentBid.quantity} &times; {dieFace(view.currentBid.faceValue)}
          </span>
          <span class="bid-by">
            by {view.players.find((p) => p.id === view.currentBid?.playerId)?.name ?? '?'}
          </span>
        </div>
      {:else if view.phase === 'bidding'}
        <div class="current-bid">
          <span class="bid-label">Opening Bid</span>
          <span class="bid-value no-bid">No bids yet</span>
        </div>
      {/if}

      <!-- My dice -->
      {#if !isRevealing && view.myDice.length > 0}
        <div class="my-dice-section">
          <span class="section-label">Your Dice</span>
          <div class="dice-row">
            {#each view.myDice as die}
              <span class="die my-die">{dieFace(die)}</span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Reveal: show all dice -->
      {#if isRevealing && view.revealedDice}
        <div class="reveal-section">
          {#each view.players.filter((p) => !p.eliminated) as player (player.id)}
            <div class="reveal-player">
              <span class="reveal-name">{player.name}</span>
              <div class="dice-row">
                {#each view.revealedDice[player.id] ?? [] as die}
                  <span class="die" class:highlighted={isHighlighted(die)}>{dieFace(die)}</span>
                {/each}
              </div>
            </div>
          {/each}

          <div class="reveal-result">
            {#if view.currentBid}
              <p class="result-count">
                {view.currentBid.faceValue}s{view.currentBid.faceValue !== 1 ? ' + wild 1s' : ''} = <strong>{view.actualCount}</strong> total
              </p>
            {/if}

            {#if view.challengeResult}
              <p class="result-outcome" class:correct={view.challengeResult.bidWasCorrect} class:wrong={!view.challengeResult.bidWasCorrect}>
                Bid was {view.challengeResult.bidWasCorrect ? 'correct' : 'wrong'}!
                {view.players.find((p) => p.id === view.challengeResult?.loserId)?.name} loses a die.
              </p>
            {/if}

            {#if view.spotOnResult}
              <p class="result-outcome" class:correct={view.spotOnResult.wasExact} class:wrong={!view.spotOnResult.wasExact}>
                {view.spotOnResult.wasExact
                  ? 'Spot on! Everyone else loses a die!'
                  : `Not exact! ${view.players.find((p) => p.id === view.spotOnResult?.callerId)?.name} loses a die.`}
              </p>
            {/if}

            {#if !view.gameOver}
              <button class="btn btn-primary" onclick={nextRound}>Next Round</button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Bidding controls -->
      {#if isMyTurn && view.phase === 'bidding'}
        <div class="bidding-controls">
          <div class="bid-inputs">
            <div class="bid-field">
              <label for="bid-qty">Quantity</label>
              <div class="qty-control">
                <button class="qty-btn" onclick={() => bidQuantity = Math.max(1, bidQuantity - 1)} disabled={bidQuantity <= 1}>&minus;</button>
                <span class="qty-value">{bidQuantity}</span>
                <button class="qty-btn" onclick={() => bidQuantity++}>+</button>
              </div>
            </div>

            <div class="bid-field">
              <label for="bid-face">Face</label>
              <div class="face-selector">
                {#each [1, 2, 3, 4, 5, 6] as face}
                  <button
                    class="face-btn"
                    class:selected={bidFaceValue === face}
                    onclick={() => bidFaceValue = face}
                  >
                    {dieFace(face)}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <button class="btn btn-primary" onclick={placeBid}>
            Bid {bidQuantity} &times; {dieFace(bidFaceValue)}
          </button>

          {#if view.canChallenge}
            <div class="challenge-actions">
              <button class="btn btn-danger" onclick={callChallenge}>
                Liar!
              </button>
              {#if view.canSpotOn}
                <button class="btn btn-accent" onclick={callSpotOn}>
                  Spot On
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {:else if view.phase === 'bidding' && !isMyTurn && activePlayer}
        <p class="waiting-msg">Waiting for {activePlayer.name}...</p>
      {/if}
    </div>

    <div class="sidebar">
      <div class="players-section">
        <h3>Players</h3>
        <div class="players-list">
          {#each view.players as player, i (player.id)}
            <div
              class="player-row"
              class:active={i === view.activePlayerIndex && !isRevealing && !view.gameOver}
              class:eliminated={player.eliminated}
              class:is-me={player.id === view.players[view.myIndex]?.id}
            >
              <div class="player-info">
                <span class="player-name">{player.name}</span>
                {#if player.id === view.players[view.myIndex]?.id}
                  <span class="badge">You</span>
                {/if}
              </div>
              <div class="player-dice-count">
                {#if player.eliminated}
                  <span class="eliminated-text">Out</span>
                {:else}
                  {#each Array(player.diceCount) as _}
                    <span class="mini-die">{'\u25A0'}</span>
                  {/each}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Bid history -->
      {#if view.bidHistory.length > 0}
        <div class="bid-history">
          <h3>Bid History</h3>
          <div class="history-list">
            {#each view.bidHistory.toReversed() as bid, i (i)}
              <div class="history-entry">
                <span class="history-name">
                  {view.players.find((p) => p.id === bid.playerId)?.name ?? '?'}
                </span>
                <span class="history-bid">
                  {bid.quantity} &times; {dieFace(bid.faceValue)}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>

  <Modal bind:open={showWinner} title="Game Over!">
    <div class="winner-content">
      <p class="winner-name">{winnerName}</p>
      <p class="winner-reason">wins the game!</p>
      <button class="btn btn-primary" onclick={backToLobby}>Play Again</button>
    </div>
  </Modal>

  <RulesDrawer open={showRules} onclose={() => (showRules = false)} />
</main>

<style>
  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1rem;
    min-height: 100vh;
  }

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .header-spacer { width: 36px; flex-shrink: 0; }

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

  .dice-count { color: #888; font-size: 0.9rem; }

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

  .rules-btn:hover { background: #3a3a3a; border-color: #d4a574; }

  .game-layout {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 2rem;
  }

  @media (max-width: 800px) {
    .game-layout { grid-template-columns: 1fr; }
  }

  .main-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  /* Current bid */
  .current-bid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 1.25rem 2rem;
    background: #2a2a2a;
    border-radius: 12px;
    border: 2px solid #333;
    min-width: 200px;
  }

  .current-bid.challenged { border-color: #c44; background: #2a1a1a; }

  .bid-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
  }

  .bid-value { font-size: 2rem; font-weight: bold; color: #eee; }
  .bid-value.no-bid { font-size: 1rem; color: #666; }
  .bid-by { font-size: 0.85rem; color: #888; }

  /* Dice */
  .my-dice-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .section-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
  }

  .dice-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .die {
    font-size: 2.5rem;
    line-height: 1;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #333;
    border-radius: 8px;
    border: 2px solid #444;
  }

  .die.my-die { border-color: #d97706; background: #3a2a1a; }
  .die.highlighted { border-color: #16a34a; background: #1a3a1a; }

  /* Reveal */
  .reveal-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .reveal-player {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #2a2a2a;
    border-radius: 8px;
  }

  .reveal-name {
    font-weight: 600;
    color: #d4a574;
    min-width: 80px;
    font-size: 0.9rem;
  }

  .reveal-result {
    text-align: center;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  .result-count { color: #ccc; font-size: 1.1rem; }
  .result-count strong { color: #eee; font-size: 1.25rem; }

  .result-outcome { font-size: 1.1rem; font-weight: 600; }
  .result-outcome.correct { color: #16a34a; }
  .result-outcome.wrong { color: #ef4444; }

  /* Bidding controls */
  .bidding-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    padding: 1.5rem;
    background: #2a2a2a;
    border-radius: 12px;
    width: 100%;
    max-width: 400px;
  }

  .bid-inputs {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .bid-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .bid-field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .qty-control {
    display: flex;
    align-items: center;
    gap: 0;
    background: #333;
    border-radius: 8px;
    border: 1.5px solid #444;
    overflow: hidden;
  }

  .qty-btn {
    width: 44px;
    height: 44px;
    background: #3a3a3a;
    border: none;
    color: #eee;
    font-size: 1.25rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .qty-btn:hover:not(:disabled) { background: #444; }
  .qty-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .qty-value {
    flex: 1;
    text-align: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: #eee;
  }

  .face-selector {
    display: flex;
    gap: 0.25rem;
  }

  .face-btn {
    width: 48px;
    height: 48px;
    font-size: 1.75rem;
    background: #333;
    border: 2px solid #444;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .face-btn:hover { border-color: #888; }
  .face-btn.selected { border-color: #d97706; background: #3a2a1a; }

  .challenge-actions {
    display: flex;
    gap: 0.75rem;
    width: 100%;
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

  .btn-primary { background: #d97706; color: white; }
  .btn-primary:hover { background: #b45309; }

  .btn-danger {
    background: #dc2626;
    color: white;
    flex: 1;
    font-size: 1.1rem;
    padding: 1rem;
  }

  .btn-danger:hover { background: #b91c1c; }

  .btn-accent {
    background: #2563eb;
    color: white;
    flex: 1;
    font-size: 1.1rem;
    padding: 1rem;
  }

  .btn-accent:hover { background: #1d4ed8; }

  .waiting-msg { color: #888; font-style: italic; }

  /* Sidebar */
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }

  .players-section h3,
  .bid-history h3 {
    font-size: 0.9rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.5rem;
  }

  .players-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .player-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    background: #2a2a2a;
    border: 1.5px solid transparent;
    transition: all 0.2s;
  }

  .player-row.active { border-color: #d97706; background: #2d2a1a; }
  .player-row.is-me { border-color: #555; }
  .player-row.active.is-me { border-color: #d97706; }
  .player-row.eliminated { opacity: 0.4; }

  .player-info { display: flex; align-items: center; gap: 0.5rem; }
  .player-name { font-weight: 600; font-size: 0.9rem; color: #eee; }

  .badge {
    font-size: 0.6rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
    background: #4a3a2a;
    color: #d4a574;
  }

  .player-dice-count {
    display: flex;
    gap: 0.2rem;
    align-items: center;
  }

  .mini-die { color: #d4a574; font-size: 0.6rem; }
  .eliminated-text { font-size: 0.75rem; color: #666; font-style: italic; }

  /* Bid history */
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .history-entry {
    display: flex;
    justify-content: space-between;
    padding: 0.4rem 0.6rem;
    background: #252525;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .history-name { color: #888; }
  .history-bid { color: #eee; font-weight: 600; }

  /* Winner */
  .winner-content { text-align: center; }
  .winner-name { font-size: 2rem; font-weight: bold; color: #d4a574; margin-bottom: 0.5rem; }
  .winner-reason { color: #888; margin-bottom: 1.5rem; }
</style>
