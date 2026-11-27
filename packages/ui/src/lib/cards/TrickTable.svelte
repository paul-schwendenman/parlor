<script lang="ts">
  /**
   * The trick in the middle of the table, drawn on a Felt. One slot per seat
   * in seat order, so you can see who has played and who is still to play.
   * The card taking the trick wears the mustard ring. Cards size themselves
   * to the felt, so six seats still fit on a phone.
   */
  import type { Snippet } from 'svelte';
  import type { Card } from '@parlor/cards';
  import PlayingCard from './PlayingCard.svelte';

  interface Props {
    /** Seats in table order; `label` is "You" for the viewer. */
    seats: readonly { id: string; label: string }[];
    plays: readonly { playerId: string; card: Card }[];
    winnerId?: string | null;
    /** Left of the heading row, e.g. "Trick 3 of 13". */
    title: string;
    /** Right of the heading row: trump, "Hearts broken". */
    aside?: Snippet;
  }

  let { seats, plays, winnerId = null, title, aside }: Props = $props();
</script>

<div class="trick">
  <header>
    <span>{title}</span>
    {#if aside}<span class="aside">{@render aside()}</span>{/if}
  </header>
  <ul aria-label="Cards played" style:--seats={seats.length}>
    {#each seats as seat (seat.id)}
      {@const play = plays.find((entry) => entry.playerId === seat.id)}
      <li class:winner={!!play && seat.id === winnerId}>
        {#if play}
          <span class="card"><PlayingCard rank={play.card.rank} suit={play.card.suit} /></span>
        {:else}
          <span class="slot" aria-hidden="true"></span>
        {/if}
        <small title={seat.label}>{seat.label}{#if !play}<span class="sr">, not played yet</span>{/if}</small>
      </li>
    {/each}
  </ul>
</div>

<style>
  .trick {
    container-type: inline-size;
    width: 100%;
    min-width: 0;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 16px;
    font-size: 0.85rem;
  }

  .aside {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  ul {
    --gap: 8px;
    --card-w: clamp(40px, calc((100cqi - (var(--seats) - 1) * var(--gap)) / var(--seats) - 6px), 80px);
    display: grid;
    grid-template-columns: repeat(var(--seats), minmax(0, 1fr));
    gap: var(--gap);
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 6px;
    min-width: 0;
  }

  .card,
  .slot {
    display: block;
    border-radius: calc(var(--card-w) * 0.1);
  }

  .slot {
    box-sizing: border-box;
    width: var(--card-w);
    height: calc(var(--card-w) * 1.4);
    border: 1.5px dashed var(--color-cream, #FDF6EC);
    opacity: 0.45;
  }

  .winner .card {
    outline: 3px solid var(--color-mustard, #D4A843);
    outline-offset: 3px;
  }

  small {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8rem;
  }

  .winner small {
    font-weight: 800;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
