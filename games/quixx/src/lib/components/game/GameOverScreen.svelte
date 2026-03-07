<script lang="ts">
  import type { PlayerScore } from '../../types/game.js';
  import { getSocket } from '../../stores/socketClient.js';

  let {
    scores,
    myPlayerId,
  }: {
    scores: PlayerScore[];
    myPlayerId: string;
  } = $props();

  function playAgain() {
    getSocket().emit('lobby:resetGame');
  }
</script>

<div class="game-over">
  <h2>Game Over!</h2>

  <div class="rankings">
    {#each scores as score, i}
      <div class="rank" class:winner={i === 0} class:me={score.playerId === myPlayerId}>
        <span class="position">{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}</span>
        <span class="name">{score.name} {score.playerId === myPlayerId ? '(You)' : ''}</span>
        <span class="total">{score.total} pts</span>
      </div>
    {/each}
  </div>

  <button onclick={playAgain}>Play Again</button>
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
  }
  .rank.winner {
    background: #fef9c3;
    border: 2px solid #eab308;
  }
  .rank.me {
    border: 2px solid #3b82f6;
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
  .total {
    font-size: 18px;
    font-weight: 700;
  }
  button {
    padding: 12px 32px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    background: #3b82f6;
    color: white;
  }
  button:hover {
    background: #2563eb;
  }
</style>
