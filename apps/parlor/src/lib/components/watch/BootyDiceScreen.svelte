<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import FaceIcon from '@parlor/booty-dice/face-icon';
  import SharedBoard from './SharedBoard.svelte';
  import SharedScores from './SharedScores.svelte';

  let { view }: { view: GameView<'booty-dice'> } = $props();
  let active = $derived(view.players[view.currentPlayerIndex]);
  let winner = $derived(view.players.find(({ id }) => id === view.winnerId));
  let title = $derived(view.phase === 'ended' ? winner ? `${winner.name} wins!` : 'Game over' : `${active?.name}’s turn`);
  let detail = $derived(view.phase === 'ended' ? undefined
    : view.turnPhase === 'selecting_targets' ? 'Choosing a target'
    : view.turnPhase === 'resolving' ? 'Resolving the roll'
    : `${view.rollsRemaining} ${view.rollsRemaining === 1 ? 'roll' : 'rolls'} left`);
  const labels: Record<GameView<'booty-dice'>['dice'][number]['face'], string> = {
    doubloon: 'Doubloon', x_marks_spot: 'X Marks the Spot', jolly_roger: 'Jolly Roger',
    cutlass: 'Cutlass', walk_plank: 'Walk the Plank', shield: 'Shield',
  };
</script>

<SharedBoard {title} {detail}>
  {#if view.phase !== 'ended'}
    <ul class="dice" aria-label="Pirate dice">
      {#each view.dice as die (die.id)}
        <li class:locked={die.locked}>
          <FaceIcon face={die.face} size="62%" />
          <span>{labels[die.face]}{die.locked ? ' · Kept' : ''}</span>
        </li>
      {/each}
    </ul>
  {/if}
  {#snippet sidebar()}
    <SharedScores title="Crews" rows={view.players.map((player) => ({ ...player, value: `${player.doubloons} coins`, active: view.phase === 'playing' && player.id === active?.id, detail: player.isEliminated ? 'Out' : `${player.lives} lives · ${player.shields} shields` }))} />
    {#if view.gameLog.length}
      <h3>Latest events</h3>
      <ul class="events">
        {#each view.gameLog.slice(-3).reverse() as event, index (index)}<li>{event.message}</li>{/each}
      </ul>
    {/if}
  {/snippet}
</SharedBoard>

<style>
  ul { margin: 0; padding: 0; list-style: none; }
  .dice { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
  .dice li { display: grid; justify-items: center; align-content: center; gap: 4px; width: clamp(65px, 8vw, 120px); aspect-ratio: 1; padding: 4px; border: 2px solid var(--color-espresso); border-radius: 14px; background: var(--color-cream); color: var(--color-espresso); font-weight: 800; }
  .dice li.locked { background: var(--color-mustard-tint); }
  .dice span { font-size: clamp(.65rem, 1vw, .9rem); }
  .events li { padding-block: 6px; border-bottom: 1px solid var(--color-espresso); }
</style>
