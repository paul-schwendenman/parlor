<script lang="ts">
  import { cardEquals, type Card } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardHand, Felt, GameOver, PlayingCard, SuitIcon, TurnBanner, cardName } from '@parlor/ui';
  import type { SpadesAction, SpadesView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: SpadesView;
    socket: GameSocket<'spades'>;
    playerId: string;
    isHost: boolean;
  } = $props();

  let pending = $state(false);
  let selected = $state<Card | null>(null);
  let error = $state('');
  let me = $derived(view.players.find((player) => player.id === playerId));
  let active = $derived(view.players.find((player) => player.id === view.activePlayerId));
  let trickWinner = $derived(view.players.find((player) => player.id === view.trickWinnerId));
  let myTurn = $derived(!!me && me.id === active?.id);
  let bidding = $derived(view.phase === 'bidding');
  let playableSelection = $derived(selected && isPlayable(selected) ? selected : null);
  let leadSuit = $derived(view.trick[0]?.card.suit);
  const bids = Array.from({ length: 14 }, (_, i) => i);

  let standings = $derived(view.teams.map((team) => ({
    id: String(team.team),
    name: view.players.filter((player) => player.team === team.team).map((player) => player.name).join(' & '),
    detail: `${team.score} points`,
    seat: team.team,
    winner: view.winningTeam === team.team,
    you: me?.team === team.team,
  })).sort((a, b) => Number(b.winner) - Number(a.winner)));

  function isPlayable(card: Card): boolean {
    return view.playableCards.some((choice) => cardEquals(card, choice));
  }

  async function send(action: SpadesAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const result = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!result.ok) error = result.message;
      else selected = null;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function pick(card: Card) {
    if (playableSelection && cardEquals(card, playableSelection)) {
      void send({ type: 'play-card', card });
    } else {
      selected = card;
    }
  }

  function submitBid(amount: number) {
    void send({ type: 'bid', amount });
  }

  function signed(points: number): string {
    return points >= 0 ? `+${points}` : String(points);
  }
</script>

