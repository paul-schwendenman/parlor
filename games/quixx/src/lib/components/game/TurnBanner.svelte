<script lang="ts">
  let {
    round,
    isActivePlayer,
    activePlayerName,
    phase,
  }: {
    round: number;
    isActivePlayer: boolean;
    activePlayerName: string | null;
    phase: string;
  } = $props();
</script>

<div class="turn-banner" class:active={isActivePlayer}>
  {#if isActivePlayer}
    <span class="turn-text">YOUR TURN &mdash; Round {round}</span>
  {:else if phase === 'phase1'}
    <span class="turn-text">Round {round} &mdash; Pick your white sum</span>
  {:else}
    <span class="turn-text">Round {round} &mdash; {activePlayerName}'s turn</span>
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
  .turn-text {
    font-size: 16px;
    font-weight: 700;
  }
</style>
