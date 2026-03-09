<script lang="ts">
  import { lobbyState } from '../../stores/lobbyStore.svelte.js';
  import { playerState } from '../../stores/playerStore.svelte.js';
  import { getSocket } from '../../stores/socketClient.js';

  let { roomCode }: { roomCode: string } = $props();

  let isHost = $derived(lobbyState.hostId === playerState.id);
  let me = $derived(lobbyState.players.find((p) => p.id === playerState.id));
  let copied = $state(false);

  function toggleReady() {
    if (me) {
      getSocket().emit('lobby:ready', !me.isReady);
    }
  }

  function startGame() {
    getSocket().emit('lobby:startGame');
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

<div class="lobby">
  <div class="room-header">
    <p class="room-label">Room Code</p>
    <button class="code-display" onclick={copyCode} title="Copy invite link">
      <span class="code-text">{roomCode}</span>
      <span class="copy-hint">{copied ? 'Copied!' : 'Copy link'}</span>
    </button>
  </div>

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
            {#if player.isBot && isHost}
              <button class="btn-remove-bot" onclick={() => removeBot(player.id)}>Remove</button>
            {:else}
              <span class="ready-status" class:is-ready={player.isReady}>
                {player.isReady ? 'Ready' : 'Waiting'}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="actions">
    <button class="btn btn-ready" class:is-ready={me?.isReady} onclick={toggleReady}>
      {me?.isReady ? 'Not Ready' : 'Ready Up'}
    </button>

    {#if isHost}
      {#if lobbyState.players.length < 4}
        <button class="btn btn-bot" onclick={addBot}>Add Bot</button>
      {/if}
      <button class="btn btn-start" onclick={startGame} disabled={!lobbyState.canStart}>
        Start Game
      </button>
      {#if !lobbyState.canStart}
        <p class="hint">Need at least 2 players, all ready</p>
      {/if}
    {:else}
      <p class="hint">Waiting for host to start...</p>
    {/if}
  </div>

  {#if lobbyState.gameStarting}
    <div class="starting">Game starting...</div>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap');

  .lobby {
    max-width: 480px;
    margin: 0 auto;
    padding: 2rem 1rem;
    font-family: 'DM Sans', system-ui, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .room-header {
    text-align: center;
    margin-bottom: 2rem;
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
    border: 1.5px solid #e7e5e4;
    border-radius: 12px;
    padding: 1rem 2rem;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .code-display:hover {
    border-color: #d97706;
    box-shadow: 0 2px 8px rgba(217, 119, 6, 0.1);
  }

  .code-text {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 2.25rem;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: #292524;
  }

  .copy-hint {
    font-size: 0.75rem;
    color: #a8a29e;
    font-weight: 500;
    transition: color 0.2s;
  }

  .code-display:hover .copy-hint {
    color: #d97706;
  }

  .players-section {
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .players-heading {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 1.15rem;
    font-weight: 600;
    color: #292524;
    margin: 0 0 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .count {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 0.8rem;
    font-weight: 600;
    color: #a8a29e;
    background: #f5f5f4;
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
    border: 1.5px solid #f0efed;
    transition: border-color 0.2s, background 0.2s;
  }

  .player.ready {
    background: #fefce8;
    border-color: #fde68a;
  }

  .player.me {
    border-color: #d97706;
  }

  .player-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .player-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: #292524;
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

  .ready-status {
    font-size: 0.8rem;
    font-weight: 500;
    color: #a8a29e;
  }

  .ready-status.is-ready {
    color: #16a34a;
    font-weight: 600;
  }

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
    font-family: 'DM Sans', system-ui, sans-serif;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
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
    background: #292524;
    color: white;
  }

  .btn-ready:hover:not(:disabled) {
    background: #1c1917;
  }

  .btn-ready.is-ready {
    background: #e7e5e4;
    color: #57534e;
  }

  .btn-ready.is-ready:hover:not(:disabled) {
    background: #d6d3d1;
  }

  .btn-remove-bot {
    padding: 0.3rem 0.6rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f9fafb;
    color: #6b7280;
    font-size: 0.75rem;
    cursor: pointer;
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  .btn-remove-bot:hover {
    background: #fee2e2;
    color: #dc2626;
    border-color: #fca5a5;
  }

  .btn-bot {
    background: #e0e7ff;
    color: #3730a3;
  }

  .btn-bot:hover:not(:disabled) {
    background: #c7d2fe;
  }

  .btn-start {
    background: #d97706;
    color: white;
  }

  .btn-start:hover:not(:disabled) {
    background: #b45309;
    box-shadow: 0 2px 8px rgba(217, 119, 6, 0.25);
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
