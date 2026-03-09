<script lang="ts">
  let {
    count,
    canDraw,
    ondraw,
  }: {
    count: number;
    canDraw: boolean;
    ondraw: () => void;
  } = $props();
</script>

<div class="draw-pile">
  <button
    class="pile"
    class:clickable={canDraw}
    onclick={ondraw}
    disabled={!canDraw}
  >
    <div class="card-back">
      <span class="count">{count}</span>
    </div>
  </button>
</div>

<style>
  .draw-pile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .pile {
    width: 48px;
    height: 68px;
    border-radius: 8px;
    border: 2px solid #1e3a8a;
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #1e40af 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    transition: transform 0.15s, box-shadow 0.15s;
    padding: 0;
  }

  .pile.clickable {
    cursor: pointer;
    border-color: #f59e0b;
    box-shadow: 0 0 0 1px #f59e0b;
  }

  .pile.clickable:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  .pile:disabled {
    opacity: 0.7;
  }

  .card-back {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 4px,
      rgba(255, 255, 255, 0.1) 4px,
      rgba(255, 255, 255, 0.1) 8px
    );
  }

  .count {
    font-size: 14px;
    font-weight: 700;
    color: white;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
