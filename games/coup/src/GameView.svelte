<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CharacterCard, Countdown, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { ACTION_INFO, CHARACTER_INFO, type Character, type CourtAction } from './rules.js';
  import type { CoupActionMsg, CoupView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: CoupView; socket: GameSocket<'coup'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let chosen = $state<CourtAction | null>(null);
  let target = $state<string | null>(null);
  let lifted = $state<number | null>(null);
  let keep = $state<number[]>([]);

  const charName = (character: Character) => CHARACTER_INFO[character].name;
  let name = (id: string | null) => id === playerId ? 'you' : view.players.find((player) => player.id === id)?.name ?? '';
  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  let me = $derived(view.me);
  let option = $derived(me?.actions.find(({ action }) => action === chosen));
  let deadline = $derived(view.window?.endsInMs == null ? null : Date.now() + view.window.endsInMs);
  let mine = $derived(!!me && ((me.actions.length > 0) || !!me.respond || me.canExpose || !!me.exchangeOptions));
  let standings = $derived(view.players.map((player) => ({
    ...player, you: player.id === playerId, winner: player.id === view.winnerId,
    place: player.id === view.winnerId ? 1 : 1 + view.outOrder.length - view.outOrder.indexOf(player.id),
    detail: player.id === view.winnerId ? `${player.hiddenCount} ${player.hiddenCount === 1 ? 'card' : 'cards'} left` : 'Out',
  })).sort((a, b) => a.place - b.place));

  let turnKey = $derived(`${view.phase}|${view.turnNumber}|${view.window?.id ?? ''}|${view.awaitingId}`);
  $effect(() => {
    void turnKey;
    chosen = null;
    target = null;
    lifted = null;
    keep = [];
  });

  let claimLine = $derived.by(() => {
    const p = view.pending;
    if (!p) return '';
    const who = cap(name(view.actorId));
    const on = p.targetId ? ` on ${name(p.targetId)}` : '';
    return `${who} ${p.claim ? `${view.actorId === playerId ? 'claim' : 'claims'} the ${charName(p.claim)}: ` : view.actorId === playerId ? 'take ' : 'takes '}${ACTION_INFO[p.action].name}${on}`;
  });

  let title = $derived.by(() => {
    const p = view.pending;
    if (view.phase === 'choose-action') return view.actorId === playerId ? 'Your turn' : `${name(view.actorId)}’s turn`;
    if (view.phase === 'reveal' && view.reveal) {
      return view.reveal.proved ? `${cap(name(view.reveal.claimantId))} ${view.reveal.claimantId === playerId ? 'show' : 'shows'} the ${charName(view.reveal.claim)}`
        : `${cap(name(view.reveal.claimantId))} can’t prove the ${charName(view.reveal.claim)}`;
    }
    if (view.phase === 'answer-challenge' && p?.challenge) {
      return view.awaitingId === playerId ? `${cap(name(p.challenge.challengerId))} challenges you` : `${cap(name(p.challenge.challengerId))} challenges ${name(p.challenge.claimantId)}`;
    }
    if (view.phase === 'expose') return view.awaitingId === playerId ? 'Lose a card' : `${cap(name(view.awaitingId))} is losing a card`;
    if (view.phase === 'exchange') return view.awaitingId === playerId ? 'Choose cards to keep' : `${cap(name(view.awaitingId))} is exchanging`;
    if (view.phase === 'block' && p) return me?.respond ? `${claimLine}. Block?` : claimLine;
    if (view.phase === 'challenge-block' && p?.block) return `${cap(name(p.block.blockerId))} ${p.block.blockerId === playerId ? 'block' : 'blocks'} as ${charName(p.block.character)}`;
    return claimLine;
  });

  let detail = $derived.by(() => {
    if (me?.mustCoup) return 'With 10 or more coins you have to Coup.';
    if (view.phase === 'choose-action' && view.actorId === playerId) {
      if (!option) return 'Pick an action.';
      if (option.targets.length && !target) return `Pick who to ${ACTION_INFO[option.action].name.toLowerCase()}.`;
      return `${ACTION_INFO[option.action].effect}.${option.bluff ? ' This is a bluff.' : ''}`;
    }
    if (me?.respond) return me.respond.challenge ? 'Challenge or let it go.' : 'Block or let it go.';
    if (view.window) {
      const waiting = view.window.eligibleIds.filter((id) => !view.window!.passedIds.includes(id));
      return waiting.length ? `Waiting for ${waiting.map(name).join(', ')}.` : undefined;
    }
    if (view.phase === 'answer-challenge' && view.awaitingId === playerId) return me?.canProve ? 'Show the card, or give up a card.' : 'Give up a card.';
    if (view.phase === 'expose' && view.awaitingId === playerId) return 'Tap the card to turn face up.';
    if (view.phase === 'exchange' && me?.exchangeOptions) return `Tap ${me.keepCount} ${me.keepCount === 1 ? 'card' : 'cards'} to keep.`;
    return view.log.at(-1)?.text;
  });

  async function send(action: CoupActionMsg) {
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

  function pickAction(action: CourtAction) {
    chosen = chosen === action ? null : action;
    target = null;
  }

  function declare() {
    if (!option) return;
    void send(option.targets.length ? { type: 'declare', action: option.action, targetId: target! } : { type: 'declare', action: option.action });
  }

  function tapHand(index: number) {
    if (!me?.canExpose || me.hand[index].exposed) return;
    if (lifted === index) void send({ type: 'expose', index });
    else lifted = index;
  }
</script>

<CardBoard label="Coup game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerId === playerId ? 'You win!' : `${name(view.winnerId)} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine} {title} {detail} />
    <Felt label="Stage">
      <div class="stage">
        {#if view.window}
          <p class="claim">{claimLine}{view.pending?.block ? ` · blocked as ${charName(view.pending.block.character)}` : ''}</p>
          <p class="timer">
            {#if deadline !== null}<Countdown {deadline} />{/if}
            {#each view.window.passedIds as id (id)}<span class="tick">{name(id)} let it go</span>{/each}
          </p>
        {/if}
        {#if me?.respond && view.window}
          {@const windowId = view.window.id}
          <div class="actions">
            {#if me.respond.challenge}
              <Button shout disabled={pending} onclick={() => send({ type: 'challenge', windowId })}>Challenge</Button>
            {/if}
            {#each me.respond.blocks as block (block.character)}
              <Button disabled={pending} onclick={() => send({ type: 'block', windowId, character: block.character })}>
                Block as {charName(block.character)}{block.bluff ? ' (bluff)' : ''}
              </Button>
            {/each}
            <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'pass', windowId })}>Let it go</Button>
          </div>
        {:else if me?.actions.length}
          <div class="picker" role="group" aria-label="Actions">
            {#each me.actions as action (action.action)}
              <Button variant="secondary" pressed={chosen === action.action} disabled={pending} onclick={() => pickAction(action.action)}>
                {ACTION_INFO[action.action].name}{action.cost ? ` · ${action.cost}` : ''}{action.bluff ? ' · bluff' : ''}
              </Button>
            {/each}
          </div>
          {#if option && (!option.targets.length || target)}
            <Button shout disabled={pending} onclick={declare}>
              {target ? `${option.action === 'steal' ? 'Steal from' : ACTION_INFO[option.action].name} ${name(target)}` : `${ACTION_INFO[option.action].name}: ${ACTION_INFO[option.action].effect.toLowerCase()}`}
            </Button>
          {/if}
        {:else if view.reveal}
          <div class="reveal">
            {#if view.reveal.shown}<CharacterCard corner={charName(view.reveal.shown)[0]} name={charName(view.reveal.shown)} />{/if}
          </div>
        {:else if me?.exchangeOptions}
          <div class="row" role="group" aria-label="Cards to keep">
            {#each me.exchangeOptions as character, i (i)}
              <CharacterCard corner={charName(character)[0]} name={charName(character)} effect={CHARACTER_INFO[character].ability}
                playable={!pending} selected={keep.includes(i)}
                onclick={() => (keep = keep.includes(i) ? keep.filter((at) => at !== i) : [...keep, i].slice(-me.keepCount))} />
            {/each}
          </div>
          {#if keep.length === me.keepCount}
            <Button shout disabled={pending} onclick={() => send({ type: 'keep', indices: [...keep] })}>Keep these</Button>
          {/if}
        {/if}
        {#if view.phase === 'answer-challenge' && view.awaitingId === playerId && me?.canProve}
          <Button shout disabled={pending} onclick={() => send({ type: 'prove' })}>Show the {view.pending ? charName(view.pending.challenge?.about === 'block' ? view.pending.block!.character : view.pending.claim!) : ''}</Button>
        {/if}
        <ol class="log" aria-label="Recent moves">
          {#each view.log.slice(-3) as entry (entry.id)}<li>{entry.text}</li>{/each}
        </ol>
      </div>
    </Felt>

    <ul class="seats" aria-label="Players">
      {#each view.players as player (player.id)}
        {@const pickable = !!option && option.targets.includes(player.id)}
        <li>
          <SeatChip name={player.name} seat={player.seat} bot={player.bot} connected={player.connected} you={player.id === playerId}
            active={player.id === view.actorId} out={player.out} wide targetable={pickable}
            onclick={pickable ? () => (target = player.id) : undefined}
            stat={`${player.coins} ${player.coins === 1 ? 'coin' : 'coins'}${target === player.id ? ' · target' : ''}`} />
          <span class="cards">
            {#each Array.from({ length: player.hiddenCount }) as _, i (i)}<CharacterCard faceDown />{/each}
            {#each player.exposed as character, i (i)}<CharacterCard compact spent corner={charName(character)[0]} label={`${charName(character)}, lost`} />{/each}
          </span>
        </li>
      {/each}
    </ul>

    {#if me}
      <section class="hand" aria-label="Your cards">
        <div class="row">
          {#each me.hand as card, i (i)}
            <CharacterCard corner={charName(card.character)[0]} name={charName(card.character)} effect={CHARACTER_INFO[card.character].ability}
              spent={card.exposed} selected={lifted === i} playable={me.canExpose && !card.exposed && !pending}
              onclick={me.canExpose && !card.exposed ? () => tapHand(i) : undefined} />
          {/each}
        </div>
        {#if me.canExpose && lifted !== null}
          <Button variant="danger" disabled={pending} onclick={() => send({ type: 'expose', index: lifted! })}>Lose the {charName(me.hand[lifted].character)}</Button>
        {/if}
      </section>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .stage { width: 100%; display: grid; gap: 10px; justify-items: center; text-align: center; --card-back: var(--color-linen); }
  .stage p { margin: 0; }
  .claim { font-weight: 800; }
  .timer { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-items: center; font-size: .9rem; }
  .tick { padding: 1px 8px; border-radius: 999px; background: var(--color-cream); color: var(--color-espresso); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; width: 100%; max-width: 420px; }
  .reveal { --card-w: 80px; }
  .row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; --card-w: clamp(80px, 24vw, 104px); }
  .log { list-style: none; margin: 0; padding: 0; font-size: .85rem; opacity: .85; display: grid; gap: 2px; }
  .seats { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; --card-back: var(--color-linen); }
  .seats li { display: flex; align-items: center; gap: 6px; }
  .seats li > :global(:first-child) { flex: 1; min-width: 0; }
  .cards { display: flex; gap: 3px; --card-w: 26px; }
  .hand { display: grid; justify-items: center; gap: 10px; padding-top: 12px; --card-back: var(--color-linen); }
</style>
