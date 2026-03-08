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
  <p class="label">Draw</p>
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

  .label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .pile {
    width: 56px;
    height: 80px;
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
    font-size: 16px;
    font-weight: 700;
    color: white;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
