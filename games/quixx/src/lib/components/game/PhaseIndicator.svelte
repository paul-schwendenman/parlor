<script lang="ts">
  import type { QuixxPhase } from '../../types/game.js';

  let {
    phase,
    isActivePlayer,
    activePlayerName,
    phase1Submitted,
    submittedCount,
    totalPlayers,
    hasSelection = false,
    onpass,
    onroll,
    onconfirm,
  }: {
    phase: QuixxPhase;
    isActivePlayer: boolean;
    activePlayerName: string | null;
    phase1Submitted: boolean;
    submittedCount: number;
    totalPlayers: number;
    hasSelection?: boolean;
    onpass?: () => void;
    onroll?: () => void;
    onconfirm?: () => void;
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
      <p>Tap a cell to preview, then confirm.</p>
      <div class="button-group">
        {#if hasSelection}
          <button class="confirm-btn" onclick={onconfirm}>Confirm</button>
        {/if}
        <button class="pass-btn" onclick={onpass}>Pass</button>
      </div>
    {/if}

  {:else if phase === 'phase2'}
    {#if isActivePlayer}
      <p>Tap a colored combo to preview, then confirm.</p>
      <div class="button-group">
        {#if hasSelection}
          <button class="confirm-btn" onclick={onconfirm}>Confirm</button>
        {/if}
        <button class="pass-btn" onclick={onpass}>Pass</button>
      </div>
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
  .button-group {
    display: flex;
    gap: 8px;
    justify-content: center;
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
  .confirm-btn {
    background: #16a34a;
    color: white;
  }
  .confirm-btn:hover {
    background: #15803d;
  }
  .pass-btn {
    background: #e5e7eb;
    color: #374151;
  }
  .pass-btn:hover {
    background: #d1d5db;
  }
</style>
