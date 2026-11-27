<script lang="ts">
  import { cardEquals, SUITS, type Card, type Suit } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardHand, Felt, GameOver, PlayingCard, SuitIcon, TurnBanner, cardName, SUIT_NAMES } from '@parlor/ui';
  import { effectiveSuit } from './rules.js';
  import type { EuchreAction, EuchreView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: EuchreView;
    socket: GameSocket<'euchre'>;
    playerId: string;
    isHost: boolean;
  } = $props();

  let pending = $state(false);
  let alone = $state(false);
  let selected = $state<Card | null>(null);
  let error = $state('');
  let me = $derived(view.players.find((player) => player.id === playerId));
  let active = $derived(view.players.find((player) => player.id === view.activePlayerId));
  let maker = $derived(view.players.find((player) => player.id === view.makerId));
  let trickWinner = $derived(view.players.find((player) => player.id === view.trickWinnerId));
  let myTurn = $derived(!!me && me.id === active?.id);
  let bidding = $derived(view.phase === 'order-up' || view.phase === 'name-trump');
  let choosingCard = $derived(myTurn && (view.phase === 'playing' || view.phase === 'discard'));
  let selection = $derived(choosingCard && selected && isPlayable(selected) ? selected : null);
  let leftBower = $derived.by(() => {
    const { trump, myHand } = view;
    if (!trump) return;
    return myHand.find((card) => card.suit !== trump && effectiveSuit(card, trump) === trump);
  });
  let leadSuit = $derived(view.trick[0] && view.trump ? effectiveSuit(view.trick[0].card, view.trump) : null);

  const resultText = {
    made: 'Makers took the hand',
    march: 'Makers swept all five tricks',
    euchred: 'Defenders euchred the makers',
    'lone-march': 'Loner swept all five tricks',
  };

  let standings = $derived(view.teams.map((score, team) => ({
    id: String(team),
    name: view.players.filter((player) => player.team === team).map((player) => player.name).join(' & '),
    detail: `${score} points`,
    seat: team,
    winner: view.winningTeam === team,
    you: me?.team === team,
  })).sort((a, b) => Number(b.winner) - Number(a.winner)));

  function isPlayable(card: Card): boolean {
    return view.phase === 'discard' || view.playableCards.some((choice) => cardEquals(card, choice));
  }

  async function send(action: EuchreAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const result = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!result.ok) {
        error = result.message;
        return;
      }
      selected = null;
      alone = false;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function pick(card: Card) {
    if (selection && cardEquals(card, selection)) {
      void send({ type: view.phase === 'discard' ? 'discard' : 'play-card', card });
    } else {
      selected = card;
    }
  }

  function callTrump(suit: Suit) {
    void send({ type: 'name-trump', suit, alone });
  }
</script>

