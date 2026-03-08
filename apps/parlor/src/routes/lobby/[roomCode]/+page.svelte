<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { playerState } from '$lib/stores/playerStore.svelte.js';
  import { connectionState } from '$lib/stores/connectionStore.svelte.js';
  import { getSocket, selectGameAction } from '$lib/stores/socketClient.js';
  import type { GameMeta } from '@parlor/game-types';

  const games: GameMeta[] = [
    { id: 'quixx', name: 'Quixx', description: 'Fast-paced dice game', minPlayers: 2, maxPlayers: 5, estimatedMinutes: '15-20', tags: ['dice', 'strategy'], displayModes: ['peer'] },
    { id: 'crazy-eights', name: 'Crazy Eights', description: 'Classic card game', minPlayers: 2, maxPlayers: 5, estimatedMinutes: '10-15', tags: ['cards', 'classic'], displayModes: ['peer'] },
    { id: 'booty-dice', name: 'Booty Dice', description: 'Pirate dice game', minPlayers: 2, maxPlayers: 6, estimatedMinutes: '15-30', tags: ['dice', 'pirates'], displayModes: ['peer'] },
  ];

  let roomCode = $derived($page.params.roomCode ?? '');
  let roomNotFound = $state(false);
  let copied = $state(false);

  onMount(() => {
    if (browser) getSocket();
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

  let isHost = $derived(lobbyState.hostId === playerState.id);
  let me = $derived(lobbyState.players.find(p => p.id === playerState.id));
  let selectedGame = $derived(games.find(g => g.id === lobbyState.selectedGameId));
  let canStart = $derived(lobbyState.canStart && !!lobbyState.selectedGameId);

  function toggleReady() {
    if (me) getSocket().emit('lobby:ready', !me.isReady);
  }

  function startGame() {
    getSocket().emit('lobby:startGame');
  }

  function selectGame(gameId: string) {
    selectGameAction(gameId);
  }

  function addBot() {
    getSocket().emit('lobby:addBot', (success, error) => {
      if (!success) console.error('Failed to add bot:', error);
    });
  }

  function removeBot(botId: string) {
    getSocket().emit('lobby:removeBot', botId, (success, error) => {
      if (!success) console.error('Failed to remove bot:', error);
    });
  }

  async function copyCode() {
    try {
      const url = window.location.origin + '?join=' + roomCode;
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      await navigator.clipboard.writeText(roomCode);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }
</script>

<svelte:head><title>Lobby {roomCode} - Parlor</title></svelte:head>

{#if roomNotFound}
  <div class="center-message">
    <h1 class="logo">Parlor</h1>
    <p class="error-message">This lobby doesn't exist or has ended.</p>
    <a href="/" class="back-link">Back to home</a>
  </div>
{:else}
  <div class="lobby">
    <a href="/" class="back-home">Parlor</a>

    <div class="room-header">
      <p class="room-label">Room Code</p>
      <button class="code-display" onclick={copyCode} title="Copy invite link">
        <span class="code-text">{roomCode}</span>
        <span class="copy-hint">{copied ? 'Copied!' : 'Copy link'}</span>
      </button>
    </div>

    <!-- Game Selector (host only, or display selected game) -->
    <div class="game-selector">
      {#if selectedGame}
        <div class="selected-game">
          <span class="selected-label">Playing</span>
          <span class="selected-name">{selectedGame.name}</span>
          {#if isHost}
            <button class="change-btn" onclick={() => lobbyState.selectedGameId = null}>Change</button>
          {/if}
        </div>
      {:else if isHost}
        <div class="game-picker">
          <p class="picker-label">Choose a game</p>
          <div class="picker-options">
            {#each games as game (game.id)}
              <button class="picker-card" onclick={() => selectGame(game.id)}>
                <span class="picker-name">{game.name}</span>
                <span class="picker-info">{game.minPlayers}-{game.maxPlayers}p</span>
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <p class="waiting-game">Waiting for host to choose a game...</p>
      {/if}
    </div>

    <!-- Players -->
    <div class="players-section">
      <h3 class="players-heading">Players <span class="count">{lobbyState.players.length}</span></h3>
      <div class="player-list">
        {#each lobbyState.players as player}
          <div class="player" class:ready={player.isReady} class:me={player.id === playerState.id}>
            <div class="player-info">
              <span class="player-name">{player.name}</span>
              <div class="badges">
                {#if player.id === lobbyState.hostId}
                  <span class="badge badge-host">Host</span>
                {/if}
                {#if player.id === playerState.id}
                  <span class="badge badge-you">You</span>
                {/if}
                {#if player.isBot}
                  <span class="badge badge-bot">Bot</span>
                {/if}
              </div>
            </div>
            <div class="player-actions">
              <span class="ready-status" class:is-ready={player.isReady}>
                {player.isReady ? 'Ready' : 'Waiting'}
              </span>
              {#if isHost && player.isBot}
                <button class="btn-remove-bot" onclick={() => removeBot(player.id)} title="Remove bot">✕</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button class="btn btn-ready" class:is-ready={me?.isReady} onclick={toggleReady}>
        {me?.isReady ? 'Not Ready' : 'Ready Up'}
      </button>

      {#if isHost}
        <button class="btn btn-add-bot" onclick={addBot}>
          Add Bot
        </button>
        <button class="btn btn-start" onclick={startGame} disabled={!canStart}>
          Start Game
        </button>
        {#if !canStart}
          <p class="hint">
            {#if !lobbyState.selectedGameId}
              Select a game first
            {:else if lobbyState.players.length < 2}
              Need at least 2 players
            {:else}
              Waiting for all players to ready up
            {/if}
          </p>
        {/if}
      {:else}
        <p class="hint">Waiting for host to start...</p>
      {/if}
    </div>

    {#if lobbyState.gameStarting}
      <div class="starting">Game starting...</div>
    {/if}
  </div>
{/if}

<style>
  .lobby {
    max-width: 480px;
    margin: 0 auto;
    padding: 2rem 1rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .back-home {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-espresso);
    text-decoration: none;
    margin-bottom: 1.5rem;
    transition: color 0.2s;
  }

  .back-home:hover {
    color: var(--color-terracotta);
  }

  .center-message {
    text-align: center;
    padding: 64px 16px;
  }

  .logo {
    font-family: var(--font-heading);
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--color-espresso);
    margin: 0 0 1rem;
  }

  .error-message {
    color: #991b1b;
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }

  .back-link {
    display: inline-block;
    padding: 0.7rem 1.5rem;
    background: var(--color-terracotta);
    color: white;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
  }

  .room-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .room-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #a8a29e;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin: 0 0 0.5rem;
  }

  .code-display {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    background: white;
    border: 1.5px solid var(--color-linen);
    border-radius: 12px;
    padding: 1rem 2rem;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .code-display:hover {
    border-color: var(--color-terracotta);
    box-shadow: 0 2px 8px rgba(196, 102, 58, 0.1);
  }

  .code-text {
    font-family: var(--font-heading);
    font-size: 2.25rem;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: var(--color-espresso);
  }

  .copy-hint {
    font-size: 0.75rem;
    color: #a8a29e;
    font-weight: 500;
  }

  .code-display:hover .copy-hint {
    color: var(--color-terracotta);
  }

  /* Game Selector */
  .game-selector {
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .selected-game {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: white;
    border: 1.5px solid var(--color-forest);
    border-radius: 10px;
  }

  .selected-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-forest);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .selected-name {
    font-family: var(--font-heading);
    font-weight: 700;
    color: var(--color-espresso);
  }

  .change-btn {
    margin-left: auto;
    background: none;
    border: 1px solid #e7e5e4;
    border-radius: 6px;
    padding: 0.25rem 0.75rem;
    font-size: 0.8rem;
    color: #78716c;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }

  .change-btn:hover {
    color: var(--color-terracotta);
    border-color: var(--color-terracotta);
  }

  .game-picker {
    text-align: center;
  }

  .picker-label {
    font-size: 0.85rem;
    color: #a8a29e;
    margin: 0 0 0.75rem;
  }

  .picker-options {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .picker-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.75rem 1.25rem;
    background: white;
    border: 1.5px solid var(--color-linen);
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .picker-card:hover {
    border-color: var(--color-terracotta);
    box-shadow: 0 2px 8px rgba(196, 102, 58, 0.1);
  }

  .picker-name {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--color-espresso);
  }

  .picker-info {
    font-size: 0.75rem;
    color: #a8a29e;
  }

  .waiting-game {
    text-align: center;
    color: #a8a29e;
    font-style: italic;
    font-size: 0.9rem;
  }

  /* Players */
  .players-section {
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .players-heading {
    font-family: var(--font-heading);
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--color-espresso);
    margin: 0 0 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .count {
    font-family: var(--font-body);
    font-size: 0.8rem;
    font-weight: 600;
    color: #a8a29e;
    background: var(--color-linen);
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
  }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .player {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    background: white;
    border: 1.5px solid var(--color-linen);
    transition: border-color 0.2s, background 0.2s;
  }

  .player.ready {
    background: #fefce8;
    border-color: var(--color-mustard);
  }

  .player.me {
    border-color: var(--color-terracotta);
  }

  .player-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .player-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--color-espresso);
  }

  .badges {
    display: flex;
    gap: 0.35rem;
  }

  .badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .badge-host {
    background: #fef3c7;
    color: #92400e;
  }

  .badge-you {
    background: #fed7aa;
    color: #9a3412;
  }

  .badge-bot {
    background: #e0e7ff;
    color: #3730a3;
  }

  .player-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-remove-bot {
    background: none;
    border: 1.5px solid #e7e5e4;
    border-radius: 6px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #a8a29e;
    font-size: 0.75rem;
    padding: 0;
    transition: color 0.2s, border-color 0.2s;
  }

  .btn-remove-bot:hover {
    color: #ef4444;
    border-color: #ef4444;
  }

  .ready-status {
    font-size: 0.8rem;
    font-weight: 500;
    color: #a8a29e;
  }

  .ready-status.is-ready {
    color: var(--color-forest);
    font-weight: 600;
  }

  /* Actions */
  .actions {
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .btn {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    width: 100%;
    max-width: 280px;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-ready {
    background: var(--color-espresso);
    color: white;
  }

  .btn-ready:hover:not(:disabled) {
    background: #2a2020;
  }

  .btn-ready.is-ready {
    background: var(--color-linen);
    color: #78716c;
  }

  .btn-add-bot {
    background: #e0e7ff;
    color: #3730a3;
  }

  .btn-start {
    background: var(--color-terracotta);
    color: white;
  }

  .btn-start:hover:not(:disabled) {
    background: #a8552f;
  }

  .hint {
    font-size: 0.8rem;
    color: #a8a29e;
    font-style: italic;
    margin: 0;
  }

  .starting {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: #fef3c7;
    border-radius: 8px;
    font-weight: 600;
    color: #92400e;
    font-size: 0.9rem;
  }
</style>
