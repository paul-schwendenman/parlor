<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CharacterCard, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { CARD_INFO, type CardValue } from './rules.js';
  import type { LoveLetterAction, LoveLetterView, PlayEvent } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: LoveLetterView; socket: GameSocket<'love-letter'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let lifted = $state<number | null>(null);
  let target = $state<string | null>(null);
  let guess = $state<CardValue | null>(null);
  let keep = $state<number | null>(null);
  let bottom = $state<number[]>([]);

  const cardName = (value: CardValue) => CARD_INFO[value].name;
  let name = (id: string | null) => id === playerId ? 'you' : view.players.find((player) => player.id === id)?.name ?? '';
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let mine = $derived(view.moves.length > 0 || view.chancellorReturn > 0);
  let liftedCard = $derived(lifted === null ? null : view.myHand[lifted]);
  let move = $derived(view.moves.find(({ card }) => card === liftedCard));
  let others = $derived(move?.targets.filter((id) => id !== playerId) ?? []);
  let ready = $derived(!!move && (!move.targets.length || (target !== null && (!move.guesses.length || guess !== null))));
  let lastEvent = $derived(view.events.at(-1));
  let privateNote = $derived(lastEvent && (lastEvent.seen !== undefined || lastEvent.compare) ? lastEvent : undefined);
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter(({ tokens }) => tokens > player.tokens).length,
    detail: `${player.tokens} ${player.tokens === 1 ? 'token' : 'tokens'}`,
  })).sort((a, b) => a.place - b.place));

  let turnKey = $derived(`${view.phase}|${view.activePlayerId}|${view.events.length}|${view.round}`);
  $effect(() => {
    void turnKey;
    lifted = null;
    target = null;
    guess = null;
    keep = null;
    bottom = [];
  });

  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  function describe(event: PlayEvent) {
    const by = cap(name(event.byId));
    const card = cardName(event.card);
    const self = event.targetId === event.byId;
    const on = event.targetId ? ` on ${self ? (event.byId === playerId ? 'yourself' : 'themselves') : name(event.targetId)}` : '';
    const losers = [...new Set(event.knockedOut.map(({ id }) => name(id)))];
    const out = losers.length ? ` ${cap(losers.join(' and '))} ${losers.length > 1 || losers[0] === 'you' ? 'are' : 'is'} out.` : '';
    if (event.noEffect) return `${by} played the ${card}. It had no effect.`;
    switch (event.card) {
      case 1: return `${by} played the Guard${on}, naming ${cardName(event.guess!)}: ${event.hit ? 'a hit!' : 'a miss.'}${out}`;
      case 2: return `${by} looked at ${name(event.targetId)}’s card.`;
      case 3: return `${by} compared cards with ${name(event.targetId)}: ${event.baronResult === 'tie' ? 'a tie.' : ''}${out}`;
      case 4: return `${by} played the Handmaid and can’t be picked until their next turn.`;
      case 5: return `${by} played the Prince${on}. ${cap(name(event.targetId))} discarded the ${cardName(event.princeDiscard!)}${event.drewSetAside ? ' and drew the set-aside card' : ''}.${out}`;
      case 6: return `${by} played the Chancellor and put ${event.returned} under the deck.`;
      case 7: return `${by} traded cards with ${name(event.targetId)}.`;
      case 9: return `${by} played the Princess.${out}`;
      default: return `${by} played the ${card}.`;
    }
  }

  let title = $derived.by(() => {
    if (view.phase === 'round-over' && view.lastRound) {
      const winners = view.lastRound.winnerIds.map(name);
      return `${winners.join(' and ')} ${winners.length === 1 && winners[0] !== 'you' ? 'wins' : 'win'} the round`;
    }
    if (view.chancellorReturn) return 'Keep one card';
    return mine ? 'Your turn' : `${active?.name ?? ''}’s turn`;
  });
  let detail = $derived.by(() => {
    if (view.phase === 'round-over') return view.lastRound?.spyId ? `${name(view.lastRound.spyId)} also gets a token for the Spy.` : 'Next round starting…';
    if (view.chancellorReturn) return keep === null ? 'Tap the card to keep.' : `Tap ${view.chancellorReturn === 1 ? 'the other card' : 'the others in order'}: the first goes deepest.`;
    if (!mine) return view.players.find(({ id }) => id === playerId)?.out ? 'You are out until the next round.' : undefined;
    if (view.forcedCountess && lifted === null) return 'You hold the Countess with the King or a Prince, so she must be played.';
    if (!move || liftedCard === null) return 'Tap a card to pick it up.';
    if (liftedCard === 9) return 'Playing the Princess puts you out of the round.';
    if (move.targets.length && target === null) {
      return others.length ? `Pick a player for the ${cardName(liftedCard)}.` : 'Everyone else is protected, so pick yourself.';
    }
    if (liftedCard === 5 && target === playerId && view.myHand.includes(9)) return 'Picking yourself discards the Princess and puts you out.';
    if (move.guesses.length && guess === null) return `Name a card ${name(target)} might hold.`;
    if (!move.targets.length && [1, 2, 3, 7].includes(liftedCard)) return 'Everyone else is protected. This card will have no effect.';
    return `Tap the ${cardName(liftedCard)} again to play it.`;
  });

  async function send(action: LoveLetterAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!reply.ok) error = reply.message;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function play() {
    if (!move || !ready) return;
    void send({ type: 'play', card: move.card, ...(target ? { target } : {}), ...(guess !== null ? { guess } : {}) });
  }

  function tapHand(index: number) {
    if (view.chancellorReturn) {
      if (keep === null) keep = index;
      else if (index === keep) { keep = null; bottom = []; }
      else bottom = bottom.includes(index) ? bottom.filter((i) => i !== index) : [...bottom, index];
      return;
    }
    if (lifted === index && ready && liftedCard !== 9) play();
    else if (lifted !== index) { lifted = index; target = null; guess = null; }
  }

  function tapSeat(id: string) {
    if (move?.targets.includes(id)) { target = id; guess = null; }
  }
