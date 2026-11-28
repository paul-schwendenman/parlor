<script lang="ts">
  /**
   * A printed character card for games whose cards are named people rather
   * than suits (Love Letter, Coup): paper stock, ink outline, a big Nunito
   * value or initial top-left, the name, and an optional one-line effect.
   * Same stock, size (`--card-w`) and back (`--card-back`) as PlayingCard.
   */
  interface Props {
    name?: string;
    /** Printed top-left: a value ("7") or a short mark. */
    corner?: string | number;
    /** One plain-words line, shown when the card is wide enough. */
    effect?: string;
    faceDown?: boolean;
    playable?: boolean;
    selected?: boolean;
    marked?: boolean;
    dimmed?: boolean;
    /** Revealed and out of play (a lost influence, a knocked-out hand). */
    spent?: boolean;
    /** Only the corner mark, centred: for small trails of played cards. */
    compact?: boolean;
    label?: string;
    onclick?: () => void;
  }

  let {
    name = '', corner = '', effect, faceDown = false, playable = false, selected = false, marked = false,
    dimmed = false, spent = false, compact = false, label, onclick,
  }: Props = $props();

  let accessible = $derived(label ?? (faceDown ? 'Face-down card' : [corner, name].filter((part) => part !== '').join(' ')));
</script>

{#if faceDown}
  <div class="card back" role="img" aria-label={accessible}><span class="back-inset"></span></div>
{:else if onclick}
  <button type="button" class="card face" class:playable class:selected class:marked class:dimmed class:spent class:compact
    aria-label={accessible} aria-pressed={selected} disabled={!playable} {onclick}>
    {@render face()}
  </button>
{:else}
  <div class="card face" class:marked class:dimmed class:spent class:compact role="img" aria-label={accessible}>
    {@render face()}
  </div>
{/if}

{#snippet face()}
  <span class="corner" aria-hidden="true">{corner}</span>
  {#if !compact}<span class="name" aria-hidden="true">{name}</span>{/if}
  {#if effect && !compact}<span class="effect" aria-hidden="true">{effect}</span>{/if}
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
    text-align: left;
  }

  .face {
    background: var(--color-paper, #FFFFFF);
    color: var(--color-espresso, #3B2F2F);
    cursor: default;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease, opacity 0.2s ease;
  }

  .face.marked { border-color: var(--color-forest-deep, #2F5A3E); box-shadow: 0 0 0 2px var(--color-forest-deep, #2F5A3E); }

  .face:not(.compact) {
    display: flex;
    flex-direction: column;
    gap: calc(var(--w) * 0.04);
    padding: calc(var(--w) * 0.06) calc(var(--w) * 0.08);
    overflow: hidden;
  }

  .corner {
    min-height: calc(var(--w) * 0.34);
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 900;
    font-size: calc(var(--w) * 0.34);
    line-height: 1;
  }

  .corner:empty { display: none; }

  .name {
    font-family: var(--font-heading, 'Nunito', system-ui, sans-serif);
    font-weight: 800;
    font-size: max(10px, calc(var(--w) * 0.13));
    line-height: 1.1;
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .effect {
    font-size: max(9px, calc(var(--w) * 0.1));
    line-height: 1.2;
    color: var(--color-ink-muted, #71625A);
  }

  .compact .corner { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--w) * 0.5); }

  button.face:disabled { cursor: default; }
  .face.playable { cursor: pointer; }

  @media (hover: hover) {
    .face.playable:hover { transform: translateY(-6px); box-shadow: 0 4px 16px rgba(59, 47, 47, 0.18); }
  }

  .face.selected,
  .face.selected:hover {
    transform: translateY(-14px);
    background: var(--color-mustard-tint, #F3E2B6);
    box-shadow: 0 8px 20px rgba(59, 47, 47, 0.22);
    border-width: 3px;
  }

  .face.dimmed { background: var(--color-linen, #F5EDE0); border-color: rgba(59, 47, 47, 0.45); }
  .face.dimmed > * { opacity: 0.45; }

  .face.spent { background: var(--color-linen, #F5EDE0); }
  .face.spent::after {
    content: '';
    position: absolute;
    inset: 12% 10%;
    background: linear-gradient(to top right, transparent calc(50% - 1.5px), var(--color-danger, #991B1B) calc(50% - 1.5px), var(--color-danger, #991B1B) calc(50% + 1.5px), transparent calc(50% + 1.5px));
    opacity: 0.7;
  }

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
    .face { transition: none; }
  }
</style>