<section class="board" aria-label="Euchre game">
  <header class="heading">
    <h1>Euchre</h1>
    <p>Hand {view.round} · Play to {view.goal}</p>
  </header>

  {#if view.phase === 'game-over'}
    <GameOver
      headline={view.winningTeam === me?.team ? 'Your team wins!' : `${standings[0].name} win!`}
      detail={view.result ? `${resultText[view.result.outcome]} for ${view.result.points} points.` : undefined}
      standings={standings}
      onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined}
    />
  {:else}
    {#if bidding}
      <TurnBanner mine={myTurn}
        title={myTurn
          ? view.phase === 'order-up' ? 'Order it up or pass' : 'Name trump'
          : `${active?.name} is deciding trump`}
        detail={myTurn && !view.canPass ? 'As dealer, you must call a suit.' : undefined} />
    {:else if view.phase === 'discard'}
      <TurnBanner mine={myTurn} title={myTurn ? 'Discard one card' : `${active?.name} is discarding`}
        detail={selection ? `Tap the ${cardName(selection.rank, selection.suit)} again to discard it.` : undefined} />
    {:else if view.phase === 'round-scoring' && view.result}
      <TurnBanner mine={false} title={resultText[view.result.outcome]}
        detail={`Team ${view.result.team + 1} scores ${view.result.points} ${view.result.points === 1 ? 'point' : 'points'}.`} />
    {:else}
      <TurnBanner mine={myTurn}
        title={trickWinner ? `${trickWinner.name} took the trick` : myTurn ? 'Your turn' : `${active?.name} to play`}
        detail={selection
          ? `Tap the ${cardName(selection.rank, selection.suit)} again to play it.`
          : myTurn && leadSuit ? `Follow ${SUIT_NAMES[leadSuit].toLowerCase()} if you can.` : undefined} />
    {/if}

    <section class="scoreboard" aria-label="Team scores">
      {#each view.teams as score, team (team)}
        <section class="score" class:mine={me?.team === team} aria-label={`Team ${team + 1}`}>
          <header>
            <h2>{me ? me.team === team ? 'Your team' : 'Opponents' : `Team ${team + 1}`}</h2>
            <strong>{score} <small>pts</small></strong>
          </header>
          <p>{view.tricks[team]} {view.tricks[team] === 1 ? 'trick' : 'tricks'}{#if maker?.team === team} · Makers{/if}</p>
          <ul>
            {#each view.players.filter((player) => player.team === team) as player (player.id)}
              <li title={player.name}>
                {player.id === playerId ? 'You' : player.name}
                {#if player.id === view.dealerId} · Dealer{/if}
                {#if player.id === view.lonerId} · Alone{/if}
                {#if player.sittingOut} · Sitting out{/if}
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </section>

    {#if view.upCard || view.phase === 'name-trump'}
      <Felt label="Trump selection">
        <div class="up-card">
          {#if view.upCard}
            <PlayingCard rank={view.upCard.rank} suit={view.upCard.suit} />
            <p>{view.phase === 'discard' ? `${SUIT_NAMES[view.upCard.suit]} are trump` : 'Up card'}</p>
          {:else}
            <p>{SUIT_NAMES[view.turnedSuit]} were turned down.</p>
          {/if}
        </div>
      </Felt>
    {:else if view.phase === 'playing' || view.phase === 'trick-won'}
      <Felt label="Euchre trick table">
        <div class="trick">
          <header class="trick-heading">
            <span>Trick {view.trickNumber} of 5</span>
            {#if view.trump}
              <span class="trump"><SuitIcon suit={view.trump} size={15} />{SUIT_NAMES[view.trump]} trump</span>
            {/if}
          </header>
          <ol aria-label="Trick in play order">
            {#each view.trick as play (play.playerId)}
              {@const player = view.players.find((seat) => seat.id === play.playerId)}
              <li>
                <div class="trick-card" class:winner={play.playerId === view.trickWinnerId}>
                  <PlayingCard rank={play.card.rank} suit={play.card.suit} />
                </div>
                <small>{play.playerId === playerId ? 'You' : player?.name}</small>
              </li>
            {/each}
            {#each Array.from({ length: (view.lonerId ? 3 : 4) - view.trick.length }) as _, i (i)}
              <li aria-hidden="true"><div class="empty-card"></div></li>
            {/each}
          </ol>
        </div>
      </Felt>
    {/if}

    {#if view.myHand.length && (!me?.sittingOut || view.phase === 'discard')}
      <CardHand cards={view.myHand} active={choosingCard && !pending}
        {isPlayable} selected={selection} onpick={pick} />
      {#if leftBower && view.trump}
        <p class="bower-note">{cardName(leftBower.rank, leftBower.suit)} is the left bower and counts as {SUIT_NAMES[view.trump].toLowerCase()}.</p>
      {/if}
    {/if}

    {#if bidding && myTurn}
      <section class="bid" aria-label="Choose trump">
        <label><input type="checkbox" bind:checked={alone} disabled={pending} /> Go alone</label>
        <div class="bid-actions">
          {#if view.phase === 'order-up'}
            <Button disabled={pending} onclick={() => { void send({ type: 'order-up', alone }); }}>Order it up</Button>
          {:else}
            {#each SUITS.filter((suit) => suit !== view.turnedSuit) as suit (suit)}
              <Button disabled={pending} onclick={() => callTrump(suit)}>{SUIT_NAMES[suit]}</Button>
            {/each}
          {/if}
          {#if view.canPass}
            <Button variant="secondary" disabled={pending} onclick={() => { void send({ type: 'pass' }); }}>Pass</Button>
          {/if}
        </div>
      </section>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {/if}
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
  h1, h2, p, ol, ul { margin: 0; }
  .heading h1 { font: 900 2rem/1.1 var(--font-heading); }
  .heading p, .score p { color: var(--color-ink-muted); }
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
  .score ul { list-style: none; padding: 0; margin-top: 0.35rem; }
  .score li, .trick small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .up-card { display: grid; gap: 0.5rem; justify-items: center; }
  .trick { width: min(100%, 24rem); --card-w: clamp(2.7rem, 12vw, 3.6rem); }
  .trick-heading { font-size: 0.85rem; }
  .trump { display: inline-flex; align-items: center; gap: 0.25rem; }
  .trick ol {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
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
  .bid { display: grid; justify-items: center; gap: 0.65rem; }
  .bid label { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 36px; }
  .bid-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem; }
  .bower-note { color: var(--color-ink-muted); text-align: center; font-size: 0.875rem; }
  .error { color: var(--color-danger); }
</style>
