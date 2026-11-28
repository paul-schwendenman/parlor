<script lang="ts">
  import { cardEquals, type Card } from '@parlor/cards';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CardHand, DiscardPile, DrawPile, Felt, GameOver, MeldSpread, SeatChip, TurnBanner } from '@parlor/ui';
  import type { GinAction, GinView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: GinView; socket: GameSocket<'gin-rummy'>; playerId: string; isHost: boolean;
  } = $props();

  let pick = $state<{ hand: number; card: Card }>();
  let pending = $state(false);
  let error = $state('');
  let mine = $derived(view.activePlayerId === playerId);
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let selected = $derived(pick?.hand === view.handNumber && view.discardable.some((card) => cardEquals(card, pick!.card)) ? pick.card : null);
  let result = $derived(view.lastResult);
  let scorer = $derived(view.players.find(({ id }) => id === result?.winnerId));
  let knocker = $derived(view.players.find(({ id }) => id === result?.knockerId));
  let defender = $derived(knocker && view.players.find(({ id }) => id !== knocker?.id));
  let title = $derived(result?.outcome === 'void' ? 'Hand void' : result ? `${scorer?.name} scores ${result.points}`
    : mine ? 'Your turn' : `${active?.name}’s turn`);
  let detail = $derived(result ? result.outcome === 'void' ? 'Two cards remain in the stock. Neither player scores.'
    : result.outcome === 'undercut' ? 'Undercut' : result.outcome === 'big-gin' ? 'Big gin' : result.outcome === 'gin' ? 'Gin' : 'Knock'
    : view.canPassUpcard ? 'Take the upcard or pass.'
    : mine && view.phase === 'draw' ? view.canTakeDiscard ? 'Draw from the stock or take the discard.' : 'Draw from the stock.'
    : mine && view.phase === 'discard' ? selected ? 'Tap again to discard it, or knock if the card qualifies.' : 'Choose a card to discard.'
    : undefined);
  let standings = $derived(view.players.map((player, seat) => {
    const final = view.final?.find(({ id }) => id === player.id);
    const winner = view.winnerIds.includes(player.id);
    return { ...player, seat, you: player.id === playerId, winner, place: winner ? 1 : 2,
      detail: final ? `${final.total} points · ${final.hand} hands + ${final.box} box + ${final.game} game` : `${player.score} points` };
  }).sort((a, b) => a.place - b.place));

  function discardable(card: Card) {
    return view.discardable.some((held) => cardEquals(held, card));
  }

  function choose(card: Card) {
    if (selected && cardEquals(card, selected)) return send({ type: 'discard', card });
    pick = { hand: view.handNumber, card };
  }

  async function send(action: GinAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      if (reply.ok) pick = undefined;
      else error = reply.message;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<CardBoard label="Gin Rummy game">
  {#if view.phase === 'game-over'}
    <GameOver headline={standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner mine={mine} {title} {detail} />
    <div class="board">
      <ul class="seats" aria-label="Players">
        {#each view.players as player, seat (player.id)}
          <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected} you={player.id === playerId}
            active={player.id === view.activePlayerId} stat={`${player.score}/${view.target} pts · ${player.cardCount} cards`} /></li>
        {/each}
      </ul>
      {#if result?.knocker && result.defender}
        <div class="reveal">
          <section>
            <h3>{knocker?.name} · {result.knocker.deadwoodCount} deadwood</h3>
            <MeldSpread melds={result.knocker.melds} deadwood={result.knocker.deadwood} />
          </section>
          <section>
            <h3>{defender?.name} · {result.defender.deadwoodCount} deadwood</h3>
            <MeldSpread melds={result.defender.melds} deadwood={result.defender.deadwood}
              layoffs={result.defender.layoffs.map(({ card }) => card)} />
          </section>
        </div>
      {:else if !result}
        <Felt label="Gin Rummy card piles">
          <div class="piles">
            <div><DrawPile count={view.stockCount} canDraw={view.canDrawStock && !pending} ondraw={() => send({ type: 'draw-stock' })} />Stock</div>
            <div><DiscardPile card={view.discardTop} canTake={view.canTakeDiscard && !pending} onpick={() => send({ type: 'take-discard' })} />Discard</div>
          </div>
        </Felt>
        {#if view.myHand.length}
          <CardHand cards={view.myHand} active={mine && view.phase === 'discard' && !pending}
            isPlayable={discardable} {selected} onpick={choose} />
          <div class="melds">
            <p>{view.myDeadwood} deadwood · Knock at {view.knockLimit} or less{view.doubled ? ' · Double points' : ''}</p>
            {#if view.myMelds.length}<MeldSpread melds={view.myMelds} />{/if}
          </div>
        {/if}
        {#if view.canPassUpcard || view.canBigGin || view.knockable.length}
          <div class="actions">
            {#if view.canPassUpcard}<Button variant="secondary" disabled={pending} onclick={() => send({ type: 'pass-upcard' })}>Pass upcard</Button>{/if}
            {#if view.canBigGin}<Button shout disabled={pending} onclick={() => send({ type: 'big-gin' })}>Big gin</Button>{/if}
            {#if view.knockable.length}
              <Button shout disabled={pending || !selected || !view.knockable.some((card) => cardEquals(card, selected))}
                onclick={() => selected && send({ type: 'knock', card: selected })}>Knock</Button>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .board { display: grid; gap: 12px; min-width: 0; --card-back: var(--color-clay); }
  .seats, .piles, .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
  .seats { list-style: none; padding: 0; margin: 0; }
  .piles { width: 100%; gap: 22px; --card-w: 58px; }
  .piles > div { display: grid; justify-items: center; gap: 8px; font-weight: 800; }
  .melds, .reveal section { padding: 10px 12px; background: var(--color-linen); border-radius: 10px; --card-w: 36px; }
  .melds p, h3 { margin: 0 0 7px; font-weight: 850; }
  .reveal { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 10px; }
</style>
