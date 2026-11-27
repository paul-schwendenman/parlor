<script lang="ts">
  import { cardEquals, SUITS, type Card, type Suit } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CardHand, Felt, GameOver, PlayingCard, SeatChip, SuitIcon, TeamScore, TrickTable, TurnBanner, cardName, SUIT_NAMES } from '@parlor/ui';
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

  let seats = $derived(view.players
    .filter((player) => !player.sittingOut)
    .map((player) => ({ id: player.id, label: player.id === playerId ? 'You' : player.name })));

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

<CardBoard label="Euchre game">
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

    <ul class="seats" aria-label="Players">
      {#each view.players as player, seat (player.id)}
        {@const role = [player.id === view.dealerId && 'Dealer', player.id === view.lonerId && 'Alone', player.sittingOut && 'Sitting out'].filter(Boolean).join(' · ')}
        <li><SeatChip name={player.name} {seat} you={player.id === playerId} bot={player.bot} connected={player.connected}
          active={player.id === view.activePlayerId} stat={`Team ${player.team + 1}${role ? ` · ${role}` : ''}`} /></li>
      {/each}
    </ul>

    <section class="scoreboard" aria-label="Team scores">
      {#each view.teams as score, team (team)}
        <TeamScore name={`Team ${team + 1}`} {score} mine={me?.team === team}
          detail={`${view.tricks[team]} ${view.tricks[team] === 1 ? 'trick' : 'tricks'}${maker?.team === team ? ' · Makers' : ''}`} />
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
        <TrickTable {seats} plays={view.trick} winnerId={view.trickWinnerId} title={`Trick ${view.trickNumber} of 5`}>
          {#snippet aside()}
            {#if view.trump}<SuitIcon suit={view.trump} size={15} />{SUIT_NAMES[view.trump]} trump{/if}
          {/snippet}
        </TrickTable>
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
        <Button variant="secondary" pressed={alone} disabled={pending} onclick={() => { alone = !alone; }}>Go alone</Button>
        <div class="bid-actions">
          {#if view.phase === 'order-up'}
            <Button disabled={pending} onclick={() => { void send({ type: 'order-up', alone }); }}>Order it up</Button>
          {:else}
            {#each SUITS.filter((suit) => suit !== view.turnedSuit) as suit (suit)}
              <Button variant="secondary" disabled={pending} onclick={() => callTrump(suit)}><span class="suit"><SuitIcon {suit} size={16} />{SUIT_NAMES[suit]}</span></Button>
            {/each}
          {/if}
          {#if view.canPass}
            <Button variant="secondary" disabled={pending} onclick={() => { void send({ type: 'pass' }); }}>Pass</Button>
          {/if}
        </div>
      </section>
    {/if}
    <p class="game-info">Hand {view.round} · Play to {view.goal}</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; list-style: none; margin: 0; padding: 0; }
  .seats li { max-width: 100%; }
  .game-info { margin: 0; text-align: center; color: var(--color-ink-muted); font-size: .85rem; }
  p { margin: 0; }
  .scoreboard { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .up-card { display: grid; gap: 0.5rem; justify-items: center; }
  .bid { display: grid; justify-items: center; gap: 0.65rem; }
  .bid-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem; }
  .suit { display: inline-flex; align-items: center; gap: 6px; }
  .bower-note { color: var(--color-ink-muted); text-align: center; font-size: 0.875rem; }
  .error { text-align: center; color: var(--color-danger); }
</style>
