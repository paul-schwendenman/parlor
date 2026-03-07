<script lang="ts">
  import { lobbyState } from '../../stores/lobbyStore.svelte.js';
  import { playerState } from '../../stores/playerStore.svelte.js';
  import { getSocket } from '../../stores/socketClient.js';

  let { roomCode }: { roomCode: string } = $props();

  let isHost = $derived(lobbyState.hostId === playerState.id);

  function toggleReady() {
    const me = lobbyState.players.find((p) => p.id === playerState.id);
    if (me) {
      getSocket().emit('lobby:ready', !me.isReady);
    }
  }

  function startGame() {
    getSocket().emit('lobby:startGame');
  }
</script>

<div class="lobby">
  <h2>Room: <span class="code">{roomCode}</span></h2>

  <div class="players">
    <h3>Players ({lobbyState.players.length})</h3>
    {#each lobbyState.players as player}
      <div class="player" class:ready={player.isReady} class:me={player.id === playerState.id}>
        <span class="name">
          {player.name}
          {#if player.id === lobbyState.hostId}
            <span class="host-badge">Host</span>
          {/if}
          {#if player.id === playerState.id}
            <span class="you-badge">You</span>
          {/if}
        </span>
        <span class="status">{player.isReady ? 'Ready' : 'Not Ready'}</span>
      </div>
    {/each}
  </div>

  <div class="actions">
    <button class="ready-btn" onclick={toggleReady}>
      {lobbyState.players.find((p) => p.id === playerState.id)?.isReady ? 'Not Ready' : 'Ready'}
    </button>

    {#if isHost}
      <button class="start-btn" onclick={startGame} disabled={!lobbyState.canStart}>
        Start Game
      </button>
    {:else}
      <p class="waiting">Waiting for host to start...</p>
    {/if}
  </div>

  {#if lobbyState.gameStarting}
    <div class="starting">Game starting...</div>
  {/if}
</div>

<style>
  .lobby {
    max-width: 500px;
    margin: 0 auto;
    padding: 24px 16px;
  }
  h2 {
    text-align: center;
    margin-bottom: 24px;
  }
  .code {
    font-family: monospace;
    font-size: 28px;
    letter-spacing: 6px;
    color: #3b82f6;
  }
  .players {
    margin-bottom: 24px;
  }
  h3 {
    font-size: 16px;
    color: #666;
    margin-bottom: 8px;
  }
  .player {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 8px;
    background: #f3f4f6;
  }
  .player.ready {
    background: #dcfce7;
  }
  .player.me {
    border: 2px solid #3b82f6;
  }
  .name {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .host-badge, .you-badge {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }
  .host-badge {
    background: #fef3c7;
    color: #92400e;
  }
  .you-badge {
    background: #dbeafe;
    color: #1e40af;
  }
  .status {
    font-size: 14px;
    color: #666;
  }
  .player.ready .status {
    color: #16a34a;
    font-weight: 600;
  }
  .actions {
    text-align: center;
  }
  button {
    padding: 12px 32px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    margin: 4px;
  }
  .ready-btn {
    background: #e5e7eb;
    color: #374151;
  }
  .ready-btn:hover {
    background: #d1d5db;
  }
  .start-btn {
    background: #16a34a;
    color: white;
  }
  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .start-btn:hover:not(:disabled) {
    background: #15803d;
  }
  .waiting {
    color: #666;
    font-style: italic;
  }
  .starting {
    text-align: center;
    margin-top: 16px;
    padding: 12px;
    background: #dbeafe;
    border-radius: 8px;
    font-weight: 600;
    color: #1e40af;
  }
</style>
