<script lang="ts">
  import type { PlayerScore, RowColor, Scoresheet } from '../../types/game.js';
  import { getSocket } from '../../stores/socketClient.js';
  import ScoresheetViewer from './ScoresheetViewer.svelte';

  interface PlayerData {
    id: string;
    name: string;
    sheet: Scoresheet;
    penalties: number;
    lockedRows: RowColor[];
  }

  let {
    scores,
    players,
    myPlayerId,
  }: {
    scores: PlayerScore[];
    players: PlayerData[];
    myPlayerId: string;
  } = $props();

  let viewerOpen = $state(false);
  let viewerInitialPlayer = $state(myPlayerId);

  function playAgain() {
    getSocket().emit('lobby:resetGame');
  }

  function openViewer(playerId: string) {
    viewerInitialPlayer = playerId;
    viewerOpen = true;
  }
</script>

<div class="game-over">
  <h2>Game Over!</h2>

  <div class="rankings">
    {#each scores as score, i}
      <button class="rank" class:winner={i === 0} class:me={score.playerId === myPlayerId} onclick={() => openViewer(score.playerId)}>
        <span class="position">{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}</span>
        <span class="name">{score.name} {score.playerId === myPlayerId ? '(You)' : ''}</span>
        <span class="total">{score.total} pts</span>
        <span class="chevron">›</span>
      </button>
    {/each}
  </div>

  <div class="actions">
    <button class="primary" onclick={playAgain}>Play Again</button>
    <button class="secondary" onclick={() => openViewer(myPlayerId)}>View Scoresheets</button>
  </div>
</div>

<ScoresheetViewer
  {players}
  {scores}
  {myPlayerId}
  initialPlayerId={viewerInitialPlayer}
  bind:open={viewerOpen}
/>

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
    border: 2px solid transparent;
    width: 100%;
    font-size: inherit;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }
  .rank:hover {
    background: #f3f4f6;
  }
  .rank.winner {
    background: #fef9c3;
    border-color: #eab308;
  }
  .rank.winner:hover {
    background: #fef08a;
  }
  .rank.me {
    border-color: #3b82f6;
  }
  .chevron {
    font-size: 20px;
    color: #9ca3af;
    font-weight: 700;
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