<section class="board" aria-label="Spades game">
  <header class="heading">
    <h1><SuitIcon suit="spades" size={26} /> Spades</h1>
    <p>Round {view.round} · Play to {view.goal}</p>
  </header>

  {#if view.phase === 'game-over'}
    <GameOver
      headline={view.winningTeam === me?.team ? 'Your team wins!' : `${standings[0].name} win!`}
      standings={standings}
      onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined}
    />
  {:else if view.phase !== 'round-scoring'}
    {#if bidding}
      <TurnBanner mine={myTurn}
        title={myTurn ? 'Bid on your hand' : `${active?.name ?? 'Next player'} is bidding`}
        detail={myTurn ? 'Choose how many tricks you expect to take. Nil means zero.' : undefined} />
    {:else}
      <TurnBanner mine={myTurn}
        title={trickWinner ? `${trickWinner.name} took the trick` : myTurn ? 'Your turn' : `${active?.name ?? 'Next player'} to play`}
        detail={playableSelection
          ? `Tap the ${cardName(playableSelection.rank, playableSelection.suit)} again to play it.`
          : myTurn && leadSuit ? `Follow ${leadSuit} if you can.` : undefined} />
    {/if}
  {/if}

  <div class="scoreboard" aria-label="Team scores">
    {#each view.teams as team (team.team)}
      <section class="score" class:mine={me?.team === team.team} aria-label={`Team ${team.team + 1}`}>
        <header>
          <h2>{me ? me.team === team.team ? 'Your team' : 'Opponents' : `Team ${team.team + 1}`}</h2>
          <strong>{team.score} <small>pts</small></strong>
        </header>
        <p>{team.bags} {team.bags === 1 ? 'bag' : 'bags'}{#if team.bid !== null} · {team.tricks}/{team.bid} tricks{/if}</p>
        <ul class="team-players">
          {#each view.players.filter((player) => player.team === team.team) as player (player.id)}
            <li>
              <span title={player.name}>{player.id === playerId ? 'You' : player.name}{player.id === view.dealerId ? ' · Dealer' : ''}</span>
              {#if player.bid === null}
                <small>Waiting to bid</small>
              {:else if player.bid === 0}
                <small>{player.tricks ? 'Nil failed' : 'Nil'}</small>
              {:else}
                <small>{player.tricks}/{player.bid} tricks</small>
              {/if}
            </li>
          {/each}
        </ul>
        {#if team.roundScore}
          <dl class="round-score" aria-label="Round scoring">
            <div><dt>Contract</dt><dd>{signed(team.roundScore.bidPoints)}</dd></div>
            <div><dt>Overtricks</dt><dd>{signed(team.roundScore.bagPoints)}</dd></div>
            {#if team.roundScore.nilPoints}<div><dt>Nil</dt><dd>{signed(team.roundScore.nilPoints)}</dd></div>{/if}
            {#if team.roundScore.bagPenalty}<div><dt>Bag penalty</dt><dd>{signed(team.roundScore.bagPenalty)}</dd></div>{/if}
            <div class="total"><dt>Round total</dt><dd>{signed(team.roundScore.total)}</dd></div>
          </dl>
        {/if}
      </section>
    {/each}
  </div>

  {#if view.phase === 'round-scoring'}
    <TurnBanner mine={false} title={`Round ${view.round} complete`} detail="The dealer rotates clockwise for the next hand." />
  {:else if view.phase === 'playing' || view.phase === 'trick-won'}
    <Felt label="Spades trick table">
      <div class="trick">
        <header class="trick-heading">
          <span>Trick {view.trickNumber} of 13</span>
          <span>Spades {view.spadesBroken ? 'broken' : 'unbroken'}</span>
        </header>
        <ol aria-label="Trick in play order">
          {#each view.trick as play (play.playerId)}
            {@const player = view.players.find((seat) => seat.id === play.playerId)}
            <li>
              <div class="trick-card" class:winner={play.playerId === view.trickWinnerId}>
                <PlayingCard rank={play.card.rank} suit={play.card.suit} />
              </div>
              <small title={player?.name}>{play.playerId === playerId ? 'You' : player?.name}</small>
            </li>
          {/each}
          {#each Array.from({ length: 4 - view.trick.length }) as _, i (i)}
            <li aria-hidden="true"><div class="empty-card"></div></li>
          {/each}
        </ol>
      </div>
    </Felt>
  {/if}

  {#if view.myHand.length}
    <CardHand cards={view.myHand} active={myTurn && !bidding && !pending}
      {isPlayable} selected={playableSelection} onpick={pick} />
  {/if}

  {#if bidding && myTurn}
    <section class="bidding" aria-label="Choose your bid">
      {#each bids as amount (amount)}
        <Button variant="secondary" disabled={pending} onclick={() => submitBid(amount)}>
          {amount === 0 ? 'Nil' : amount}
        </Button>
      {/each}
    </section>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .board {
    display: grid;
    gap: 0.8rem;
    max-width: 42rem;
    margin: 0 auto;
    padding: 0.5rem 1rem 2rem;
    color: var(--color-espresso);
  }
  .heading, .score header, .trick-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.25rem 1rem;
  }
  .heading h1 {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font: 900 2rem/1.1 var(--font-heading);
  }
  h1, h2, p, ol, ul, dl, dd { margin: 0; }
  .heading p { color: var(--color-ink-muted); }
  .scoreboard { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; }
  .score {
    background: var(--color-paper);
    border: 2px solid var(--color-espresso);
    border-radius: 0.85rem;
    padding: 0.6rem 0.75rem;
  }
  .score.mine { background: var(--color-mustard-tint); }
  .score h2 { font: 900 1rem/1.1 var(--font-heading); }
  .score strong { font: 900 1.35rem/1 var(--font-heading); }
  .score p, .team-players small { font-size: 0.8rem; color: var(--color-ink-muted); }
  .team-players {
    list-style: none;
    padding: 0;
    margin-top: 0.45rem;
  }
  .team-players li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    column-gap: 0.45rem;
    align-items: baseline;
    border-top: 1px solid rgba(59, 47, 47, 0.2);
    padding: 0.15rem 0;
  }
  .team-players span, .trick small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .round-score {
    display: grid;
    gap: 0.15rem;
    margin-top: 0.45rem;
    font-size: 0.8rem;
  }
  .round-score div { display: flex; justify-content: space-between; gap: 0.4rem; }
  .round-score .total { border-top: 1px solid currentColor; padding-top: 0.2rem; font-weight: 700; }
  .trick { width: min(100%, 24rem); --card-w: clamp(2.7rem, 12vw, 3.6rem); }
  .trick-heading { font-size: 0.8rem; }
  .trick ol {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.35rem;
    margin-top: 0.65rem;
    padding: 0;
    list-style: none;
  }
  .trick li { display: grid; justify-items: center; align-content: start; gap: 0.3rem; min-width: 0; }
  .trick-card.winner { border-radius: 0.35rem; outline: 2px solid var(--color-mustard); outline-offset: 2px; }
  .empty-card {
    box-sizing: border-box;
    width: var(--card-w);
    aspect-ratio: 5 / 7;
    border: 1px dashed var(--color-cream);
    border-radius: 0.35rem;
    opacity: 0.45;
  }
  .bidding {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr));
    gap: 0.4rem;
  }
  .error { color: var(--color-danger); }
</style>
