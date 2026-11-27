<script lang="ts">
  /**
   * A printed playing card: paper stock, ink outline, Nunito index in the top
   * left (so it stays readable when cards overlap in a hand), a drawn suit in
   * the middle. Size comes from `--card-w` on any ancestor (default 64px).
   *
   * The back is printed in the game's own colour: set `--card-back` (and
   * `--card-back-ink` for the pattern) on an ancestor.
   */
  import SuitIcon from './SuitIcon.svelte';
  import { cardName, isRedSuit, type CardSuit } from './suits.js';

  interface Props {
    rank?: string;
    suit?: CardSuit;
    faceDown?: boolean;
    /** Can be played now: the card lifts on hover and takes clicks. */
    playable?: boolean;
    selected?: boolean;
    /** Not playable while it's your turn: printed faded. */
    dimmed?: boolean;
    onclick?: () => void;
  }

  let { rank = '', suit = 'spades', faceDown = false, playable = false, selected = false, dimmed = false, onclick }: Props = $props();

  let red = $derived(isRedSuit(suit));
  let name = $derived(cardName(rank, suit));
</script>

{#if faceDown}
  <div class="card back" aria-hidden="true"><span class="back-inset"></span></div>
{:else if onclick}
  <button
    type="button"
    class="card face"
    class:red
    class:playable
    class:selected
    class:dimmed
    aria-label={name}
    aria-pressed={selected}
    disabled={!playable}
    {onclick}
  >
    {@render face()}
  </button>
{:else}
  <div class="card face" class:red role="img" aria-label={name}>
    {@render face()}
  </div>
{/if}

{#snippet face()}
  <span class="index" aria-hidden="true">
    <span class="rank">{rank}</span>
    <SuitIcon {suit} size="0.8em" />
  </span>
  <span class="pip" aria-hidden="true"><SuitIcon {suit} size="100%" /></span>
{/snippet}

<style>
  .card {
    --w: var(--card-w, 64px);
    position: relative;
    box-sizing: border-box;
    width: var(--w);
    height: calc(var(--w) * 1.42);
    flex-shrink: 0;
    border: 2px solid var(--color-espresso, #3B2F2F);
    border-radius: calc(var(--w) * 0.14);
    padding: 0;
    font: inherit;
  }

  .face {
    background: var(--color-paper, #FFFFFF);
    color: var(--color-espresso, #3B2F2F);
    cursor: default;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease, opacity 0.2s ease;
  }

  .face.red {
    color: var(--color-danger, #991B1B);
  }

  .index {
    position: absolute;
    top: calc(var(--w) * 0.07);
    left: calc(var(--w) * 0.09);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 900;
    font-size: calc(var(--w) * 0.3);
    line-height: 0.9;
    letter-spacing: -0.04em;
  }

  .pip {
    position: absolute;
    left: 50%;
    top: 56%;
    width: 46%;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
  }

  /* States. Disabled faces in a hand are not greyed by the browser. */
  button.face:disabled {
    cursor: default;
  }

  .face.playable {
    cursor: pointer;
  }

  @media (hover: hover) {
    .face.playable:hover {
      transform: translateY(-6px);
      box-shadow: 0 4px 16px rgba(59, 47, 47, 0.18);
    }
  }

  .face.selected,
  .face.selected:hover {
    transform: translateY(-16px);
    background: var(--color-mustard-tint, #F3E2B6);
    box-shadow: 0 8px 20px rgba(59, 47, 47, 0.22);
    border-width: 3px;
  }

  .face.dimmed {
    opacity: 0.55;
  }

  .face:active.playable {
    transform: translateY(-12px) scale(0.98);
  }

  /* Back: the game's colour, a cream frame and a printed lattice. */
  .back {
    background-color: var(--card-back, var(--color-espresso, #3B2F2F));
    padding: calc(var(--w) * 0.07);
  }

  .back-inset {
    display: block;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 2px solid var(--card-back-ink, var(--color-cream, #FDF6EC));
    border-radius: calc(var(--w) * 0.08);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath d='M6 1.5 10.5 6 6 10.5 1.5 6z' fill='none' stroke='%233B2F2F' stroke-opacity='.35' stroke-width='1.4'/%3E%3C/svg%3E");
    background-size: calc(var(--w) * 0.19);
    background-position: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .face {
      transition: none;
    }
  }
</style>
