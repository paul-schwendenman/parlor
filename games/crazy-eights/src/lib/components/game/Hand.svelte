<script lang="ts">
  import { PlayingCard } from '@parlor/ui';
  import type { Card } from '../../types/game.js';
  import { cardEquals } from '../../game/validation.js';

  let {
    cards,
    playable,
    selected,
    myTurn,
    onpick,
  }: {
    cards: Card[];
    /** Cards the server says can be played now. */
    playable: Card[];
    selected: Card | null;
    myTurn: boolean;
    onpick: (card: Card) => void;
  } = $props();

  const canPlay = (card: Card) => playable.some((c) => cardEquals(c, card));
  const isSelected = (card: Card) => selected !== null && cardEquals(selected, card);

  // One row that overlaps as it fills: every column but the last shrinks below
  // a card's width, so the cards fan instead of wrapping onto a second line.
  let columns = $derived(
    cards.length > 1
      ? `repeat(${cards.length - 1}, minmax(0, calc(var(--card-w) + 6px))) var(--card-w)`
      : 'var(--card-w)',
  );
</script>

<section class="hand-area" aria-labelledby="hand-title">
  <h2 id="hand-title" class="sr-only">Your hand, {cards.length} {cards.length === 1 ? 'card' : 'cards'}</h2>
  <div class="hand" style:grid-template-columns={columns}>
    {#each cards as card (card.suit + card.rank)}
      <div class="hand-card" class:raised={isSelected(card)}>
        <PlayingCard
          rank={card.rank}
          suit={card.suit}
          playable={myTurn && canPlay(card)}
          dimmed={myTurn && !canPlay(card)}
          selected={isSelected(card)}
          onclick={myTurn ? () => onpick(card) : undefined}
        />
      </div>
    {/each}
  </div>
</section>

<style>
  .hand-area {
    /* Room above for a selected card to lift into. */
    padding-top: 20px;
  }

  .hand {
    display: grid;
    justify-content: center;
  }

  .hand-card {
    position: relative;
    min-width: 0;
  }

  /* The lifted card sits above its neighbours; hover does too, so the whole
     face is readable before you commit. */
  .hand-card.raised,
  .hand-card:hover {
    z-index: 2;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
