<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CharacterCard, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import type { MindAction, MindView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: MindView; socket: GameSocket<'the-mind'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let notice = $state('');
  /** Briefly disabled after the next card changes, so a tap meant for the old card can't play the new one. */
  let cooling = $state(false);
  let name = (id: string | null) => id === playerId ? 'You' : view.players.find((player) => player.id === id)?.name ?? '';
  let me = $derived(view.players.find(({ id }) => id === playerId));
  let event = $derived(view.lastEvent);

  let cardKey = $derived(`${view.nextCard}|${view.phase}`);
  $effect(() => {
    void cardKey;
    cooling = true;
    const timer = setTimeout(() => (cooling = false), 400);
    return () => clearTimeout(timer);
  });

  let title = $derived.by(() => {
    switch (view.phase) {
      case 'focus': return view.canReady && !me?.ready ? 'Hands on the table' : 'Waiting for everyone to focus';
      case 'breath': return 'Lift…';
      case 'playing': return view.canPlay ? 'Play when it feels right' : view.myHand.length || !me ? 'Watch the pile' : 'Your hand is empty';
      case 'star-vote': return `${name(view.starVote?.proposerId ?? null)} ${view.starVote?.proposerId === playerId ? 'want' : 'wants'} to use a throwing star`;
      case 'mistake': return 'One life lost';
      case 'star-reveal': return 'Throwing star!';
      case 'level-complete': return `Level ${view.level} cleared`;
      default: return '';
    }
  });
  let detail = $derived.by(() => {
    if (view.phase === 'focus') {
      const waiting = view.players.filter(({ ready, connected, standIn, bot }) => !ready || (!connected && !standIn && !bot));
      const away = view.players.find(({ connected, standIn, bot }) => !connected && !standIn && !bot);
      if (away) return `Waiting for ${away.name} to come back.`;
      return view.canReady && !me?.ready ? 'Tap Ready when you’re focused.' : waiting.length ? `Waiting for ${waiting.map(({ id }) => name(id)).join(', ')}.` : undefined;
    }
    if (view.phase === 'mistake' && event?.kind === 'mistake') {
      return `${name(event.playerId)} played ${event.card} too soon. ${event.discarded.map(({ playerId: id, cards }) => `${name(id)} discarded ${cards.join(', ')}`).join('. ')}.`;
    }
    if (view.phase === 'star-reveal' && event?.kind === 'star') {
      return event.discarded.filter(({ card }) => card !== null).map(({ playerId: id, card }) => `${name(id)} ${card}`).join(' · ');
    }
    if (view.phase === 'level-complete' && event?.kind === 'level-complete') {
      if (!event.reward) return view.level >= view.totalLevels ? 'That was the last level!' : `Level ${view.level + 1} next.`;
      return event.wasted ? `You would have earned a ${event.reward === 'life' ? 'life' : 'throwing star'}, but you’re at the limit.`
        : `You earned a ${event.reward === 'life' ? 'life' : 'throwing star'}.`;
    }
    if (view.phase === 'star-vote') return 'Everyone has to agree. Each player then throws away their lowest card.';
    return `Level ${view.level} of ${view.totalLevels} · ${view.level} ${view.level === 1 ? 'card' : 'cards'} each`;
  });

  async function send(action: MindAction) {
    if (pending) return;
    pending = true;
    notice = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      // Races with a mistake or a stop are expected in real time, so say so softly.
      if (!reply.ok) notice = reply.message;
    } catch {
      notice = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }

  function play() {
    if (view.nextCard === null || cooling) return;
    void send({ type: 'play', card: view.nextCard });
  }
</script>

{#snippet icons(count: number, max: number, label: string, glyph: 'life' | 'star')}
  <span class="icons" role="img" aria-label={`${count} ${label}`}>
    {#each Array.from({ length: max }) as _, i (i)}
      <svg viewBox="0 0 20 20" class:held={i < count} aria-hidden="true">
        {#if glyph === 'life'}
          <path d="M10 17s-6.5-4-6.5-8.5A3.5 3.5 0 0 1 10 6a3.5 3.5 0 0 1 6.5 2.5C16.5 13 10 17 10 17Z" />
        {:else}
          <path d="M10 2l2.2 5.8L18 10l-5.8 2.2L10 18l-2.2-5.8L2 10l5.8-2.2Z" />
        {/if}
      </svg>
    {/each}
  </span>
{/snippet}

<CardBoard label="The Mind game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.outcome === 'won' ? `You cleared all ${view.totalLevels} levels!` : `Out of lives on level ${view.level}`}
      detail={`${view.levelsCleared} ${view.levelsCleared === 1 ? 'level' : 'levels'} cleared`}
      standings={view.players.map((player, seat) => ({ ...player, seat, you: player.id === playerId, winner: view.outcome === 'won', place: 1,
        detail: view.outcome === 'won' ? 'Cleared together' : 'Played together' }))}
      onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner mine={view.canPlay || (view.canReady && !me?.ready) || view.canVote} {title} {detail} />
    <p class="supply">
      {@render icons(view.lives, view.maxLives, view.lives === 1 ? 'life' : 'lives', 'life')}
      {@render icons(view.stars, view.maxStars, view.stars === 1 ? 'throwing star' : 'throwing stars', 'star')}
    </p>
    <Felt label="Pile" tone="night">
      <div class="felt">
        <div class="pile" aria-label={view.pile.top === null ? 'The pile is empty' : `Top of the pile: ${view.pile.top}`}>
          {#each view.pile.recent as card (card)}<span class="recent"><CharacterCard compact corner={card} /></span>{/each}
          {#if view.pile.top !== null}
            <span class="top"><CharacterCard compact corner={view.pile.top} marked={view.phase === 'mistake'} /></span>
          {:else}
            <span class="slot" aria-hidden="true"></span>
          {/if}
          <small>{view.pile.count} played</small>
        </div>
        <ul class="seats" aria-label="Players">
          {#each view.players as player, seat (player.id)}
            <li><SeatChip name={player.name} {seat} bot={player.bot || player.standIn} connected={player.connected || player.bot || player.standIn}
              you={player.id === playerId}
              stat={`${player.cardCount} ${player.cardCount === 1 ? 'card' : 'cards'}${view.phase === 'focus' ? (player.ready ? ' · ready' : ' · focusing') : ''}${player.vote ? ` · ${player.vote}` : ''}`} /></li>
          {/each}
        </ul>
        {#if view.nextReward}
          <small class="reward">Clear level {view.nextReward.level} for a {view.nextReward.reward === 'life' ? 'life' : 'throwing star'}</small>
        {/if}
      </div>
    </Felt>

    {#if me}
      <section class="hand" aria-label="Your cards">
        <div class="cards">
          {#each view.myHand as card, i (card)}
            <CharacterCard compact corner={card} selected={i === 0 && view.canPlay} />
          {/each}
          {#each view.myInFlight as card (card)}<span class="flight"><CharacterCard compact corner={card} /></span>{/each}
          {#if !view.myHand.length && !view.myInFlight.length}<small>No cards left this level</small>{/if}
        </div>
        {#if view.myReturned.length}<p class="soft">Play stopped before your {view.myReturned.join(', ')} landed.</p>{/if}
        {#if view.canVote}
          <div class="actions">
            <Button shout disabled={pending} onclick={() => send({ type: 'vote-star', agree: true })}>Use it</Button>
            <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'vote-star', agree: false })}>Not now</Button>
          </div>
        {:else if view.canReady}
          <Button shout={!me.ready} pressed={me.ready} disabled={pending} onclick={() => send({ type: 'ready', ready: !me.ready })}>
            Ready
          </Button>
        {:else if view.phase === 'playing' || view.phase === 'breath'}
          <div class="play"><Button shout disabled={!view.canPlay || pending || cooling} onclick={play}>
            {view.nextCard === null ? 'No cards left' : `Play ${view.nextCard}`}
          </Button></div>
        {/if}
        <div class="actions">
          {#if view.canStop}<Button variant="secondary" disabled={pending} onclick={() => send({ type: 'stop' })}>Stop</Button>{/if}
          {#if view.canProposeStar}<Button variant="secondary" disabled={pending} onclick={() => send({ type: 'propose-star' })}>Throwing star</Button>{/if}
        </div>
        {#if notice}<p class="soft" role="status">{notice}</p>{/if}
      </section>
    {/if}
  {/if}
</CardBoard>

<style>
  .supply { display: flex; justify-content: center; gap: 18px; margin: 0; }
  .icons { display: inline-flex; gap: 3px; }
  .icons svg { width: 20px; height: 20px; fill: none; stroke: var(--color-espresso); stroke-width: 1.6; }
  .icons svg.held { fill: var(--color-terracotta); }
  .icons + .icons svg.held { fill: var(--color-mustard); }
  .felt { width: 100%; display: grid; gap: 12px; justify-items: center; --card-back: var(--color-linen); }
  .pile { display: flex; align-items: center; gap: 6px; --card-w: 44px; }
  .pile .top { --card-w: 96px; }
  .pile .recent { opacity: .65; }
  .pile small { margin-left: 6px; }
  .slot { width: 96px; height: calc(96px * 1.42); border: 2px dashed currentColor; border-radius: 13px; opacity: .4; }
  .seats { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  .reward { opacity: .85; }
  .hand { display: grid; justify-items: center; gap: 10px; padding-top: 14px; }
  .cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; --card-w: 52px; min-height: 74px; align-items: end; }
  .flight { opacity: .6; transform: translateY(-10px); }
  .play { width: 100%; max-width: 420px; display: grid; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .soft { margin: 0; color: var(--color-ink-muted); text-align: center; }
</style>
