<script lang="ts">
  let {
    isActivePlayer,
    activePlayerName,
    phase,
    drewCard,
  }: {
    isActivePlayer: boolean;
    activePlayerName: string | null;
    phase: string;
    drewCard: boolean;
  } = $props();
</script>

<div class="turn-banner" class:active={isActivePlayer}>
  {#if phase === 'choosing-suit'}
    {#if isActivePlayer}
      <span class="turn-text">Choose a suit!</span>
    {:else}
      <span class="turn-text">{activePlayerName} is choosing a suit...</span>
    {/if}
  {:else if isActivePlayer}
    {#if drewCard}
      <span class="turn-text">YOUR TURN &mdash; Play the drawn card or pass</span>
    {:else}
      <span class="turn-text">YOUR TURN &mdash; Play a card or draw</span>
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
  .turn-text {
    font-size: 16px;
    font-weight: 700;
  }
</style>
