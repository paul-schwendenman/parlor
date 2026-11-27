<script lang="ts">
  /**
   * The printed Quixx scoresheet: four colour bands of numbered boxes, crossed
   * off in pen, a lock at the end of each row, penalties and the running score
   * along the bottom. Twelve columns share the width, so it never scrolls
   * sideways on a phone.
   */
  import type { Scoresheet as ScoresheetType, RowColor, AvailableMove } from '../../types/game.js';
  import { ROW_COLORS, ROW_NUMBERS } from '../../types/game.js';

  let {
    sheet,
    penalties,
    score,
    lockedRows,
    closedRows = [],
    availableMoves = [],
    selectedMove = null,
    phase2Preview = [],
    onselect,
  }: {
    sheet: ScoresheetType;
    penalties: number;
    score: number;
    /** Rows this player locked. */
    lockedRows: RowColor[];
    /** Rows locked by anyone: closed for everybody. */
    closedRows?: RowColor[];
    availableMoves?: AvailableMove[];
    selectedMove?: { row: RowColor; cellIndex: number } | null;
    /** Colour combos the active player will be offered next. */
    phase2Preview?: AvailableMove[];
    onselect?: (row: RowColor, cellIndex: number) => void;
  } = $props();

  const ROW_NAMES: Record<RowColor, string> = { red: 'Red', yellow: 'Yellow', green: 'Green', blue: 'Blue' };

  function lastMarked(marks: boolean[]): number {
    return marks.lastIndexOf(true);
  }

  function cellState(row: RowColor, i: number) {
    const marked = sheet[row][i];
    const closed = closedRows.includes(row) || lockedRows.includes(row);
    const available = !marked && !closed && availableMoves.some((m) => m.row === row && m.cellIndex === i);
    return {
      marked,
      available,
      selected: selectedMove?.row === row && selectedMove.cellIndex === i,
      preview: !available && phase2Preview.some((m) => m.row === row && m.cellIndex === i),
      // Boxes left of your last cross can never be crossed.
      skipped: !marked && (i < lastMarked(sheet[row]) || closed),
    };
  }

  function cellLabel(row: RowColor, n: number, s: ReturnType<typeof cellState>): string {
    const state = s.marked ? 'crossed off' : s.selected ? 'selected' : s.available ? 'available' : s.skipped ? 'out of play' : '';
    return [ROW_NAMES[row], n, state].filter(Boolean).join(' ');
  }
</script>

