<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, DiceTray, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { DICE_COUNT, LABELS, LOWER, UPPER, UPPER_TARGET, type Category } from './rules.js';
  import type { YahtzeeAction, YahtzeeView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: YahtzeeView; socket: GameSocket<'yahtzee'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let selected = $state<Category | null>(null);
  let localHeld = $state<boolean[] | null>(null);
  let viewing = $state<string | null>(null);
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let mine = $derived(view.canRoll || view.canScore);
  let held = $derived(localHeld ?? view.held);
  let shown = $derived(view.players.find(({ id }) => id === (viewing ?? view.myId ?? view.activePlayerId)) ?? view.players[0]);
  let ownCard = $derived(shown.id === view.myId);
  let previews = $derived(mine && ownCard ? new Map(view.scoreOptions.map((option) => [option.category, option])) : new Map());
  let choice = $derived(selected ? view.scoreOptions.find(({ category }) => category === selected) : undefined);
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter(({ total }) => total > player.total).length, detail: `${player.total} points`,
  })).sort((a, b) => a.place - b.place));

  // A primitive key, so a fresh view object alone does not clear a selection.
  let turnKey = $derived(`${view.rollId}|${view.phase}|${view.activePlayerId}`);
  $effect(() => {
    void turnKey;
    selected = null;
    localHeld = null;
  });

  let title = $derived.by(() => {
    if (view.lastScore) {
      const who = view.players.find(({ id }) => id === view.lastScore?.playerId)?.name;
      return view.lastScore.bonus ? `Yahtzee bonus for ${who}!` : `${who} scored ${view.lastScore.points}`;
    }
    return mine ? `Your turn · roll ${Math.min(view.rollsUsed + 1, 3)} of 3` : `${active?.name}’s turn`;
  });
  let detail = $derived.by(() => {
    if (view.lastScore) return `${LABELS[view.lastScore.category]}${view.lastScore.upperBonusEarned ? ' · upper bonus +35' : ''}`;
    if (!mine) return view.dice ? `Rolled ${view.dice.join('-')}` : undefined;
    if (!view.dice) return 'Roll five dice.';
    if (view.yahtzeeRoll?.forced) return `Five alike with ${LABELS[view.yahtzeeRoll.forced]} open must go in ${LABELS[view.yahtzeeRoll.forced]}.`;
    if (choice) return `Score ${choice.points} in ${LABELS[choice.category]}?`;
    return view.rollsLeft ? 'Tap dice to hold them, or pick a box.' : 'Pick a box to score.';
  });

  async function send(action: YahtzeeAction) {
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

  function toggle(index: number) {
    const next = held.map((value, i) => i === index ? !value : value);
    localHeld = next;
    // Holds bypass the pending lock: each one sends the whole array, so the last one wins.
    socket.timeout(5000).emitWithAck('game:action', { type: 'hold', held: next }).then((reply) => {
      if (!reply.ok) { error = reply.message; localHeld = null; }
    }, () => { localHeld = null; });
  }

  function pick(category: Category) {
    selected = selected === category ? null : category;
  }
</script>

{#snippet box(category: Category)}
  {@const value = shown.card[category]}
  {@const option = previews.get(category)}
  <li>
    {#if option}
      <button type="button" class="box" class:picked={selected === category} disabled={!option.legal || pending}
        aria-pressed={selected === category} onclick={() => pick(category)}>
        <span>{LABELS[category]}</span><em>{option.points}</em>
      </button>
    {:else}
      <div class="box"><span>{LABELS[category]}</span><strong>{value ?? '–'}</strong></div>
    {/if}
  </li>
{/snippet}

{#snippet table()}
  <div class="compare">
    <table>
      <thead><tr><th scope="col">Box</th>{#each view.players as player (player.id)}<th scope="col">{player.name}</th>{/each}</tr></thead>
      <tbody>
        {#each [...UPPER, ...LOWER] as category (category)}
          <tr><th scope="row">{LABELS[category]}</th>{#each view.players as player (player.id)}<td>{player.card[category] ?? '–'}</td>{/each}</tr>
          {#if category === 'sixes'}
            <tr class="band"><th scope="row">Upper bonus</th>{#each view.players as player (player.id)}<td>{player.upperBonus || '–'}</td>{/each}</tr>
          {/if}
        {/each}
        <tr class="band"><th scope="row">Yahtzee bonus</th>{#each view.players as player (player.id)}<td>{player.yahtzeeBonuses * 100 || '–'}</td>{/each}</tr>
        <tr class="total"><th scope="row">Total</th>{#each view.players as player (player.id)}<td>{player.total}</td>{/each}</tr>
      </tbody>
    </table>
  </div>
{/snippet}

<CardBoard label="Yahtzee game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerIds.length > 1 ? `Tie: ${standings.filter(({ winner }) => winner).map(({ name }) => name).join(' and ')}`
      : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} more={table} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine} {title} {detail} />
    <ul class="seats" aria-label={`Round ${view.round} of ${view.totalRounds}`}>
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected}
          you={player.id === playerId} active={player.id === view.activePlayerId} stat={`${player.total} pts`}
          onclick={() => (viewing = viewing === player.id || player.id === view.myId ? null : player.id)} /></li>
      {/each}
    </ul>
    <div class="board">
      <Felt label="Dice table">
        <div class="dice">
          <p>Round {view.round} of {view.totalRounds} · {view.rollsLeft} {view.rollsLeft === 1 ? 'roll' : 'rolls'} left</p>
          <DiceTray dice={view.dice ?? []} count={DICE_COUNT} rollId={view.rollId}
            selected={held.flatMap((value, i) => value ? [i] : [])}
            onpick={mine && view.dice && view.rollsLeft ? toggle : undefined} disabled={pending} />
        </div>
      </Felt>
      <section class="card" aria-label={ownCard ? 'Your scorecard' : `${shown.name}’s scorecard`}>
        <h3>{ownCard ? 'Your scorecard' : `${shown.name}’s scorecard`}</h3>
        <p class="hint">{ownCard || !view.myId ? 'Tap a player to see their card.' : 'Tap their name again for yours.'}</p>
        <div class="columns">
          <div>
            <p class="band">Upper</p>
            <ul>{#each UPPER as category (category)}{@render box(category)}{/each}</ul>
            <p class="bonus">{shown.upperBonus ? 'Bonus +35' : `Bonus +35 at ${UPPER_TARGET}: ${shown.upperNeeded} to go`}</p>
          </div>
          <div>
            <p class="band">Lower</p>
            <ul>{#each LOWER as category (category)}{@render box(category)}{/each}</ul>
          </div>
        </div>
        <p class="totals">Upper {shown.upper + shown.upperBonus} · Lower {shown.lower}{shown.yahtzeeBonuses ? ` · Yahtzee +${shown.yahtzeeBonuses * 100}` : ''} · <strong>{shown.total}</strong></p>
      </section>
    </div>
    {#if mine}
      <div class="bar">
        {#if choice}
          <Button variant="secondary" disabled={pending || !view.canRoll} onclick={() => send({ type: 'roll' })}>Roll again</Button>
          <Button shout disabled={pending} onclick={() => send({ type: 'score', category: choice.category })}>
            {choice.points ? `Score ${choice.points}` : `Scratch ${LABELS[choice.category]} (0)`}
          </Button>
        {:else}
          <Button shout disabled={pending || !view.canRoll} onclick={() => send({ type: 'roll' })}>
            {view.dice ? `Roll again (${view.rollsLeft} left)` : 'Roll'}
          </Button>
        {/if}
      </div>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .board { display: grid; gap: 12px; align-items: start; min-width: 0; }
  .dice { display: grid; width: 100%; justify-items: center; gap: 12px; --die-size: clamp(40px, 12vw, 56px); }
  .dice p { margin: 0; font-weight: 800; }
  .card { box-sizing: border-box; background: var(--color-paper); border: 2.5px solid var(--color-espresso); border-radius: 18px; padding: 10px; min-width: 0; }
  .hint { margin: 0 0 6px; font-size: .8rem; color: var(--color-ink-muted); }
  .card h3 { margin: 0; font: 900 1.1rem var(--font-heading, Nunito, sans-serif); }
  .columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
  .band { margin: 0 0 4px; padding: 2px 8px; border-radius: 8px; background: var(--color-linen); font-weight: 800; font-size: .85rem; }
  .card ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
  .box { box-sizing: border-box; width: 100%; min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 4px;
    padding: 0 8px; border-radius: 10px; font: inherit; font-size: clamp(.78rem, 3.4vw, .95rem); color: var(--color-espresso); }
  div.box { border: 1px solid var(--color-linen); }
  button.box { cursor: pointer; background: var(--color-cream); border: 1.5px dashed var(--color-ink-muted); }
  button.box:not(:disabled) { box-shadow: 0 0 0 2px var(--color-mustard); border-style: solid; }
  button.box:disabled { opacity: .45; cursor: default; }
  button.box.picked { background: var(--color-mustard-tint); border: 2px solid var(--color-espresso); }
  .box span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .box em { font-style: normal; color: var(--color-ink-muted); font-variant-numeric: tabular-nums; }
  .box strong { font-variant-numeric: tabular-nums; }
  .bonus { margin: 4px 0 0; font-size: .8rem; color: var(--color-ink-muted); }
  .totals { margin: 8px 0 0; padding-top: 6px; border-top: 2px solid var(--color-linen); text-align: center; }
  .totals strong { font: 900 1.2rem var(--font-heading, Nunito, sans-serif); }
  .bar { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; padding: 10px 0;
    background: var(--color-cream); }
  .compare { overflow-x: auto; }
  .compare table { width: 100%; border-collapse: collapse; font-size: .85rem; }
  .compare th, .compare td { padding: 3px 4px; text-align: center; border-bottom: 1px solid var(--color-linen); }
  .compare th[scope='row'] { text-align: left; }
  .compare thead th { max-width: 4.5em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .compare .band th, .compare .band td { background: var(--color-linen); }
  .compare .total { font-weight: 900; }
  @media (min-width: 900px) { .board { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); } }
</style>
