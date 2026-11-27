<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { TurnBanner, SeatChip, GameOver, Button, CardHand, cardName } from '@parlor/ui';
  import type { Card, PilePosition, KingsCornerPlayerView } from '../../types/game.js';
  import { cardEquals } from '../../game/validation.js';
  import Board from './Board.svelte';

  let {
    view,
    socket,
    playerId,
  }: {
    view: KingsCornerPlayerView;
    socket: GameSocket<'kings-corner'>;
    playerId: string;
  } = $props();

  // What the viewer has picked up: a card from the hand or a whole pile.
  let selectedCard = $state<Card | null>(null);
  let selectedPile = $state<PilePosition | null>(null);

  let playing = $derived(view.isActivePlayer && view.phase === 'playing');
  let canDraw = $derived(view.isActivePlayer && view.phase === 'drawing' && view.drawPileCount > 0);

  const playEntry = (card: Card) => view.playableCards.find((p) => cardEquals(p.card, card));
  const moveEntry = (pos: PilePosition) => view.movablePiles.find((m) => m.from === pos);

  // Drop a selection the server no longer allows (turn over, board changed).
  $effect(() => {
    const card = selectedCard;
    const pile = selectedPile;
    if (!playing) {
      selectedCard = null;
      selectedPile = null;
      return;
    }
    if (card && !playEntry(card)) selectedCard = null;
    if (pile && !moveEntry(pile)) selectedPile = null;
  });

  let targets = $derived<PilePosition[]>(
    selectedCard ? (playEntry(selectedCard)?.validTargets ?? []) : selectedPile ? (moveEntry(selectedPile)?.validTargets ?? []) : [],
  );
  let movable = $derived<PilePosition[]>(playing && !selectedCard && !selectedPile ? view.movablePiles.map((m) => m.from) : []);

  let activeName = $derived(view.players[view.activePlayerIndex]?.name ?? 'Someone');

  let banner = $derived.by(() => {
    if (!view.isActivePlayer) return { title: `${activeName}'s turn`, detail: undefined };
    if (view.phase === 'drawing') return { title: 'Your turn', detail: 'Draw a card to start.' };
    if (selectedCard) return { title: 'Your turn', detail: `Tap a ringed pile to play the ${cardName(selectedCard.rank, selectedCard.suit)}.` };
    if (selectedPile) return { title: 'Your turn', detail: 'Tap a ringed pile to move this pile onto it.' };
    if (view.mustPlayKing) return { title: 'Play your King', detail: 'A King in your hand has to go to an empty corner before you end your turn.' };
    if (view.playableCards.length === 0 && view.movablePiles.length === 0) return { title: 'Your turn', detail: 'No moves left. End your turn.' };
    return { title: 'Your turn', detail: 'Play cards onto the piles, then end your turn.' };
  });

  let opponents = $derived(
    view.players.map((p, seat) => ({ ...p, seat })).filter((p) => p.seat !== view.myIndex),
  );

  // Penalties are revealed only when an empty stock stalls the game: then the
  // lowest penalty wins and ties share a place.
  let standings = $derived.by(() => {
    const penalties = view.penalties;
    const rows = view.players
      .map((p, seat) => ({ ...p, seat, score: penalties?.[p.id] ?? p.cardCount }))
      .filter(({ id }) => !penalties || Object.hasOwn(penalties, id))
      .sort((a, b) => a.score - b.score);
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      place: rows.findIndex((r) => r.score === p.score) + 1,
      detail: penalties
        ? `${p.score} penalty ${p.score === 1 ? 'point' : 'points'}`
        : p.cardCount === 0
          ? 'Went out'
          : `${p.cardCount} ${p.cardCount === 1 ? 'card' : 'cards'} left`,
      winner: p.id === view.winner?.id,
      you: p.id === playerId,
      bot: p.isBot,
    }));
  });

  let headline = $derived(
    view.winner ? (view.winner.id === playerId ? 'You win!' : `${view.winner.name} wins!`) : "It's a tie",
  );

  function pickCard(card: Card) {
    selectedPile = null;
    selectedCard = selectedCard && cardEquals(selectedCard, card) ? null : card;
  }

  function tapPile(position: PilePosition) {
    if (targets.includes(position)) {
      if (selectedCard) socket.emit('game:action', { type: 'play-card', card: selectedCard, target: position });
      else if (selectedPile) socket.emit('game:action', { type: 'move-pile', from: selectedPile, to: position });
      selectedCard = null;
      selectedPile = null;
      return;
    }
    selectedCard = null;
    selectedPile = selectedPile === position || !moveEntry(position) ? null : position;
  }

  function draw() {
    socket.emit('game:action', { type: 'draw-card' });
  }

  function endTurn() {
    socket.emit('game:action', { type: 'end-turn' });
  }

  const playAgain = () => socket.emit('lobby:restartGame');
  const backToLobby = () => socket.emit('lobby:resetGame');
</script>

<div class="board-page">
  {#if view.gameOver}
    <GameOver
      {headline}
      detail={view.penalties
        ? 'The stock ran out and everyone passed. Lowest penalty wins: Kings count 10, other cards 1.'
        : 'First to play every card.'}
      {standings}
      onplayagain={playerId ? playAgain : undefined}
      onlobby={playerId ? backToLobby : undefined}
    />
  {:else}
    <TurnBanner mine={view.isActivePlayer} title={banner.title} detail={banner.detail} />

    <ul class="seats" aria-label="Other players">
      {#each opponents as p (p.id)}
        <li>
          <SeatChip
            name={p.name}
            seat={p.seat}
            stat="{p.cardCount} {p.cardCount === 1 ? 'card' : 'cards'}"
            active={p.seat === view.activePlayerIndex}
            connected={p.connected}
            bot={p.isBot}
          />
        </li>
      {/each}
    </ul>

    <Board
      piles={view.piles}
      drawCount={view.drawPileCount}
      {canDraw}
      {targets}
      {movable}
      {selectedPile}
      ondraw={draw}
      onpile={tapPile}
    />

    {#if playing}
      <div class="end-turn">
        <Button shout disabled={!view.canEndTurn} onclick={endTurn}>End turn</Button>
      </div>
    {/if}

    {#if view.myHand.length > 0}
      <CardHand
        cards={view.myHand}
        active={playing}
        isPlayable={(card) => !!playEntry(card as Card)}
        selected={selectedCard}
        onpick={(card) => pickCard(card as Card)}
      />
    {/if}
  {/if}
</div>

<style>
  /* Kings Corner prints its card backs on Linen, its shelf colour. */
  .board-page {
    --card-w: 60px;
    --card-back: var(--color-linen);
    --card-back-ink: var(--color-espresso);
    max-width: 560px;
    margin: 0 auto;
    padding: 4px 16px 32px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--color-espresso);
    font-family: var(--font-body);
  }

  @media (min-width: 600px) {
    .board-page {
      --card-w: 72px;
      gap: 20px;
    }
  }

  .seats {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .seats li {
    max-width: 100%;
  }

  .end-turn {
    display: flex;
    justify-content: center;
  }

  .end-turn :global(.btn) {
    width: 100%;
    max-width: 320px;
  }
</style>
