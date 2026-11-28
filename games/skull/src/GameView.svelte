<script lang="ts">
  import { untrack } from 'svelte';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import Disc from './Disc.svelte';
  import type { Disc as DiscFace, SkullAction, SkullView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: SkullView; socket: GameSocket<'skull'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let lifted = $state<string | null>(null);
  let bidding = $state(false);
  let amount = $state<number | null>(null);
  let me = $derived(view.players.find(({ id }) => id === playerId));
  let name = (id: string | null) => view.players.find((player) => player.id === id)?.name ?? '';
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let canBid = $derived(view.legalBids.length > 0);
  let mine = $derived(view.canAnte || view.canPlace || canBid || view.flipTargets.length > 0 || !!view.penalty || view.starterChoices.length > 0);
  let flowersShown = $derived(view.flips.filter(({ disc }) => disc === 'flower').length);
  let standings = $derived(view.players.map((player) => ({
    ...player, you: player.id === playerId, winner: player.id === view.winnerId,
    rank: player.id === view.winnerId ? [0, 0, 0] : player.eliminated ? [2, -(player.outOrder ?? 0), 0] : [1, -player.points, -player.discCount],
    detail: player.id === view.winnerId ? `${player.points} ${player.points === 1 ? 'point' : 'points'}`
      : player.eliminated ? 'Out' : `${player.points} ${player.points === 1 ? 'point' : 'points'} · ${player.discCount} discs left`,
  })).sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2]));

  // A primitive key, so a fresh view object alone does not clear a selection.
  let turnKey = $derived(`${view.phase}|${view.activePlayerId}|${view.bid}`);
  $effect(() => {
    void turnKey;
    lifted = null;
    amount = null;
    if (!untrack(() => view.canOpen)) bidding = false;
  });

  let title = $derived.by(() => {
    const result = view.result;
    if (result?.success) return `${name(result.challengerId)} turned over ${result.bid} ${result.bid === 1 ? 'flower' : 'flowers'}!`;
    if (result && view.phase !== 'penalty') return result.eliminatedId ? `Skull! ${name(result.eliminatedId)} is out.` : `Skull! ${name(result.challengerId)} loses a disc.`;
    if (view.phase === 'ante') return view.canAnte ? 'Place your first disc' : 'Waiting for first discs';
    if (view.phase === 'penalty') return view.penalty ? `Skull! Pick a disc for ${name(result?.challengerId ?? null)} to lose` : `Skull! ${active?.name} is picking a lost disc`;
    if (view.phase === 'choose-starter') return view.starterChoices.length ? 'Choose who starts the next round' : `${active?.name} is choosing who starts`;
    return mine ? 'Your turn' : `${active?.name}’s turn`;
  });
  let detail = $derived.by(() => {
    if (view.result) return view.result.nextStarterId && view.phase === 'round-over' ? `${name(view.result.nextStarterId)} starts the next round.` : undefined;
    if (view.phase === 'ante') return view.canAnte ? 'Everyone places one disc face down at the same time.' : 'Your disc is down.';
    if (view.phase === 'placing') {
      if (!mine) return undefined;
      if (view.mustOpen) return 'Your hand is empty, so you must start a bid.';
      return lifted ? 'Tap the disc again to place it.' : 'Add a disc or start a bid.';
    }
    if (view.phase === 'bidding') return mine ? `Raise above ${view.bid} or pass.` : `${name(view.bidderId)} bid ${view.bid}.`;
    if (view.phase === 'revealing') return `${flowersShown} of ${view.bid} ${view.bid === 1 ? "flower" : "flowers"}${mine ? view.flipTargets.includes(playerId) ? ' · your own discs first' : ' · tap a ringed mat' : ''}`;
    if (view.penalty?.kind === 'blind') return 'The discs are shuffled face down. Tap one, then tap it again.';
    if (view.penalty) return 'You turned over your own skull. Choose which disc to throw away.';
    return undefined;
  });

  async function send(action: SkullAction) {
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

  function tapDisc(disc: DiscFace, key: string) {
    if (lifted !== key) { lifted = key; return; }
    void send(view.canAnte ? { type: 'ante', disc } : { type: 'place', disc });
  }

  function tapPenalty(index: number) {
    const key = `penalty-${index}`;
    if (lifted !== key) { lifted = key; return; }
    void send({ type: 'lose-disc', index });
  }

  function tapSeat(id: string) {
    if (view.flipTargets.includes(id)) void send({ type: 'flip', targetId: id });
    else if (view.starterChoices.includes(id)) void send({ type: 'choose-starter', playerId: id });
  }
</script>

<CardBoard label="Skull game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerId === playerId ? 'You win!' : `${name(view.winnerId)} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine} {title} {detail} />
    <Felt label="Mats">
      <div class="felt">
        <p class="heading">
          {view.bid !== null ? `Bid ${view.bid} by ${name(view.bidderId)} · ` : ''}{view.totalOnMats} on the mats
        </p>
        <ul class="mats">
          {#each view.players as player (player.id)}
            {@const flips = view.flips.filter(({ ownerId }) => ownerId === player.id)}
            {@const target = view.flipTargets.includes(player.id) || view.starterChoices.includes(player.id)}
            <li class="mat" class:scored={player.points > 0} class:out={player.eliminated} aria-label={`${player.name}: ${player.stackCount} discs on the mat, ${player.discCount} discs left, ${player.points} points`}>
              <SeatChip name={player.name} seat={player.seat} bot={player.bot} connected={player.connected}
                you={player.id === playerId} active={player.id === view.activePlayerId} out={player.eliminated}
                targetable={target} onclick={target ? () => tapSeat(player.id) : undefined}
                stat={player.eliminated ? 'out' : `${player.discCount} discs`} />
              <div class="stack">
                {#each Array.from({ length: player.stackCount - player.flippedCount }) as _, i (i)}<Disc face="back" size={26} />{/each}
                {#each flips as flip, i (i)}<Disc face={flip.disc} size={26} />{/each}
                {#if view.phase === 'ante' && !player.eliminated}<small>{player.anted ? 'Ready' : 'Choosing…'}</small>{/if}
                {#if player.points}<small class="tag">Scored {player.points}</small>{/if}
                {#if player.passed}<small>Passed</small>{:else if player.lastBid !== null}<small>Bid {player.lastBid}</small>{/if}
              </div>
            </li>
          {/each}
        </ul>
      </div>
    </Felt>

    {#if me && !me.eliminated}
      <section class="mine" aria-label="Your discs">
        {#if view.penalty}
          <div class="row" role="group" aria-label="Discs to lose">
            {#if view.penalty.kind === 'blind'}
              {#each Array.from({ length: view.penalty.slots }) as _, i (i)}
                <button type="button" class="pick" class:lifted={lifted === `penalty-${i}`} disabled={pending}
                  aria-label={`Face-down disc ${i + 1}`} onclick={() => tapPenalty(i)}><Disc face="back" /></button>
              {/each}
            {:else}
              {#each view.penalty.discs as disc, i (i)}
                <button type="button" class="pick" class:lifted={lifted === `penalty-${i}`} disabled={pending}
                  aria-label={`Lose a ${disc}`} onclick={() => tapPenalty(i)}><Disc face={disc} /></button>
              {/each}
            {/if}
          </div>
        {:else}
          {#if view.myStack.length}
            <p class="label">Your mat (only you see this)</p>
            <div class="row">{#each view.myStack as disc, i (i)}<Disc face={disc} size={34} />{/each}</div>
          {/if}
          <p class="label">Your hand</p>
          <div class="row" role="group" aria-label="Your hand">
            {#each view.myHand as disc, i (i)}
              {@const key = `${disc}-${i}`}
              {#if view.canAnte || view.canPlace}
                <button type="button" class="pick" class:lifted={lifted === key} disabled={pending}
                  aria-label={`${lifted === key ? 'Place' : 'Pick up'} a ${disc}`} onclick={() => tapDisc(disc, key)}><Disc face={disc} /></button>
              {:else}
                <Disc face={disc} />
              {/if}
            {:else}
              <small>No discs in hand</small>
            {/each}
          </div>
          {#if canBid && (bidding || view.phase === 'bidding' || view.mustOpen)}
            <div class="bids" role="group" aria-label="Bids">
              {#each view.legalBids as bid (bid)}
                <Button variant="secondary" pressed={amount === bid} disabled={pending} onclick={() => (amount = bid)}>{bid}</Button>
              {/each}
            </div>
            <div class="actions">
              {#if amount !== null}
                <Button shout disabled={pending} onclick={() => send({ type: view.phase === 'bidding' ? 'raise' : 'open', amount: amount! })}>Bid {amount}</Button>
              {/if}
              {#if view.canPass}<Button variant="secondary" disabled={pending} onclick={() => send({ type: 'pass' })}>Pass</Button>{/if}
              {#if view.canOpen && !view.mustOpen}<Button variant="secondary" onclick={() => (bidding = false)}>Back</Button>{/if}
            </div>
          {:else if view.canOpen}
            <div class="actions"><Button shout disabled={pending} onclick={() => (bidding = true)}>Start a bid</Button></div>
          {/if}
        {/if}
      </section>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .felt { width: 100%; display: grid; gap: 10px; }
  .heading { margin: 0; text-align: center; font-weight: 800; }
  .mats { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .mat { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; padding: 6px 8px; border-radius: 16px; background: var(--color-linen);
    border: 2px solid var(--color-espresso); color: var(--color-espresso); }
  .mat.scored { background: var(--color-mustard-tint); }
  .mat.out { opacity: .55; border-style: dashed; }
  .stack { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 3px; min-height: 28px; }
  .stack small { color: var(--color-ink-muted); font-weight: 700; }
  .stack .tag { color: var(--color-espresso); background: var(--color-mustard); border-radius: 999px; padding: 0 6px; }
  @media (min-width: 700px) { .mats { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); } }
  .mine { display: grid; gap: 8px; justify-items: center; }
  .label { margin: 0; font-weight: 800; font-size: .9rem; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; min-height: 44px; align-items: center; }
  .pick { padding: 0; border: 0; background: none; border-radius: 50%; cursor: pointer; transition: transform .15s ease; }
  .pick:not(:disabled) { box-shadow: 0 0 0 3px var(--color-mustard); }
  .pick.lifted { transform: translateY(-8px); box-shadow: 0 0 0 4px var(--color-mustard-tint), 0 0 0 6px var(--color-espresso); }
  .bids { display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 6px; width: 100%; max-width: 420px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  @media (prefers-reduced-motion: reduce) { .pick { transition: none; } }
</style>
