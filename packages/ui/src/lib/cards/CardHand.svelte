<script lang="ts">
  /**
   * The viewer's hand: one row of PlayingCards that overlaps as it fills
   * instead of wrapping. The game decides what is playable and what a pick
   * means; this only draws the hand and reports taps.
   */
  import PlayingCard from './PlayingCard.svelte';
  import { cardEquals, type Card } from '@parlor/cards';

  interface Props {
    cards: Card[];
    /** Whether the viewer can act on their hand right now. */
    active: boolean;
    isPlayable: (card: Card) => boolean;
    selected: Card | readonly Card[] | null;
    isMarked?: (card: Card) => boolean;
    onpick: (card: Card) => void;
  }

  let { cards, active, isPlayable, selected, isMarked, onpick }: Props = $props();

  let multiple = $derived(Array.isArray(selected));

  const isSelected = (card: Card) =>
    selected !== null && (
      'suit' in selected ? cardEquals(selected, card) : selected.some((choice) => cardEquals(choice, card))
    );

  // Every column but the last can shrink below a card's width, so the cards
  // fan over each other rather than wrapping onto a second line.
  let columns = $derived(
    cards.length > 1
      ? `repeat(${cards.length - 1}, minmax(0, calc(var(--card-w, 64px) + 6px))) var(--card-w, 64px)`
      : 'var(--card-w, 64px)',
  );
</script>

<section class="hand-area" aria-label="Your hand, {cards.length} {cards.length === 1 ? 'card' : 'cards'}">
  <div class="hand" class:multiple style:grid-template-columns={columns}>
    {#each cards as card (card.suit + card.rank)}
      <div class="hand-card" class:raised={!multiple && isSelected(card)}>
        <PlayingCard
          rank={card.rank}
          suit={card.suit}
          playable={active && isPlayable(card)}
          dimmed={active && !isPlayable(card)}
          selected={isSelected(card)}
          marked={isMarked?.(card)}
          onclick={active ? () => onpick(card) : undefined}
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

  /* The lifted or hovered card sits above its neighbours, so its whole face
     is readable before you commit. */
  .hand-card.raised,
  .hand:not(.multiple) .hand-card:hover {
    z-index: 2;
  }
</style>