<section class="scoresheet" aria-label="Your scoresheet">
  {#each ROW_COLORS as row (row)}
    {@const locked = lockedRows.includes(row)}
    {@const closed = closedRows.includes(row) || locked}
    <div class="band band-{row}" class:closed role="group" aria-label="{ROW_NAMES[row]} row{closed ? ', locked' : ''}">
      {#each ROW_NUMBERS[row] as n, i (i)}
        {@const s = cellState(row, i)}
        <button
          type="button"
          class="cell"
          class:marked={s.marked}
          class:available={s.available}
          class:selected={s.selected}
          class:preview={s.preview}
          class:skipped={s.skipped}
          disabled={!s.available || !onselect}
          aria-label={cellLabel(row, n, s)}
          aria-pressed={s.available ? s.selected : undefined}
          onclick={() => onselect?.(row, i)}
        >
          <span class="num" aria-hidden="true">{n}</span>
          {#if s.marked}
            <svg class="cross" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
          {/if}
        </button>
      {/each}
      <span class="lock" class:locked role="img" aria-label={locked ? 'You locked this row' : 'Lock'}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2.5" />
          <path d={locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'} />
        </svg>
      </span>
    </div>
  {/each}

  <div class="footer">
    <div class="penalties">
      <span class="foot-label" aria-hidden="true">Penalties</span>
      <span class="boxes" role="img" aria-label="{penalties} of 4 penalties, minus 5 each">
        {#each [0, 1, 2, 3] as i (i)}
          <span class="pbox" class:filled={i < penalties}>
            {#if i < penalties}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>{/if}
          </span>
        {/each}
      </span>
      <span class="hint">−5 each</span>
    </div>
    <p class="score"><span class="foot-label">Score</span> <strong>{score}</strong></p>
  </div>
</section>

<style>
  .scoresheet {
    box-sizing: border-box;
    padding: 10px 8px 8px;
    border: 2.5px solid var(--color-espresso);
    border-radius: 18px;
    background: var(--color-paper);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Each row is a band of its ink colour holding tinted boxes, as printed. */
  .band {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 2px;
    padding: 3px;
    border: 2px solid var(--color-espresso);
    border-radius: 12px;
    background: var(--solid);
  }

  .band-red { --solid: var(--row-red); --tint: var(--row-red-tint); --ink: var(--row-red-ink); }
  .band-yellow { --solid: var(--row-yellow); --tint: var(--row-yellow-tint); --ink: var(--color-espresso); }
  .band-green { --solid: var(--row-green); --tint: var(--row-green-tint); --ink: var(--color-forest-deep); }
  .band-blue { --solid: var(--row-blue); --tint: var(--row-blue-tint); --ink: var(--row-blue-ink); }

  .cell,
  .lock {
    position: relative;
    height: 40px;
    min-width: 0;
    box-sizing: border-box;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cell {
    padding: 0;
    border: 2px solid transparent;
    background: var(--tint);
    color: var(--ink);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: clamp(0.8125rem, 3.6vw, 1.0625rem);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    cursor: default;
    transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1), background 0.16s ease;
  }

  .cell.skipped .num {
    opacity: 0.35;
  }

  /* A pen cross over the number. */
  .cross {
    position: absolute;
    inset: 4px;
    fill: none;
    stroke: var(--color-espresso);
    stroke-width: 3.2;
    stroke-linecap: round;
  }

  .cell.marked .num {
    opacity: 0.3;
  }

  /* Boxes you can cross now: paper, inked round. */
  .cell.available {
    background: var(--color-paper);
    border-color: var(--color-espresso);
    cursor: pointer;
  }

  @media (hover: hover) {
    .cell.available:hover {
      transform: translateY(-2px);
    }
  }

  /* Picked, waiting for confirm: the pen is over this box. Ink fill, because
     butter would vanish into the yellow row. */
  .cell.selected {
    background: var(--color-espresso);
    color: var(--color-cream);
    border-color: var(--color-espresso);
    border-width: 3px;
    transform: translateY(-3px);
    box-shadow: 0 4px 10px rgba(59, 47, 47, 0.3);
    z-index: 1;
  }

  /* The colour combos coming next turn. */
  .cell.preview {
    border: 2px dashed var(--color-espresso);
  }

  .cell:focus-visible {
    outline: 3px solid var(--color-espresso);
    outline-offset: 1px;
    z-index: 2;
  }

  .lock {
    border-radius: 50%;
    aspect-ratio: 1;
    height: auto;
    max-height: 40px;
    align-self: center;
    justify-self: center;
    width: 100%;
    max-width: 40px;
    background: var(--tint);
    color: var(--ink);
  }

  .lock svg {
    width: 62%;
    height: 62%;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .lock.locked {
    background: var(--color-espresso);
    color: var(--color-cream);
  }

  /* A row locked by anyone is closed: its open boxes fade out. */
  .band.closed .cell:not(.marked) {
    background: color-mix(in srgb, var(--tint) 60%, var(--solid));
  }

  .footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 6px 4px 0;
  }

  .penalties {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .foot-label {
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .boxes {
    display: flex;
    gap: 4px;
  }

  .pbox {
    width: 26px;
    height: 26px;
    box-sizing: border-box;
    border: 2px solid var(--color-espresso);
    border-radius: 6px;
    background: var(--color-paper);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pbox.filled {
    background: var(--color-linen);
  }

  .pbox svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: var(--color-danger);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .hint {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-ink-muted);
  }

  .score {
    margin: 0 0 0 auto;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .score strong {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.75rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  @media (min-width: 600px) {
    .scoresheet {
      padding: 14px 12px 10px;
      gap: 8px;
    }

    .band {
      gap: 4px;
      padding: 4px;
    }

    .cell {
      height: 44px;
    }

    .lock {
      max-height: 44px;
      max-width: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cell {
      transition: none;
    }
  }
</style>