</script>

<CardBoard label="Love Letter game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerIds.length > 1 ? 'Shared win!' : view.winnerIds[0] === playerId ? 'You win!' : `${name(view.winnerIds[0])} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine} {title} {detail} />
    <ul class="seats" aria-label={`Players, first to ${view.target} tokens`}>
      {#each view.players as player, seat (player.id)}
        {@const known = view.known.find(({ id }) => id === player.id)}
        {@const pickable = !!move?.targets.includes(player.id)}
        <li>
          <SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected} you={player.id === playerId}
            active={player.id === view.activePlayerId} out={player.out} wide targetable={pickable}
            onclick={pickable ? () => tapSeat(player.id) : undefined}
            stat={`${player.tokens}/${view.target} tokens${player.protected ? ' · protected' : ''}${target === player.id ? ' · picked' : ''}`} />
          <div class="trail" aria-label={`${player.name}’s discards`}>
            {#each player.trail as card, i (i)}
              <CharacterCard compact corner={card.value} name={cardName(card.value)} spent={card.how === 'knocked-out'} />
            {/each}
            {#if known}<small class="hint">You saw: {cardName(known.card)}</small>{/if}
          </div>
        </li>
      {/each}
    </ul>
    <Felt label="Table">
      <div class="felt">
        <p class="deck">Deck: {view.deckCount} {view.deckCount === 1 ? 'card' : 'cards'}{view.faceUp.length ? ' · set aside face up:' : ''}</p>
        {#if view.faceUp.length}
          <div class="row small">{#each view.faceUp as value, i (i)}<CharacterCard corner={value} name={cardName(value)} />{/each}</div>
        {/if}
        {#if view.phase === 'round-over' && view.lastRound}
          <ul class="reveal" aria-label="Cards at the end of the round">
            {#each view.lastRound.hands as hand (hand.id)}
              <li class:won={view.lastRound.winnerIds.includes(hand.id)}>
                <span>{name(hand.id)}</span>
                {#if hand.card !== null}<CharacterCard corner={hand.card} name={cardName(hand.card)} />{:else}<small>out</small>{/if}
              </li>
            {/each}
            {#if view.lastRound.setAside !== null}
              <li><span>Set aside</span><CharacterCard corner={view.lastRound.setAside} name={cardName(view.lastRound.setAside)} /></li>
            {/if}
          </ul>
        {:else if lastEvent}
          <p class="event">{describe(lastEvent)}</p>
        {/if}
        {#if privateNote && view.phase !== 'round-over'}
          <p class="private">
            {#if privateNote.seen !== undefined}Only you saw this: {name(privateNote.targetId)} holds the {cardName(privateNote.seen)}.
            {:else if privateNote.compare}Only you two saw this: your {cardName(privateNote.compare.mine)} against their {cardName(privateNote.compare.theirs)}.{/if}
          </p>
        {/if}
        {#if move?.guesses.length && target}
          <div class="guesses" role="group" aria-label="Name a card">
            {#each move.guesses as value (value)}
              <Button variant="secondary" pressed={guess === value} disabled={pending} onclick={() => (guess = value)}>
                {value} {cardName(value)}{view.unseen[value] !== undefined ? ` ×${view.unseen[value]}` : ''}
              </Button>
            {/each}
          </div>
        {/if}
      </div>
    </Felt>

    {#if view.myHand.length}
      <section class="hand" aria-label="Your hand">
        <div class="row">
          {#each view.myHand as value, i (i)}
            {@const playable = view.chancellorReturn > 0 || view.moves.some(({ card }) => card === value)}
            <CharacterCard corner={value} name={cardName(value)} effect={CARD_INFO[value].effect}
              selected={lifted === i || keep === i} marked={bottom.includes(i)} playable={playable && !pending}
              dimmed={mine && !playable} label={`${value} ${cardName(value)}${bottom.includes(i) ? `, under the deck ${bottom.indexOf(i) + 1}` : ''}`}
              onclick={mine ? () => tapHand(i) : undefined} />
          {/each}
        </div>
        {#if view.chancellorReturn && keep !== null && bottom.length === view.chancellorReturn}
          <Button shout disabled={pending} onclick={() => send({ type: 'chancellor', keep: view.myHand[keep!], bottom: bottom.map((i) => view.myHand[i]) })}>
            Keep the {cardName(view.myHand[keep])}
          </Button>
        {:else if liftedCard === 9 && ready}
          <Button variant="danger" disabled={pending} onclick={play}>Play the Princess and go out</Button>
        {:else if move && ready && move.targets.length}
          <Button shout disabled={pending} onclick={play}>
            {move.guesses.length ? `Guess ${cardName(guess!)}` : `Play the ${cardName(move.card)}`}
          </Button>
        {/if}
      </section>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .seats li { display: grid; gap: 4px; }
  .trail { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; padding-left: 8px; --card-w: 26px; min-height: 0; }
  .trail:empty { display: none; }
  .hint { font-size: .8rem; font-weight: 700; color: var(--color-ink-muted); margin-left: 4px; }
  .felt { width: 100%; display: grid; gap: 10px; justify-items: center; text-align: center; --card-back: var(--color-terracotta-deep); }
  .felt p { margin: 0; }
  .deck { font-weight: 800; }
  .row { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
  .row.small { --card-w: 40px; gap: 4px; }
  .event { max-width: 34rem; }
  .private { background: var(--color-mustard-tint); color: var(--color-espresso); border-radius: 12px; padding: 8px 12px; font-weight: 700; }
  .reveal { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; --card-w: 48px; }
  .reveal li { display: grid; justify-items: center; gap: 4px; padding: 4px; border-radius: 10px; }
  .reveal li.won { background: var(--color-mustard-tint); color: var(--color-espresso); }
  .guesses { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  .hand { display: grid; justify-items: center; gap: 12px; padding-top: 16px; --card-w: clamp(96px, 28vw, 120px); --card-back: var(--color-terracotta-deep); }
</style>
