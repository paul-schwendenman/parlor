<script lang="ts">
  import { cardEquals, type Card } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CardHand, Felt, GameOver, PlayingCard, SeatChip, TurnBanner } from '@parlor/ui';
  import { pointsFor } from './rules.js';
  import type { PresidentAction, PresidentView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: PresidentView; socket: GameSocket<'president'>; playerId: string; isHost: boolean;
  } = $props();

  let picked = $state<{ hand: number; phase: PresidentView['phase']; trick: PresidentView['trick']; cards: Card[] }>();
  let pending = $state(false);
  let error = $state('');
  let standing = $derived(view.trick.at(-1));
  let mine = $derived(view.activePlayerId === playerId);
  let exchanging = $derived(view.mustReturn > 0);
  let selected = $derived(picked?.hand === view.hand && picked.phase === view.phase &&
    (exchanging || picked.trick.length === view.trick.length && picked.trick.at(-1)?.playerId === standing?.playerId)
    && (mine || exchanging) ? picked.cards : []);
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let lastPlayer = $derived(view.players.find(({ id }) => id === standing?.playerId));
  let returnTo = $derived(view.players.find(({ id }) => id === view.exchanges.find(({ to }) => to === playerId)?.from));
  let title = $derived(view.phase === 'exchange' ? exchanging ? 'Return cards' : 'Exchanging cards'
    : view.phase === 'trick-cleared' ? `${lastPlayer?.name} takes the trick`
    : view.phase === 'hand-scoring' ? `Hand ${view.hand} results`
    : mine ? 'Your turn' : `${active?.name}’s turn`);
  let detail = $derived(exchanging ? `Give ${view.mustReturn} ${view.mustReturn === 1 ? 'card' : 'cards'} to ${returnTo?.name}.`
    : mine ? view.requiredCard ? 'Lead with the 3 of clubs.'
      : standing ? `Beat the ${setLabel(standing.cards)} or pass.` : 'Lead with a single card or a set of one rank.'
    : undefined);
  let canPlay = $derived(view.legalPlays.some(({ rank, counts }) => rank === selected[0]?.rank && counts.includes(selected.length))
    && (!view.requiredCard || selected.some((card) => cardEquals(card, view.requiredCard!))));
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    detail: `${player.score} pts · ${player.title}`,
  })).sort((a, b) => b.score - a.score || (a.finishedAt ?? 0) - (b.finishedAt ?? 0))
    .map((player, index) => ({ ...player, place: index + 1 })));

  function setLabel(cards: readonly Card[]) {
    return cards.length === 1 ? cards[0].rank : `set of ${cards.length} × ${cards[0].rank}`;
  }

  function pick(card: Card) {
    let cards: Card[];
    if (selected.some((choice) => cardEquals(card, choice))) {
      cards = selected.filter((choice) => !cardEquals(card, choice));
    } else if (exchanging) {
      cards = view.mustReturn === 1 ? [card] : selected.length < view.mustReturn ? [...selected, card] : selected;
    } else if (selected[0]?.rank !== card.rank && standing) {
      const sameRank = view.myHand.filter((other) => other.rank === card.rank && !cardEquals(other, card));
      cards = [card, ...sameRank].slice(0, standing.cards.length);
    } else if (selected[0]?.rank === card.rank || !selected.length) {
      cards = standing && selected.length >= standing.cards.length ? [...selected.slice(1), card] : [...selected, card];
    } else {
      cards = [card];
    }
    picked = { hand: view.hand, phase: view.phase, trick: view.trick, cards };
  }

  function playable(card: Card) {
    return exchanging || view.legalPlays.some(({ rank }) => rank === card.rank);
  }

  async function send(action: PresidentAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const result = await socket.timeout(5000).emitWithAck('game:action', action);
      if (result.ok) picked = undefined;
      else error = result.message;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<CardBoard label="President game">
  {#if view.phase === 'game-over'}
    <GameOver headline={standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner mine={mine || exchanging} {title} {detail} />
    <div class="board">
      <ul class="seats" aria-label="Players">
        {#each view.players as player, seat (player.id)}
          <li>
            <SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected}
              you={player.id === playerId} active={player.id === view.activePlayerId}
              out={player.finishedAt !== null} stat={`${player.title ? player.title + ' · ' : ''}${player.finishedAt ? '#' + player.finishedAt : player.passed ? 'Passed' : player.cardCount + ' cards'} · ${player.score} pts`} />
          </li>
        {/each}
      </ul>
      <div class="table">
        {#if view.phase === 'hand-scoring'}
          <ol class="results" aria-label="Finishing order">
            {#each [...view.players].sort((a, b) => a.finishedAt! - b.finishedAt!) as player (player.id)}
              <li><strong>{player.name}</strong><span>{player.title}</span><span>+{pointsFor(player.finishedAt!)} pts</span></li>
            {/each}
          </ol>
        {:else}
          <Felt label="President table">
            <div class="play">
              {#if standing}
                <div class="cards">
                  {#each standing.cards as card (card.rank + card.suit)}
                    <PlayingCard rank={card.rank} suit={card.suit} />
                  {/each}
                </div>
                <p>{lastPlayer?.name} · {setLabel(standing.cards)}{view.reversed ? ' · Ranks reversed' : ''}</p>
              {:else if view.phase === 'exchange'}
                <p>Players are returning cards.</p>
              {:else}
                <p>Open lead{view.reversed ? ' · Ranks reversed' : ''}</p>
              {/if}
            </div>
          </Felt>
          {#if view.myHand.length}
            <CardHand cards={view.myHand} active={(mine || exchanging) && !pending} isPlayable={playable}
              {selected} isMarked={(card) => view.received.some((received) => cardEquals(card, received))} onpick={pick} />
          {/if}
          {#if mine || exchanging}
            <div class="actions">
              {#if exchanging}
                <Button shout disabled={pending || selected.length !== view.mustReturn}
                  onclick={() => send({ type: 'return-cards', cards: [...selected] })}>Give back</Button>
              {:else}
                <Button shout disabled={pending || !canPlay}
                  onclick={() => send({ type: 'play', cards: [...selected] })}>{canPlay ? `Play ${setLabel(selected)}` : 'Play cards'}</Button>
                {#if view.canPass}
                  <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'pass' })}>Pass</Button>
                {/if}
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .board, .table, .play { display: grid; gap: 12px; min-width: 0; }
  .seats, .actions, .cards { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .seats { margin: 0; padding: 0; list-style: none; }
  .play { width: 100%; text-align: center; justify-items: center; --card-w: clamp(38px, 11vw, 64px); }
  .play p { margin: 0; font-weight: 800; }
  .results { margin: 0; padding: 8px 12px 8px 32px; background: var(--color-linen); border-radius: 12px; }
  .results li { padding: 6px 2px; }
  .results span { margin-inline-start: 8px; }
  @media (min-width: 850px) {
    .board { grid-template-columns: max-content minmax(0, 1fr); }
    .seats { flex-direction: column; align-self: start; }
  }
</style>
