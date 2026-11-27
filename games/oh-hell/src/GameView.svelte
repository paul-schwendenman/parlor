<script lang="ts">
  import { cardEquals, type Card } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CardHand, Felt, GameOver, PlayingCard, SeatChip, SuitIcon, TurnBanner, SUIT_NAMES } from '@parlor/ui';
  import type { OhHellAction, OhHellView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: OhHellView;
    socket: GameSocket<'oh-hell'>;
    playerId: string;
    isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let myTurn = $derived(view.activePlayerId === playerId);
  let trump = $derived(view.trumpCard.suit);
  let lead = $derived(view.trick[0]?.card.suit);
  let bidding = $derived(view.phase === 'bidding');
  let scoring = $derived(view.phase === 'round-scoring');
  let active = $derived(view.players.find((player) => player.id === view.activePlayerId));
  let trickWinner = $derived(view.players.find((player) => player.id === view.trickWinnerId));
  let standings = $derived(view.players.map((player, seat) => ({
    id: player.id,
    name: player.name,
    detail: `${player.score} pts`,
    seat,
    place: 1 + view.players.filter((other) => other.score > player.score).length,
    winner: view.winnerIds.includes(player.id),
    you: player.id === playerId,
  })).sort((a, b) => a.place - b.place));

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
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
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
        detail={myTurn && lead ? `Follow ${SUIT_NAMES[lead].toLowerCase()} if you can.` : undefined} />
    {/if}

    <ul class="seats" aria-label="Scores and bids">
      {#each view.players as player, seat (player.id)}
        {@const progress = player.bid === null ? 'Waiting to bid' : `${player.tricks}/${player.bid} tricks`}
        {@const score = scoring ? `${progress} · +${player.roundPoints} · ${player.score} pts` : `${progress} · ${player.score} pts`}
        <li><SeatChip name={player.name} {seat} you={player.id === playerId}
          active={player.id === view.activePlayerId} stat={player.id === view.dealerId ? `Dealer · ${score}` : score} /></li>
      {/each}
    </ul>

    {#if !scoring}
      <Felt label="Oh Hell trick table">
        <div class="table">
          <div class="trump"><SuitIcon suit={trump} size={16} /> {SUIT_NAMES[trump]} trump</div>
          {#if bidding}
            <PlayingCard rank={view.trumpCard.rank} suit={trump} />
          {:else if view.trick.length}
            <ol aria-label="Cards played in this trick">
              {#each view.trick as play (play.playerId)}
                <li class:winner={play.playerId === view.trickWinnerId}>
                  <PlayingCard rank={play.card.rank} suit={play.card.suit} />
                  <small>{play.playerId === playerId ? 'You' : view.players.find((player) => player.id === play.playerId)?.name}</small>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="lead">Waiting for the lead card</p>
          {/if}
        </div>
      </Felt>
    {/if}

    {#if view.myHand.length}
      <CardHand cards={view.myHand} active={myTurn && view.phase === 'playing' && !pending}
        {isPlayable} selected={null} onpick={(card) => { if (isPlayable(card)) void send({ type: 'play-card', card }); }} />
    {/if}

    {#if bidding && myTurn}
      <section class="bids" aria-label="Choose a bid">
        {#each view.legalBids as tricks (tricks)}
          <Button disabled={pending} onclick={() => { void send({ type: 'bid', tricks }); }}>{tricks}</Button>
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
  .table { min-width: 0; width: 100%; display: grid; justify-items: center; gap: 12px; --card-w: clamp(42px, 10vw, 64px); }
  .trump { display: flex; gap: 6px; align-items: center; font-weight: 800; }
  ol { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  ol li { display: grid; align-content: start; justify-items: center; gap: 4px; width: var(--card-w, 64px); }
  ol li small { max-width: 100%; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
  .winner small { color: #ffe2a1; font-weight: 900; }
  .lead { margin: 12px 0; }
  .bids { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; }
  .error { margin: 0; color: var(--color-terracotta-deep); text-align: center; }
</style>
