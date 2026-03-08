<script lang="ts">
  import type { BootyDicePlayer } from '../../types/game.js';

  interface Props {
    player: BootyDicePlayer;
    isCurrentTurn?: boolean;
    isTargetable?: boolean;
    isMe?: boolean;
    onSelect?: () => void;
  }

  let {
    player,
    isCurrentTurn = false,
    isTargetable = false,
    isMe = false,
    onSelect,
  }: Props = $props();
</script>

<button
  class="player-card"
  class:current-turn={isCurrentTurn}
  class:eliminated={player.isEliminated}
  class:targetable={isTargetable}
  class:is-me={isMe}
  class:ai={player.isAI}
  onclick={() => isTargetable && onSelect?.()}
  disabled={!isTargetable}
>
  <div class="left">
    <span class="name">{player.name}</span>
    {#if player.isAI}
      <span class="badge ai-badge">AI</span>
    {/if}
    {#if isMe}
      <span class="badge me-badge">You</span>
    {/if}
    {#if !player.isConnected}
      <span class="badge disconnected">DC</span>
    {/if}
  </div>

  <div class="stats">
    <span class="stat">{'\u{1FA99}'}{player.doubloons}</span>
    <span class="stat">{'\u2764\uFE0F'}{player.lives}</span>
    <span class="stat">{'\u{1F6E1}\uFE0F'}{player.shields}</span>
  </div>

  {#if player.isEliminated}
    <div class="eliminated-overlay">ELIMINATED</div>
  {/if}
</button>

<style>
  .player-card {
    padding: 0.5rem 0.65rem;
    background: #2a2a2a;
    border-radius: 8px;
    border: 2px solid transparent;
    position: relative;
    text-align: left;
    width: 100%;
    cursor: default;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .player-card.current-turn {
    border-color: #d4a574;
    box-shadow: 0 0 10px rgba(212, 165, 116, 0.3);
  }

  .player-card.is-me {
    background: #2d3a2d;
  }

  .player-card.targetable {
    cursor: pointer;
    border-color: #c44;
  }

  .player-card.targetable:hover {
    background: #3a2a2a;
    transform: scale(1.02);
  }

  .player-card.eliminated {
    opacity: 0.5;
  }

  .eliminated-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    color: #c44;
    font-weight: bold;
    font-size: 0.75rem;
    border-radius: 6px;
    letter-spacing: 2px;
  }

  .left {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .name {
    font-weight: 600;
    color: #eee;
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge {
    font-size: 0.55rem;
    padding: 1px 4px;
    border-radius: 3px;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .ai-badge {
    background: #555;
    color: #ccc;
  }

  .me-badge {
    background: #4a7c4a;
    color: #fff;
  }

  .disconnected {
    background: #c44;
    color: #fff;
  }

  .stats {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .stat {
    font-size: 0.8rem;
    color: #ccc;
  }
</style>
