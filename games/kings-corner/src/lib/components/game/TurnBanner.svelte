<script lang="ts">
  let {
    isActivePlayer,
    activePlayerName,
    phase,
    mustPlayKing,
    canEndTurn,
  }: {
    isActivePlayer: boolean;
    activePlayerName: string | null;
    phase: string;
    mustPlayKing: boolean;
    canEndTurn: boolean;
  } = $props();
</script>

<div class="turn-banner" class:active={isActivePlayer} class:warning={mustPlayKing}>
  {#if isActivePlayer}
    {#if phase === 'drawing'}
      <span class="turn-text">YOUR TURN &mdash; Draw a card</span>
    {:else if mustPlayKing}
      <span class="turn-text">You must play a King to a corner!</span>
    {:else}
      <span class="turn-text">YOUR TURN &mdash; Play cards or end turn</span>
    {/if}
  {:else}
    <span class="turn-text">Waiting for {activePlayerName}...</span>
  {/if}
</div>

<style>
  .turn-banner {
    text-align: center;
    padding: 10px 16px;
    border-radius: 8px;
    margin-bottom: 12px;
    background: #f3f4f6;
    color: #374151;
  }
  .turn-banner.active {
    background: #fef3c7;
    color: #92400e;
  }
  .turn-banner.warning {
    background: #fef2f2;
    color: #991b1b;
  }
  .turn-text {
    font-size: 16px;
    font-weight: 700;
  }
</style>
