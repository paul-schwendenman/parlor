<script lang="ts">
  import type { QuixxPlayerView } from '../../types/game.js';

  let { view }: { view: QuixxPlayerView } = $props();
</script>

<div class="player-list">
  <h3>Players</h3>
  {#each view.players as player, i}
    <div class="player" class:active={i === view.activePlayerIndex} class:disconnected={!player.connected}>
      <span class="name">
        {player.name}
        {#if i === view.myIndex}
          <span class="you">(You)</span>
        {/if}
      </span>
      <span class="info">
        {#if view.phase === 'phase1'}
          <span class="phase1-status" class:submitted={player.phase1Submitted}>
            {player.phase1Submitted ? 'Done' : '...'}
          </span>
        {/if}
        {#if !player.connected}
          <span class="offline">Offline</span>
        {/if}
        <span class="penalty-count">{player.penalties > 0 ? `${player.penalties} pen.` : ''}</span>
      </span>
    </div>
  {/each}
</div>

<style>
  .player-list {
    margin-top: 16px;
  }
  h3 {
    font-size: 14px;
    color: #666;
    margin-bottom: 8px;
  }
  .player {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 4px;
    background: #f9fafb;
    font-size: 14px;
  }
  .player.active {
    background: #dbeafe;
    border-left: 3px solid #3b82f6;
  }
  .player.disconnected {
    opacity: 0.5;
  }
  .name {
    font-weight: 600;
  }
  .you {
    font-weight: 400;
    color: #6b7280;
    font-size: 12px;
  }
  .info {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .phase1-status {
    font-size: 12px;
    color: #9ca3af;
  }
  .phase1-status.submitted {
    color: #16a34a;
    font-weight: 600;
  }
  .offline {
    font-size: 11px;
    color: #ef4444;
    background: #fef2f2;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .penalty-count {
    font-size: 12px;
    color: #ef4444;
  }
</style>
