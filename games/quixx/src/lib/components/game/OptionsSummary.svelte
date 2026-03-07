<script lang="ts">
  import type { AvailableMove } from '../../types/game.js';

  let {
    phase,
    isActivePlayer,
    whiteSum,
    availableMoves,
    phase2Preview,
  }: {
    phase: string;
    isActivePlayer: boolean;
    whiteSum: number | null;
    availableMoves: AvailableMove[];
    phase2Preview: AvailableMove[];
  } = $props();

  let whiteSumRows = $derived(
    availableMoves
      .filter((m) => m.source === 'white-sum')
      .map((m) => m.row.charAt(0).toUpperCase() + m.row.slice(1)),
  );

  let coloredCombos = $derived(
    phase === 'phase1'
      ? phase2Preview
      : availableMoves.filter((m) => m.source === 'colored-combo'),
  );

  let comboDescriptions = $derived(
    coloredCombos.map(
      (m) => `${m.row.charAt(0).toUpperCase() + m.row.slice(1)} ${m.number}`,
    ),
  );

  let showWhiteSum = $derived(phase === 'phase1' && whiteSum !== null);
  let showCombos = $derived(
    (phase === 'phase1' && isActivePlayer && coloredCombos.length > 0) ||
      (phase === 'phase2' && availableMoves.length > 0),
  );
  let noMoves = $derived(
    (phase === 'phase1' && availableMoves.length === 0) ||
      (phase === 'phase2' && isActivePlayer && availableMoves.length === 0),
  );
</script>

<div class="options-summary">
  {#if showWhiteSum}
    <p>
      White sum: <strong>{whiteSum}</strong>
      {#if whiteSumRows.length > 0}
        &mdash; available in {whiteSumRows.join(', ')}
      {:else}
        &mdash; no rows available
      {/if}
    </p>
  {/if}

  {#if showCombos}
    <p class:preview={phase === 'phase1'}>
      Colored combos: {comboDescriptions.join(', ')}
      {#if phase === 'phase1'}
        <span class="preview-label">(upcoming)</span>
      {/if}
    </p>
  {/if}

  {#if noMoves}
    <p class="no-moves">No options &mdash; you must pass</p>
  {/if}
</div>

<style>
  .options-summary {
    text-align: center;
    padding: 4px 12px;
    margin-bottom: 8px;
    font-size: 14px;
    color: #4b5563;
  }
  p {
    margin: 2px 0;
  }
  .preview {
    opacity: 0.7;
    font-style: italic;
  }
  .preview-label {
    font-size: 12px;
    color: #9ca3af;
  }
  .no-moves {
    color: #dc2626;
    font-weight: 600;
  }
</style>
