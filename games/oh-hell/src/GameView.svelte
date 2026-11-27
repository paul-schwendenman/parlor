<script lang="ts">
  import { cardEquals, type Card } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CardHand, Felt, GameOver, PlayingCard, SeatChip, SuitIcon, TrickTable, TurnBanner, cardName, SUIT_NAMES } from '@parlor/ui';
  import type { OhHellAction, OhHellView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: OhHellView;
    socket: GameSocket<'oh-hell'>;
    playerId: string;
    isHost: boolean;
  } = $props();

  let pending = $state(false);
  let picked = $state<Card | null>(null);
  let error = $state('');
  let myTurn = $derived(view.activePlayerId === playerId);
  let trump = $derived(view.trumpCard.suit);
  let lead = $derived(view.trick[0]?.card.suit);
  let bidding = $derived(view.phase === 'bidding');
  let scoring = $derived(view.phase === 'round-scoring');
  let active = $derived(view.players.find((player) => player.id === view.activePlayerId));
  let trickWinner = $derived(view.players.find((player) => player.id === view.trickWinnerId));
  let playing = $derived(myTurn && view.phase === 'playing');
  let playableSelection = $derived(playing && picked && isPlayable(picked) ? picked : null);
  // A won trick is already counted while it's shown, so only add one mid-trick.
  let trickNumber = $derived(view.players.reduce((sum, player) => sum + player.tricks, 0) + (view.trickWinnerId ? 0 : 1));
  let seats = $derived(view.players.map((player) => ({ id: player.id, label: player.id === playerId ? 'You' : player.name })));
  let standings = $derived(view.players.map((player, seat) => ({
    id: player.id,
    name: player.name,
    detail: `${player.score} pts`,
    seat,
    bot: player.bot,
    place: 1 + view.players.filter((other) => other.score > player.score).length,
    winner: view.winnerIds.includes(player.id),
    you: player.id === playerId,
  })).sort((a, b) => a.place - b.place));

  // A card lifted on a previous turn doesn't stay lifted into the next one.
  $effect(() => { if (!playing) picked = null; });

  function isPlayable(card: Card): boolean {
    return view.playableCards.some((choice) => cardEquals(card, choice));
  }

  async function send(action: OhHellAction): Promise<void> {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const result = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!result.ok) error = result.message;
      else picked = null;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function pick(card: Card) {
    if (playableSelection && cardEquals(card, playableSelection)) void send({ type: 'play-card', card });
    else picked = card;
  }
</script>

<CardBoard label="Oh Hell game">
  {#if view.phase === 'game-over'}
    <GameOver
      headline={view.winnerIds.length > 1 ? 'Shared win!' : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      standings={standings}
      onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined}
    />
  {:else}
    {#if bidding}
      <TurnBanner mine={myTurn}
        title={myTurn ? 'How many tricks will you take?' : `${active?.name} is bidding`}
        detail={myTurn && view.dealerId === playerId ? 'Your bid must leave the total different from the hand size.' : undefined} />
    {:else if scoring}
      <TurnBanner mine={false} title="Hand scores" detail="An exact bid earns 10 points plus tricks taken." />
    {:else}
      <TurnBanner mine={myTurn}
        title={trickWinner ? `${trickWinner.name} took the trick` : myTurn ? 'Your turn' : `${active?.name} to play`}
        detail={playableSelection
          ? `Tap the ${cardName(playableSelection.rank, playableSelection.suit)} again to play it.`
          : myTurn && lead ? `Follow ${SUIT_NAMES[lead].toLowerCase()} if you can.` : undefined} />
    {/if}

    <ul class="seats" aria-label="Scores and bids">
      {#each view.players as player, seat (player.id)}
        {@const progress = player.bid === null ? 'Waiting to bid' : `${player.tricks}/${player.bid} tricks`}
        {@const score = scoring ? `${progress} · +${player.roundPoints} · ${player.score} pts` : `${progress} · ${player.score} pts`}
        <li><SeatChip name={player.name} {seat} you={player.id === playerId} bot={player.bot} connected={player.connected}
          active={player.id === view.activePlayerId} stat={player.id === view.dealerId ? `Dealer · ${score}` : score} /></li>
      {/each}
    </ul>

    {#if !scoring}
      <Felt label="Oh Hell trick table">
        {#if bidding}
          <div class="trump-card">
            <PlayingCard rank={view.trumpCard.rank} suit={trump} />
            <p><SuitIcon suit={trump} size={16} /> {SUIT_NAMES[trump]} trump</p>
          </div>
        {:else}
          <TrickTable {seats} plays={view.trick} winnerId={view.trickWinnerId}
            title={`Trick ${trickNumber} of ${view.handSize}`}>
            {#snippet aside()}<SuitIcon suit={trump} size={15} /> {SUIT_NAMES[trump]} trump{/snippet}
          </TrickTable>
        {/if}
      </Felt>
    {/if}

    {#if view.myHand.length}
      <CardHand cards={view.myHand} active={playing && !pending}
        {isPlayable} selected={playableSelection} onpick={pick} />
    {/if}

    {#if bidding && myTurn}
      <section class="bids" aria-label="Choose a bid">
        {#each view.legalBids as tricks (tricks)}
          <Button variant="secondary" disabled={pending} onclick={() => { void send({ type: 'bid', tricks }); }}>{tricks}</Button>
        {/each}
      </section>
    {/if}
    <p class="game-info">Hand {view.round} of {view.rounds} · {view.handSize} {view.handSize === 1 ? 'card' : 'cards'}</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; list-style: none; margin: 0; padding: 0; }
  .seats li { max-width: 100%; }
  .game-info { margin: 0; text-align: center; color: var(--color-ink-muted); font-size: .85rem; }
  .trump-card { display: grid; justify-items: center; gap: 10px; }
  .trump-card p { display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 800; }
  .bids { display: grid; grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr)); gap: 0.4rem; }
  .error { margin: 0; color: var(--color-danger); text-align: center; }
</style>
