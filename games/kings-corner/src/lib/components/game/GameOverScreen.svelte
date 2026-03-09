<script lang="ts">
  import type { KingsCornerPlayerInfo } from '../../types/game.js';
  import { getSocket } from '../../stores/socketClient.js';

  let {
    winner,
    players,
    myPlayerId,
  }: {
    winner: { id: string; name: string } | null;
    players: KingsCornerPlayerInfo[];
    myPlayerId: string;
  } = $props();

  let sortedPlayers = $derived(
    [...players].sort((a, b) => a.cardCount - b.cardCount),
  );

  function playAgain() {
    getSocket().emit('lobby:restartGame');
  }

  function backToLobby() {
    getSocket().emit('lobby:resetGame');
  }
</script>

<div class="game-over">
  <h2>Game Over!</h2>

  {#if winner}
    <p class="winner-text">
      {winner.id === myPlayerId ? 'You win!' : `${winner.name} wins!`}
    </p>
  {/if}

  <div class="rankings">
    {#each sortedPlayers as player, i}
      <div class="rank" class:winner={player.id === winner?.id} class:me={player.id === myPlayerId}>
        <span class="position">{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}</span>
        <span class="name">{player.name} {player.id === myPlayerId ? '(You)' : ''}</span>
        <span class="cards">{player.cardCount} cards left</span>
      </div>
    {/each}
  </div>

  <div class="actions">
    <button class="primary" onclick={playAgain}>Play Again</button>
    <button class="secondary" onclick={backToLobby}>Back to Lobby</button>
  </div>
</div>

<style>
  .game-over {
    max-width: 400px;
    margin: 0 auto;
    padding: 32px 16px;
    text-align: center;
  }
  h2 {
    font-size: 32px;
    margin-bottom: 8px;
  }
  .winner-text {
    font-size: 20px;
    font-weight: 600;
    color: #d97706;
    margin-bottom: 24px;
  }
  .rankings {
    margin-bottom: 24px;
  }
  .rank {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 8px;
    background: #f9fafb;
    border: 2px solid transparent;
  }
  .rank.winner {
    background: #fef9c3;
    border-color: #eab308;
  }
  .rank.me {
    border-color: #3b82f6;
  }
  .position {
    font-weight: 700;
    font-size: 18px;
    width: 40px;
  }
  .name {
    flex: 1;
    text-align: left;
    font-weight: 600;
  }
  .cards {
    font-size: 14px;
    color: #6b7280;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }
  .actions button {
    padding: 12px 32px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    max-width: 280px;
  }
  .primary {
    background: #3b82f6;
    color: white;
  }
  .primary:hover {
    background: #2563eb;
  }
  .secondary {
    background: #f3f4f6;
    color: #374151;
  }
  .secondary:hover {
    background: #e5e7eb;
  }
</style>
