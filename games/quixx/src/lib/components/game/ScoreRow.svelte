<script lang="ts">
  import type { RowColor, AvailableMove } from '../../types/game.js';
  import { ROW_NUMBERS } from '../../types/game.js';
  import ScoreCell from './ScoreCell.svelte';

  let {
    color,
    marks,
    locked,
    availableMoves,
    selectedCellIndex = null,
    onselect,
  }: {
    color: RowColor;
    marks: boolean[];
    locked: boolean;
    availableMoves: AvailableMove[];
    selectedCellIndex?: number | null;
    onselect?: (cellIndex: number) => void;
  } = $props();

  let numbers = $derived(ROW_NUMBERS[color]);
</script>

<div class="score-row">
  <span class="row-label {color}">{color.toUpperCase()}</span>
  <div class="cells">
    {#each numbers as num, i}
      <ScoreCell
        number={num}
        {color}
        marked={marks[i]}
        available={availableMoves.some((m) => m.cellIndex === i)}
        selected={selectedCellIndex === i}
        {locked}
        onselect={() => onselect?.(i)}
      />
    {/each}
    <ScoreCell
      number={0}
      {color}
      marked={locked}
      available={false}
      {locked}
      isLockCell
    />
  </div>
</div>

<style>
  .score-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
  }
  .row-label {
    width: 56px;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    padding: 4px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .row-label.red { background: #dc2626; color: white; }
  .row-label.yellow { background: #eab308; color: white; }
  .row-label.green { background: #16a34a; color: white; }
  .row-label.blue { background: #2563eb; color: white; }
  .cells {
    display: flex;
    gap: 2px;
    flex-wrap: nowrap;
  }
</style>
