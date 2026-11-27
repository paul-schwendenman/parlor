<script lang="ts">
  import { cardEquals, type Card } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CardHand, Felt, GameOver, SeatChip, TeamScore, TrickTable, TurnBanner, cardName, SUIT_NAMES } from '@parlor/ui';
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
  let seats = $derived(view.players.map((player) => ({ id: player.id, label: player.id === playerId ? 'You' : player.name })));

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

<CardBoard label="Spades game">
  {#if view.phase === 'game-over'}
    <GameOver
      headline={view.winningTeam === me?.team ? 'Your team wins!' : `${standings[0].name} win!`}
      standings={standings}
      onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined}
    />
  {:else if view.phase === 'round-scoring'}
    <TurnBanner mine={false} title={`Round ${view.round} complete`} detail="The dealer rotates clockwise for the next hand." />
  {:else}
    {#if bidding}
      <TurnBanner mine={myTurn}
        title={myTurn ? 'Bid on your hand' : `${active?.name ?? 'Next player'} is bidding`}
        detail={myTurn ? 'Choose how many tricks you expect to take. Nil means zero.' : undefined} />
    {:else}
      <TurnBanner mine={myTurn}
        title={trickWinner ? `${trickWinner.name} took the trick` : myTurn ? 'Your turn' : `${active?.name ?? 'Next player'} to play`}
        detail={playableSelection
          ? `Tap the ${cardName(playableSelection.rank, playableSelection.suit)} again to play it.`
          : myTurn && leadSuit ? `Follow ${SUIT_NAMES[leadSuit].toLowerCase()} if you can.` : undefined} />
    {/if}
  {/if}

  {#if view.phase !== 'game-over'}
    <ul class="seats" aria-label="Players">
      {#each view.players as player, seat (player.id)}
        {@const bid = player.bid === null ? 'Waiting to bid' : player.bid === 0 ? player.tricks ? 'Nil failed' : 'Nil' : `${player.tricks}/${player.bid} tricks`}
        {@const team = `Team ${player.team + 1}`}
        <li><SeatChip name={player.name} {seat} you={player.id === playerId} bot={player.bot} connected={player.connected}
          active={player.id === view.activePlayerId} stat={`${team} · ${player.id === view.dealerId ? 'Dealer · ' : ''}${bid}`} /></li>
      {/each}
    </ul>
  {/if}

  <div class="scoreboard" aria-label="Team scores">
    {#each view.teams as team (team.team)}
      <TeamScore name={`Team ${team.team + 1}`} score={team.score} mine={me?.team === team.team}
        detail={[`${team.bags} ${team.bags === 1 ? 'bag' : 'bags'}`, team.bid !== null && `${team.tricks}/${team.bid} tricks`].filter(Boolean).join(' · ')}>
        {#if team.roundScore}
          <dl class="round-score" aria-label="Round scoring">
            <div><dt>Contract</dt><dd>{signed(team.roundScore.bidPoints)}</dd></div>
            <div><dt>Overtricks</dt><dd>{signed(team.roundScore.bagPoints)}</dd></div>
            {#if team.roundScore.nilPoints}<div><dt>Nil</dt><dd>{signed(team.roundScore.nilPoints)}</dd></div>{/if}
            {#if team.roundScore.bagPenalty}<div><dt>Bag penalty</dt><dd>{signed(team.roundScore.bagPenalty)}</dd></div>{/if}
            <div class="total"><dt>Round total</dt><dd>{signed(team.roundScore.total)}</dd></div>
          </dl>
        {/if}
      </TeamScore>
    {/each}
  </div>

  {#if view.phase === 'playing' || view.phase === 'trick-won'}
    <Felt label="Spades trick table">
      <TrickTable {seats} plays={view.trick} winnerId={view.trickWinnerId} title={`Trick ${view.trickNumber} of 13`}>
        {#snippet aside()}Spades {view.spadesBroken ? 'broken' : 'unbroken'}{/snippet}
      </TrickTable>
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
  <p class="game-info">Round {view.round} · Play to {view.goal}</p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</CardBoard>

<style>
  .seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; list-style: none; margin: 0; padding: 0; }
  .seats li { max-width: 100%; }
  .game-info { margin: 0; text-align: center; color: var(--color-ink-muted); font-size: .85rem; }
  .scoreboard { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .round-score { display: grid; gap: 2px; margin: 8px 0 0; font-size: 0.8125rem; }
  .round-score div { display: flex; justify-content: space-between; gap: 6px; }
  .round-score dd { margin: 0; }
  .round-score .total { border-top: 1px solid currentColor; padding-top: 3px; font-weight: 700; }
  .bidding { display: grid; grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr)); gap: 0.4rem; }
  .error { margin: 0; text-align: center; color: var(--color-danger); }
</style>
