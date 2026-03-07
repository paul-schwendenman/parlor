<script lang="ts">
  import type { Scoresheet as ScoresheetType, RowColor, AvailableMove } from '../../types/game.js';
  import { ROW_COLORS } from '../../types/game.js';
  import ScoreRow from './ScoreRow.svelte';
  import PenaltyTracker from './PenaltyTracker.svelte';

  let {
    sheet,
    penalties,
    score,
    lockedRows,
    availableMoves,
    onmark,
  }: {
    sheet: ScoresheetType;
    penalties: number;
    score: number;
    lockedRows: RowColor[];
    availableMoves: AvailableMove[];
    onmark?: (row: RowColor, cellIndex: number) => void;
  } = $props();
</script>

<div class="scoresheet">
  {#each ROW_COLORS as color}
    <ScoreRow
      {color}
      marks={sheet[color]}
      locked={lockedRows.includes(color)}
      availableMoves={availableMoves.filter((m) => m.row === color)}
      onmark={(cellIndex) => onmark?.(color, cellIndex)}
    />
  {/each}
  <PenaltyTracker {penalties} {score} />
</div>

<style>
  .scoresheet {
    background: white;
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow-x: auto;
  }
</style>
