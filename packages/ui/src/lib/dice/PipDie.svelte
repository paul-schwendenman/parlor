<script lang="ts">
  /**
   * A printed die with drawn pips: ink outline, paper face by default. A game
   * prints its own dice by setting `--die-face` and `--die-pip`; size comes
   * from `--die-size` (default 44px).
   *
   * `picked` is the butter "picked up" state (a kept die, a chosen face);
   * `hit` marks a die that counts (a matching die in a reveal).
   */
  interface Props {
    value: number;
    /** Accessible name; defaults to "Die showing 4". */
    label?: string;
    picked?: boolean;
    /** Faded out of play. */
    dimmed?: boolean;
    onclick?: () => void;
    disabled?: boolean;
  }

  let { value, label, picked = false, dimmed = false, onclick, disabled = false }: Props = $props();

  // Pip centres on a 3×3 grid (0 = left/top, 1 = middle, 2 = right/bottom).
  const PIPS: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };

  let name = $derived(label ?? `Die showing ${value}`);
</script>

{#snippet pips()}
  <svg viewBox="0 0 30 30" aria-hidden="true">
    {#each PIPS[value] ?? [] as [x, y], i (i)}
      <circle cx={7 + x * 8} cy={7 + y * 8} r="3.1" />
    {/each}
  </svg>
{/snippet}

{#if onclick}
  <button type="button" class="die" class:picked class:dimmed aria-label={name} aria-pressed={picked} {disabled} {onclick}>
    {@render pips()}
  </button>
{:else}
  <span class="die" class:picked class:dimmed role="img" aria-label={name}>{@render pips()}</span>
{/if}

<style>
  .die {
    --s: var(--die-size, 44px);
    display: block;
    width: var(--s);
    height: var(--s);
    box-sizing: border-box;
    flex-shrink: 0;
    padding: calc(var(--s) * 0.08);
    border: 2px solid var(--color-espresso, #3B2F2F);
    border-radius: calc(var(--s) * 0.24);
    background: var(--die-face, var(--color-paper, #FFFFFF));
    color: var(--die-pip, var(--color-espresso, #3B2F2F));
    font: inherit;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), background 0.18s ease, opacity 0.2s ease;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  button.die {
    cursor: pointer;
  }

  button.die:disabled {
    cursor: default;
  }

  @media (hover: hover) {
    button.die:not(:disabled):hover {
      transform: translateY(-3px);
    }
  }

  button.die:not(:disabled):active {
    transform: scale(0.96);
  }

  .die.picked {
    background: var(--color-mustard-tint, #F3E2B6);
    color: var(--color-espresso, #3B2F2F);
    border-width: 3px;
    transform: translateY(-4px);
  }

  .die.dimmed {
    opacity: 0.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .die {
      transition: none;
    }
  }
</style>
