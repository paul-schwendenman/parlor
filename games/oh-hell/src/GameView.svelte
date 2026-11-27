<script lang="ts">
  import { cardEquals, type Card } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardHand, Felt, GameOver, PlayingCard, SuitIcon, TurnBanner, SUIT_NAMES } from '@parlor/ui';
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

<section class="board" aria-label="Oh Hell game">
  <header class="heading">
    <h1>Oh Hell</h1>
    <p>Hand {view.round} of {view.rounds} <span aria-hidden="true">·</span> {view.handSize} {view.handSize === 1 ? 'card' : 'cards'}</p>
  </header>

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

    <table>
      <caption class="sr-only">Scores and bids</caption>
      <thead>
        <tr><th scope="col">Player</th><th scope="col">Bid</th><th scope="col">Taken</th><th scope="col">Score</th>{#if scoring}<th scope="col">Hand</th>{/if}</tr>
      </thead>
      <tbody>
        {#each view.players as player (player.id)}
          <tr class:active={player.id === view.activePlayerId}>
            <th scope="row">{player.id === playerId ? 'You' : player.name}{#if player.id === view.dealerId} <small>Dealer</small>{/if}</th>
            <td>{player.bid ?? '—'}</td>
            <td>{player.tricks}</td>
            <td>{player.score}</td>
            {#if scoring}<td class:made={!!player.roundPoints}>+{player.roundPoints}</td>{/if}
          </tr>
        {/each}
      </tbody>
    </table>

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
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {/if}
</section>

<style>
  .board { max-width: 720px; margin: auto; display: grid; gap: 14px; padding-bottom: 24px; }
  .heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; }
  h1 { margin: 0; font-family: var(--font-heading); font-size: clamp(2rem, 6vw, 3.25rem); line-height: 1; }
  .heading p { margin: 0; font-weight: 700; color: var(--color-ink-muted); }
  table { width: 100%; border-spacing: 0; border: 1px solid var(--color-espresso); border-radius: 12px; overflow: hidden; font-variant-numeric: tabular-nums; }
  th, td { padding: 5px clamp(5px, 1.8vw, 14px); text-align: right; }
  th:first-child { text-align: left; overflow-wrap: anywhere; }
  thead { background: var(--color-espresso); color: var(--color-cream); font-size: .8rem; }
  tbody tr + tr > * { border-top: 1px solid color-mix(in srgb, var(--color-espresso) 16%, transparent); }
  tr.active { background: color-mix(in srgb, var(--color-mustard) 26%, transparent); }
  th small { font-weight: 500; color: var(--color-ink-muted); }
  .made { color: var(--color-forest-deep); font-weight: 800; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .table { min-width: 0; width: 100%; display: grid; justify-items: center; gap: 12px; }
  .trump { display: flex; gap: 6px; align-items: center; font-weight: 800; }
  ol { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  li { display: grid; align-content: start; justify-items: center; gap: 4px; width: var(--card-w, 64px); }
  li small { max-width: 100%; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
  .winner small { color: #ffe2a1; font-weight: 900; }
  .lead { margin: 12px 0; }
  .bids { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; }
  .error { margin: 0; color: var(--color-terracotta-deep); text-align: center; }
</style>
