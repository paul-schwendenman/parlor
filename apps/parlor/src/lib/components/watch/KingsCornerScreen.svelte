<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import { PlayingCard } from '@parlor/ui';
  import SharedBoard from './SharedBoard.svelte';
  import SharedScores from './SharedScores.svelte';

  let { view }: { view: GameView<'kings-corner'> } = $props();
  const positions = ['northwest', 'north', 'northeast', 'west', 'stock', 'east', 'southwest', 'south', 'southeast'] as const;
  let active = $derived(view.players[view.activePlayerIndex]);
  let title = $derived(view.gameOver ? view.winner ? `${view.winner.name} wins!` : 'Game over' : `${active?.name}’s turn`);
</script>

<SharedBoard {title} detail={view.gameOver ? undefined : view.phase === 'drawing' ? 'Draw a card' : 'Build down in alternating colors'}>
  {#if !view.gameOver}
    <ul class="piles" aria-label="Public card piles">
      {#each positions as position (position)}
        {@const cards = view.piles.find((pile) => pile.position === position)?.cards ?? []}
        <li>
          {#if position === 'stock'}
            {#if view.drawPileCount}<PlayingCard faceDown />{:else}<span class="empty"></span>{/if}
            <span>Stock · {view.drawPileCount}</span>
          {:else}
            {@const top = cards.at(-1)}
            {#if top}<PlayingCard rank={top.rank} suit={top.suit} />{:else}<span class="empty"></span>{/if}
            <span>{position} · {cards.length}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#snippet sidebar()}
    <SharedScores title={view.penalties ? 'Penalty points' : 'Cards remaining'} rows={view.players.map((player) => ({ ...player, value: view.penalties?.[player.id] ?? player.cardCount, active: !view.gameOver && player.id === active?.id }))} />
  {/snippet}
</SharedBoard>

<style>
  .piles { --card-w: clamp(38px, 6vw, 76px); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: min(100%, 36rem); gap: 10px; padding: 0; margin: 0; list-style: none; }
  li { display: grid; justify-items: center; gap: 4px; min-width: 0; text-transform: capitalize; font-size: clamp(.73rem, 1.25vw, 1.05rem); }
  .empty { width: var(--card-w); aspect-ratio: 5 / 7; box-sizing: border-box; border: 2px dashed currentColor; border-radius: 8px; opacity: .45; }
</style>
