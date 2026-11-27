<script lang="ts">
  import { cardEquals, isRedSuit, SUIT_SYMBOLS, type Card } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import type { HeartsAction, HeartsView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: HeartsView;
    socket: GameSocket<'hearts'>;
    playerId: string;
    isHost: boolean;
  } = $props();

  const ranks: Partial<Record<Card['rank'], string>> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  let selected = $state<Card[]>([]);
  let pending = $state(false);
  let error = $state('');
  let activeName = $derived(view.players.find((player) => player.id === view.activePlayerId)?.name);
  let trickWinner = $derived(view.players.find((player) => player.id === view.trickWinnerId)?.name);
  let moonShooter = $derived(view.players.find((player) => player.id === view.moonShooterId)?.name);
  let winners = $derived(view.players.filter((player) => view.winnerIds.includes(player.id)));
  let playing = $derived(!!playerId && view.activePlayerId === playerId);

  function label(card: Card): string {
    return `${ranks[card.rank] ?? card.rank} of ${card.suit}`;
  }

  function includes(cards: Card[], card: Card): boolean {
    return cards.some((other) => cardEquals(other, card));
  }

  async function send(action: HeartsAction) {
    pending = true;
    error = '';
    try {
      const result = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!result.ok) error = result.message;
      else if (action.type === 'pass-cards') selected = [];
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function choose(card: Card) {
    if (!view.canPass) {
      void send({ type: 'play-card', card });
      return;
    }
    if (includes(selected, card)) selected = selected.filter((other) => !cardEquals(other, card));
    else if (selected.length < 3) selected = [...selected, card];
  }
</script>

{#snippet face(card: Card)}
  <span aria-hidden="true">{card.rank}</span>
  <span class="suit" aria-hidden="true">{SUIT_SYMBOLS[card.suit]}</span>
{/snippet}

<div class="hearts">
  <header>
    <h1>Hearts</h1>
    <p>Round {view.round} · Low score wins at {view.goal}</p>
  </header>

  <ul class="scores" aria-label="Scores">
    {#each view.players as player (player.id)}
      <li class:active={player.id === view.activePlayerId}>
        <span class="name">{player.id === playerId ? 'You' : player.name}</span>
        <strong>{player.totalScore}<span class="unit"> pts</span></strong>
        {#if view.phase === 'passing'}
          <small>{player.passed ? 'Ready' : 'Choosing'}</small>
        {:else}
          <small>+{player.roundScore} this round</small>
        {/if}
      </li>
    {/each}
  </ul>

  <section class="table" aria-label="Hearts table">
    {#if view.phase === 'passing'}
      <h2>{view.canPass ? `Pass three cards ${view.passDirection}` : 'Passing cards'}</h2>
      <p role="status">
        {view.canPass ? `${selected.length} of 3 selected` : 'Waiting for everyone to finish choosing.'}
      </p>
    {:else if view.phase === 'round-scoring' || view.phase === 'game-over'}
      {#if view.phase === 'game-over'}
        <h2>{winners.map((player) => player.name).join(' & ')} {winners.length === 1 ? 'wins' : 'tie'}</h2>
      {:else}
        <h2>Round {view.round} complete</h2>
      {/if}
      {#if moonShooter}<p>{moonShooter} shot the moon!</p>{/if}
      {#if view.phase === 'game-over' && isHost}
        <div class="actions">
          <button type="button" class="primary" onclick={() => socket.emit('lobby:restartGame')}>Play again</button>
          <button type="button" class="secondary" onclick={() => socket.emit('lobby:resetGame')}>Back to lobby</button>
        </div>
      {/if}
    {:else}
      <div class="trick-heading">
        <span>Trick {view.trickNumber} of 13</span>
        {#if view.trick[0]}<span class="led-suit">{view.trick[0].card.suit} led</span>{/if}
        <span>Hearts {view.heartsBroken ? 'broken' : 'unbroken'}</span>
      </div>
      <h2 aria-live="polite">
        {#if trickWinner}{trickWinner} took the trick
        {:else if playing}Your turn
        {:else}{activeName} to play{/if}
      </h2>
      <ul class="trick" aria-label="Cards played">
        {#each view.players as player (player.id)}
          {@const play = view.trick.find((entry) => entry.playerId === player.id)}
          <li>
            {#if play}
              <span class="card" class:red={isRedSuit(play.card.suit)}
                class:winning={player.id === view.trickWinnerId}>
                <span class="sr-only">{label(play.card)}</span>
                {@render face(play.card)}
              </span>
            {:else}
              <span class="card-slot" aria-hidden="true"></span>
            {/if}
            <small>{player.id === playerId ? 'You' : player.name}</small>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if view.myHand.length}
    <section class="hand-area" aria-label="Your hand">
      <div class="hand-heading">
        <h2>Your hand</h2>
        {#if view.canPass}
          <button class="primary" type="button" disabled={selected.length !== 3 || pending}
            onclick={() => { void send({ type: 'pass-cards', cards: $state.snapshot(selected) }); }}>Confirm pass</button>
        {:else if view.trickNumber === 1 && view.receivedCards.length}
          <small>Outlined cards were passed to you</small>
        {/if}
      </div>
      <div class="hand">
        {#each view.myHand as card (`${card.suit}-${card.rank}`)}
          <button type="button" class="card" class:red={isRedSuit(card.suit)}
            class:received={view.trickNumber === 1 && includes(view.receivedCards, card)}
            aria-label={label(card)} aria-pressed={view.canPass ? includes(selected, card) : undefined}
            disabled={pending || (!view.canPass && !includes(view.playableCards, card))}
            onclick={() => choose(card)}>
            {@render face(card)}
          </button>
        {/each}
      </div>
    </section>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .hearts {
    --card-width: clamp(2.65rem, 8vw, 3.7rem);
    max-width: 48rem;
    margin: 0 auto;
    padding: 0.5rem 1rem 2rem;
    color: var(--color-espresso, #30221c);
  }

  header, .hand-heading, .trick-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.25rem 1rem;
  }

  h1, h2, p { margin: 0; }
  h1, h2 { font-family: var(--font-heading, Georgia), serif; }
  h1 { font-size: 2.1rem; }
  h2 { font-size: 1.35rem; }
  header p, .hand-heading small { font-size: 0.85rem; }

  ul { list-style: none; padding: 0; }
  .scores, .trick {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .scores { margin: 0.65rem 0; }
  .scores li {
    display: grid;
    gap: 0.2rem;
    border: 1px solid #d8c6ad;
    border-bottom-width: 3px;
    border-radius: 0.5rem;
    padding: 0.45rem;
    background: #fff8e9;
  }
  .scores li.active { border-color: #2e6b54; }
  .name, .trick small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .scores strong { font-size: 1.35rem; }
  .unit, small { font-size: 0.75rem; }

  .table {
    min-height: 13rem;
    display: grid;
    align-content: center;
    gap: 0.5rem;
    padding: 1rem;
    border: 3px solid #17392e;
    border-radius: 0.85rem;
    background: radial-gradient(ellipse at top, #2e614f, #214537);
    color: #fff8e9;
    text-align: center;
  }
  .trick-heading { font-size: 0.8rem; color: #e1eee5; }
  .led-suit { text-transform: capitalize; }
  .trick { margin: 0.25rem 0 0; }
  .trick li { display: grid; justify-items: center; gap: 0.35rem; min-width: 0; }
  .trick small { width: 100%; }
  .card-slot, .card { width: var(--card-width); height: 3.85rem; border-radius: 0.35rem; }
  .card-slot { border: 1px dashed #a1bbab; }
  .card {
    display: inline-grid;
    place-content: center;
    justify-items: center;
    box-sizing: border-box;
    flex: 0 0 var(--card-width);
    border: 1px solid #b9a58d;
    border-bottom-width: 3px;
    background: #fffaf0;
    color: #2b2622;
    font-family: Georgia, serif;
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1;
  }
  .card.red { color: #a12633; }
  .card.winning { outline: 2px solid #f4c965; outline-offset: 2px; }
  .suit { font-size: 1.45rem; }

  .hand-area { margin-top: 0.9rem; }
  .hand { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.65rem; }
  button { cursor: pointer; }
  button:disabled { cursor: default; }
  button.card:disabled { opacity: 0.69; }
  button.card.received { border-color: #2e6b54; }
  button.card[aria-pressed='true'] { background: #f4d58c; border-color: #7b5629; }
  button.card:enabled:hover { transform: translateY(-2px); }
  button:focus-visible { outline: 3px solid #c77a37; outline-offset: 2px; }
  .actions { display: flex; justify-content: center; gap: 0.5rem; }
  .primary, .secondary {
    min-height: 2.75rem;
    padding: 0.3rem 0.9rem;
    border: 1px solid #7b5629;
    border-radius: 0.45rem;
    color: #30221c;
    background: #f4d58c;
    font: inherit;
    font-weight: 700;
  }
  .secondary { background: #fff8e9; }
  .primary:disabled { opacity: 0.62; }
  .error { margin-top: 1rem; color: #a12633; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
