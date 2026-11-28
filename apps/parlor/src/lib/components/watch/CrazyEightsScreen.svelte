<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import { PlayingCard, SUIT_NAMES, SuitIcon } from '@parlor/ui';
  import SharedBoard from './SharedBoard.svelte';
  import SharedScores from './SharedScores.svelte';

  let { view }: { view: GameView<'crazy-eights'> } = $props();
  let active = $derived(view.players[view.activePlayerIndex]);
  let suit = $derived(view.declaredSuit ?? view.topDiscard?.suit);
  let title = $derived(view.gameOver ? view.winner ? `${view.winner.name} wins!` : 'Game over' : `${active?.name}’s turn`);
</script>

<SharedBoard {title} detail={view.gameOver ? undefined : view.phase === 'choosing-suit' ? 'Choosing a suit' : 'Match suit or rank, or play an eight'}>
  {#if !view.gameOver}
    <div class="piles" aria-label="Draw and discard piles">
      <div>{#if view.drawPileCount}<PlayingCard faceDown />{:else}<span class="empty"></span>{/if}<strong>{view.drawPileCount} in stock</strong></div>
      <div>{#if view.topDiscard}<PlayingCard rank={view.topDiscard.rank} suit={view.topDiscard.suit} />{:else}<span class="empty"></span>{/if}<strong>Discard</strong></div>
    </div>
    {#if suit && view.phase !== 'choosing-suit'}
      <div class="suit"><SuitIcon {suit} />{SUIT_NAMES[suit]} {view.declaredSuit ? 'called' : 'in play'}</div>
    {/if}
  {/if}
  {#snippet sidebar()}
    <SharedScores title="Cards remaining" rows={view.players.map((player) => ({ ...player, value: player.cardCount, active: !view.gameOver && player.id === active?.id }))} />
  {/snippet}
</SharedBoard>

<style>
  .piles { --card-w: clamp(55px, 11vw, 145px); display: flex; align-items: end; gap: clamp(18px, 7vw, 110px); }
  .piles div { display: grid; justify-items: center; gap: 10px; }
  .empty { width: var(--card-w); aspect-ratio: 5 / 7; box-sizing: border-box; border: 2px dashed currentColor; border-radius: 8px; opacity: .45; }
  .suit { display: flex; align-items: center; gap: 8px; background: var(--color-linen); color: var(--color-espresso); border-radius: 999px; padding: 8px 14px; font-weight: 900; }
  .suit :global(svg) { width: 1.2rem; height: 1.2rem; }
</style>
