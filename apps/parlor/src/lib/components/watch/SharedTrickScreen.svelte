<script lang="ts">
  import type { GameView } from '@parlor/game-types';
  import { TrickTable, PlayingCard, SUIT_NAMES, type CardSuit } from '@parlor/ui';
  import SharedBoard from './SharedBoard.svelte';
  import SharedScores from './SharedScores.svelte';

  let {
    title, detail, round, trickNumber, players, plays, winnerId, trump, exposedCard, rows, scoreTitle = 'Standings',
  }: {
    title: string;
    detail?: string;
    round: number;
    trickNumber?: number;
    players: { id: string; name: string }[];
    plays: GameView<'hearts'>['trick'];
    winnerId?: string | null;
    trump?: CardSuit | null;
    exposedCard?: GameView<'hearts'>['trick'][number]['card'] | null;
    rows: { id: string; name: string; value: string | number; detail?: string; active?: boolean }[];
    scoreTitle?: string;
  } = $props();
</script>

<SharedBoard {title} {detail}>
  {#if trickNumber !== undefined}
    <div class="trick">
      <TrickTable seats={players.map(({ id, name }) => ({ id, label: name }))} {plays} {winnerId} title={`Round ${round} · Trick ${trickNumber}`}>
        {#snippet aside()}{trump ? `Trump · ${SUIT_NAMES[trump]}` : ''}{/snippet}
      </TrickTable>
    </div>
  {:else if exposedCard}
    <div class="up-card"><PlayingCard rank={exposedCard.rank} suit={exposedCard.suit} /></div>
  {:else}
    <p>Round {round}{trump ? ` · Trump is ${SUIT_NAMES[trump]}` : ''}</p>
  {/if}
  {#snippet sidebar()}<SharedScores title={scoreTitle} {rows} />{/snippet}
</SharedBoard>

<style>
  .trick { --trick-card-max: 145px; --trick-label-size: clamp(.85rem, 1.6vw, 1.4rem); width: min(100%, 58rem); }
  .up-card { --card-w: clamp(60px, 10vw, 140px); }
  p { margin: 0; font-size: clamp(1rem, 1.6vw, 1.5rem); }
</style>
