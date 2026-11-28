<script lang="ts">
  import type { CatalogGame } from '$lib/games/catalog.js';
  import { minutesRange, playerRange } from '$lib/games/catalog.js';
  import { formatLabels, kindLabels, weightLabels } from '$lib/games/discovery.js';

  interface Props {
    game: CatalogGame;
    disabled?: boolean;
    /** Heading level for the game name, so the card nests under its section. */
    level?: 2 | 3 | 4;
    onrules: (gameId: string) => void;
    onstart: (gameId: string) => void;
  }

  let { game, disabled = false, level = 3, onrules, onstart }: Props = $props();

  let facts = $derived(
    [kindLabels[game.kind], weightLabels[game.weight], game.format === 'individual' ? null : formatLabels[game.format]]
      .filter(Boolean)
      .join(' · '),
  );
</script>

<!-- One shelf block (DESIGN.md: Game shelf). Spine colours come from the
     shared .spine-{shelf} classes in app.css. -->
<article class="game-card spine-{game.shelf}">
  <div class="game-head">
    <svelte:element this={`h${level}`} class="game-name">{game.name}</svelte:element>
    <span class="game-meta" aria-label="{playerRange(game)} players, {minutesRange(game)} minutes">{playerRange(game)} · {minutesRange(game)}m</span>
  </div>
  <p class="game-desc">{game.description}</p>
  <p class="game-tags">{facts}</p>
  <div class="game-actions">
    <button type="button" class="spine-ghost" onclick={() => onrules(game.id)} {disabled}>How to play</button>
    <button type="button" class="spine-solid" onclick={() => onstart(game.id)} {disabled}>Start game</button>
  </div>
</article>

<style>
  .game-card {
    background: var(--spine-bg);
    color: var(--spine-fg);
    border: 2.5px solid var(--color-espresso);
    border-radius: 18px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  @media (hover: hover) {
    .game-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(59, 47, 47, 0.12);
    }
  }

  .game-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .game-name {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.75rem;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .game-meta {
    flex-shrink: 0;
    font-size: 0.8125rem;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1.5px solid currentColor;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .game-desc {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.45;
    flex: 1;
  }

  .game-tags {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .game-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  .spine-ghost,
  .spine-solid {
    flex: 1;
    height: 44px;
    border-radius: 999px;
    font-family: var(--font-body);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  .spine-ghost:active,
  .spine-solid:active {
    transform: scale(0.98);
  }

  .spine-ghost {
    border: 2px solid var(--spine-fg);
    background: transparent;
    color: var(--spine-fg);
    font-weight: 700;
  }

  .spine-solid {
    border: 2px solid var(--spine-solid-bg);
    background: var(--spine-solid-bg);
    color: var(--spine-solid-fg);
    font-weight: 800;
  }

  @media (hover: hover) {
    .spine-ghost:hover {
      background: color-mix(in srgb, var(--spine-fg) 12%, transparent);
    }

    .spine-solid:hover {
      background: color-mix(in srgb, var(--spine-solid-bg) 88%, var(--spine-fg));
    }
  }

  .game-card:not(.spine-mustard):not(.spine-linen) :focus-visible {
    outline-color: var(--color-cream);
  }
</style>
