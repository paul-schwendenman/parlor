<script lang="ts">
  let { penalties, score }: { penalties: number; score: number } = $props();
</script>

<div class="penalty-tracker">
  <div class="penalties">
    <span class="label">Penalties (-5 each):</span>
    {#each Array(4) as _, i}
      <span class="penalty-box" class:filled={i < penalties}>
        {i < penalties ? 'X' : ''}
      </span>
    {/each}
  </div>
  <div class="score">
    Score: <strong>{score}</strong>
  </div>
</div>

<style>
  .penalty-tracker {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    margin-top: 4px;
  }
  .penalties {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .label {
    font-size: 12px;
    color: #666;
    margin-right: 4px;
  }
  .penalty-box {
    width: 28px;
    height: 28px;
    border: 2px solid #9ca3af;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 14px;
    color: #ef4444;
  }
  .penalty-box.filled {
    background: #fef2f2;
    border-color: #ef4444;
  }
  .score {
    font-size: 18px;
  }
</style>
