<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import { PipDie } from '@parlor/ui';
  import { totalScore } from '@parlor/quixx/scoring';
  import SharedBoard from './SharedBoard.svelte';
  import SharedScores from './SharedScores.svelte';

  let { view }: { view: GameView<'quixx'> } = $props();
  const colors = ['red', 'yellow', 'green', 'blue'] as const;
  let active = $derived(view.players[view.activePlayerIndex]);
  let rows = $derived(view.players.map((player) => ({
    ...player, value: totalScore(player), active: !view.gameOver && player.id === active?.id,
    detail: view.phase === 'phase1' ? player.phase1Submitted ? 'Ready' : 'Choosing' : undefined,
  })).sort((a, b) => b.value - a.value));
  let winners = $derived(rows.filter(({ value }) => value === rows[0]?.value));
  let title = $derived(view.gameOver ? winners.length === 1 ? `${winners[0].name} wins!` : 'Shared win!'
    : view.phase === 'phase1' ? 'Everyone can mark' : `${active?.name}’s turn`);
  let detail = $derived(view.phase === 'phase1' ? 'Use the sum of both white dice'
    : view.phase === 'phase2' ? `${active?.name} can combine a white die and a colored die`
    : view.phase === 'rolling' ? 'Rolling the dice' : undefined);
</script>

<SharedBoard {title} {detail}>
  {#if view.dice.rolled && !view.gameOver}
    <div class="dice" aria-label="White dice">
      <PipDie value={view.dice.white1} /><PipDie value={view.dice.white2} />
      <strong>= {view.dice.white1 + view.dice.white2}</strong>
    </div>
    <div class="dice" aria-label="Colored dice">
      {#each colors as color (color)}
        {#if !view.removedDice.includes(color)}
          <div class={color}><PipDie value={view.dice[color]} label={`${color} die showing ${view.dice[color]}`} /></div>
        {/if}
      {/each}
    </div>
  {/if}
  {#if view.lockedRows.length}<p>Locked rows · {view.lockedRows.join(', ')}</p>{/if}
  {#snippet sidebar()}<SharedScores {rows} />{/snippet}
</SharedBoard>

<style>
  .dice { --die-size: clamp(45px, 7vw, 95px); display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 12px; }
  strong { font: 900 clamp(2rem, 4vw, 4rem)/1 var(--font-heading); }
  .red { --die-face: #f3b9ae; } .yellow { --die-face: #f5d26d; }
  .green { --die-face: #a7d4a6; } .blue { --die-face: #a9cee8; }
  p { margin: 0; text-transform: capitalize; }
</style>
