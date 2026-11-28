<script lang="ts">
  import type { CatalogGame } from '$lib/games/catalog.js';
  import { minutesRange, playerCount } from '$lib/games/catalog.js';
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
    <span class="game-meta">{playerCount(game)} · {minutesRange(game)} min</span>
  </div>
  <p class="game-desc">{game.description}</p>
  <p class="game-tags">{facts}</p>
  <div class="game-actions">
    <button type="button" class="spine-ghost" onclick={() => onrules(game.id)} {disabled}>How to play</button>
    <button type="button" class="spine-solid" aria-label="Play {game.name}" onclick={() => onstart(game.id)} {disabled}>
      <!-- The same play mark on every block, so the main action reads alike whatever the colour. -->
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 1.5v9l8-4.5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
      <span>Play<span class="play-name">{` ${game.name}`}</span></span>
    </button>
  </div>
</article>

<style>
  .game-card {
    container-type: inline-size;
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

  /* Name and meta share a line when there's room; the meta wraps under a long name. */
  .game-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px 10px;
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
    font-size: 0.875rem;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1.5px solid currentColor;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .game-desc {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    line-height: 1.45;
    text-wrap: pretty;
    flex: 1;
  }

  .game-tags {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 700;
  }

  .game-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  /* "Play Kings Corner" needs the room; "How to play" sizes to its words. */
  .spine-ghost,
  .spine-solid {
    height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    font-family: var(--font-body);
    font-size: 1rem;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  .spine-ghost:active,
  .spine-solid:active {
    transform: scale(0.98);
  }

  .spine-solid svg {
    flex-shrink: 0;
  }

  /* On a narrow block the heading already names the game: the pill says "Play". */
  @container (max-width: 380px) {
    .play-name {
      display: none;
    }
  }

  .spine-ghost {
    flex: 0 0 auto;
    border: 2px solid var(--spine-fg);
    background: transparent;
    color: var(--spine-fg);
    font-weight: 700;
  }

  .spine-solid {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
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
