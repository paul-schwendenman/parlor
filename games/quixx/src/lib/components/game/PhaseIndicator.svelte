<script lang="ts">
  import type { QuixxPhase } from '../../types/game.js';

  let {
    phase,
    isActivePlayer,
    activePlayerName,
    phase1Submitted,
    submittedCount,
    totalPlayers,
    onpass,
    onroll,
  }: {
    phase: QuixxPhase;
    isActivePlayer: boolean;
    activePlayerName: string | null;
    phase1Submitted: boolean;
    submittedCount: number;
    totalPlayers: number;
    onpass?: () => void;
    onroll?: () => void;
  } = $props();
</script>

<div class="phase-indicator">
  {#if phase === 'rolling'}
    {#if isActivePlayer}
      <p>Your turn! Roll the dice.</p>
      <button class="roll-btn" onclick={onroll}>Roll Dice</button>
    {:else}
      <p>Waiting for <strong>{activePlayerName}</strong> to roll...</p>
    {/if}

  {:else if phase === 'phase1'}
    {#if phase1Submitted}
      <p>Choice submitted. Waiting for others... ({submittedCount}/{totalPlayers})</p>
    {:else}
      <p>Tap a highlighted cell to mark the white sum, or pass.</p>
      <button class="pass-btn" onclick={onpass}>Pass</button>
    {/if}

  {:else if phase === 'phase2'}
    {#if isActivePlayer}
      <p>Choose a colored combo to mark, or pass.</p>
      <button class="pass-btn" onclick={onpass}>Pass</button>
    {:else}
      <p>Waiting for <strong>{activePlayerName}</strong> to choose...</p>
    {/if}

  {:else if phase === 'turn-end'}
    <p>Turn complete.</p>

  {:else if phase === 'game-over'}
    <p>Game Over!</p>
  {/if}
</div>

<style>
  .phase-indicator {
    text-align: center;
    padding: 12px;
    margin-bottom: 12px;
  }
  p {
    margin: 0 0 8px;
    font-size: 16px;
    color: #374151;
  }
  button {
    padding: 10px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }
  .roll-btn {
    background: #3b82f6;
    color: white;
  }
  .roll-btn:hover {
    background: #2563eb;
  }
  .pass-btn {
    background: #e5e7eb;
    color: #374151;
  }
  .pass-btn:hover {
    background: #d1d5db;
  }
</style>
