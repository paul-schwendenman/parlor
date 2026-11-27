<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { TurnBanner, SeatChip, GameOver, Button, cardName } from '@parlor/ui';
  import type { Card, Suit, CrazyEightsPlayerView } from '../../types/game.js';
  import { cardEquals } from '../../game/validation.js';
  import Hand from './Hand.svelte';
  import Table from './Table.svelte';

  let {
    view,
    socket,
    playerId,
  }: {
    view: CrazyEightsPlayerView;
    socket: GameSocket<'crazy-eights'>;
    playerId: string;
  } = $props();

  let selectedCard = $state<Card | null>(null);

  // A selection only means something while that card is still playable.
  $effect(() => {
    const card = selectedCard;
    if (card && !(view.isActivePlayer && view.playableCards.some((c) => cardEquals(c, card)))) {
      selectedCard = null;
    }
  });

  let activeName = $derived(view.players[view.activePlayerIndex]?.name ?? 'Someone');
  let choosingSuit = $derived(view.phase === 'choosing-suit' && view.isActivePlayer);

  let banner = $derived.by(() => {
    const mine = view.isActivePlayer;
    if (view.phase === 'choosing-suit') {
      return mine
        ? { title: 'Pick a suit', detail: 'Your eight sets the suit the next player must follow.' }
        : { title: `${activeName} is picking a suit`, detail: undefined };
    }
    if (!mine) return { title: `${activeName}'s turn`, detail: undefined };
    if (selectedCard) return { title: 'Your turn', detail: `Tap the ${cardName(selectedCard.rank, selectedCard.suit)} again to play it.` };
    if (view.drewCard) return { title: 'Your turn', detail: 'Play the card you drew, or pass.' };
    if (view.playableCards.length === 0) return { title: 'Your turn', detail: 'Nothing matches. Draw a card.' };
    return { title: 'Your turn', detail: 'Play a card that matches, or draw one.' };
  });

  let opponents = $derived(
    view.players.map((p, seat) => ({ ...p, seat })).filter((p) => p.seat !== view.myIndex),
  );

  let standings = $derived(
    view.players
      .map((p, seat) => ({
        id: p.id,
        name: p.name,
        seat,
        detail: p.cardCount === 0 ? 'Went out' : `${p.cardCount} ${p.cardCount === 1 ? 'card' : 'cards'} left`,
        winner: p.id === view.winner?.id,
        you: p.id === playerId,
        bot: p.isBot,
        cards: p.cardCount,
      }))
      .sort((a, b) => a.cards - b.cards),
  );

  function pick(card: Card) {
    if (selectedCard && cardEquals(selectedCard, card)) {
      socket.emit('game:action', { type: 'play-card', card });
      selectedCard = null;
    } else {
      selectedCard = card;
    }
  }

  const draw = () => socket.emit('game:action', { type: 'draw-card' });
  const pass = () => socket.emit('game:action', { type: 'pass' });
  const chooseSuit = (suit: Suit) => socket.emit('game:action', { type: 'choose-suit', suit });
  const playAgain = () => socket.emit('lobby:restartGame');
  const backToLobby = () => socket.emit('lobby:resetGame');
</script>

<div class="board">
  {#if view.gameOver}
    <GameOver
      headline={view.winner ? (view.winner.id === playerId ? 'You win!' : `${view.winner.name} wins!`) : 'Game over'}
      detail={view.winner ? 'First to play every card.' : undefined}
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

    <Table
      topCard={view.topDiscard}
      declaredSuit={view.declaredSuit}
      drawCount={view.drawPileCount}
      canDraw={view.canDraw}
      {choosingSuit}
      ondraw={draw}
      onchoosesuit={chooseSuit}
    />

    {#if view.canPass}
      <div class="pass">
        <Button variant="secondary" onclick={pass}>Pass</Button>
      </div>
    {/if}

    {#if view.myHand.length > 0}
      <Hand
        cards={view.myHand}
        playable={view.playableCards}
        selected={selectedCard}
        myTurn={view.isActivePlayer && view.phase !== 'choosing-suit'}
        onpick={pick}
      />
    {/if}
  {/if}
</div>

<style>
  /* Crazy Eights prints its card backs in Dice Mustard, its shelf colour. */
  .board {
    --card-w: 64px;
    --card-back: var(--color-mustard);
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
    .board {
      --card-w: 80px;
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

  .pass {
    display: flex;
    justify-content: center;
  }

  .pass :global(.btn) {
    min-width: 160px;
  }
</style>
