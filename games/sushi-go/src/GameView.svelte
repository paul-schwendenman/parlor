<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, CharacterCard, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { cardHint, cardName, makiIcons, scorePlate, type PlateCard, type SushiCard } from './rules.js';
  import type { SushiGoAction, SushiGoView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: SushiGoView; socket: GameSocket<'sushi-go'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let selected = $state<number[]>([]);
  let chopsticks = $state(false);
  let showing = $state<string | null>(null);

  let me = $derived(view.players.find(({ id }) => id === playerId));
  let shown = $derived(view.players.find(({ id }) => id === (showing ?? me?.id)) ?? view.players[0]);
  let waitingOn = $derived(view.players.filter(({ locked }) => !locked).map(({ id, name }) => id === playerId ? 'you' : name));
  let passTo = $derived.by(() => {
    const at = view.players.findIndex(({ id }) => id === playerId);
    return at < 0 ? '' : view.players[(at + 1) % view.players.length].name;
  });
  let usedBy = $derived(view.players.filter(({ usedChopsticks }) => usedChopsticks).map(({ name }) => name));
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter(({ total, puddings }) => total > player.total || (total === player.total && puddings > player.puddings)).length,
    detail: `${player.total} points · ${player.puddings} ${player.puddings === 1 ? 'pudding' : 'puddings'}`,
  })).sort((a, b) => a.place - b.place));

  let turnKey = $derived(`${view.round}|${view.pick}|${view.phase}|${view.canPick}`);
  $effect(() => {
    void turnKey;
    selected = [];
    chopsticks = false;
  });

  const kindOrder: SushiCard['kind'][] = ['maki', 'tempura', 'sashimi', 'dumpling', 'nigiri', 'wasabi', 'pudding', 'chopsticks'];
  function groups(plate: PlateCard[]) {
    return kindOrder.map((kind) => ({ kind, items: plate.filter(({ card }) => card.kind === kind) })).filter(({ items }) => items.length);
  }
  function running(plate: PlateCard[]) {
    const score = scorePlate(plate);
    return score.tempura + score.sashimi + score.dumpling + score.nigiri;
  }

  let title = $derived.by(() => {
    if (view.phase === 'reveal') return usedBy.length ? `Sushi go! ${usedBy.join(' and ')} used chopsticks` : 'Cards revealed';
    if (view.phase === 'round-scoring') return `Round ${view.round} scored`;
    if (view.canPick) return chopsticks ? 'Pick two cards' : 'Pick a card';
    if (me) return view.pickedForMe ? 'Picked for you while you were away' : 'Picked';
    return 'Players are picking';
  });
  let detail = $derived.by(() => {
    if (view.phase === 'round-scoring') return 'Puddings stay on your plate for the end of the game.';
    if (view.phase !== 'picking') return `Round ${view.round} of ${view.rounds} · pick ${view.pick}`;
    if (view.canPick && selected.length === 1 && !chopsticks) {
      const card = view.myHand.find(({ id }) => id === selected[0]);
      return card ? `Tap the ${cardName(card)} again to take it.` : undefined;
    }
    if (view.canPick) return `Round ${view.round} of ${view.rounds} · pick ${view.pick} of ${view.handSize} · pass to ${passTo}`;
    return waitingOn.length ? `Waiting for ${waitingOn.join(', ')}.` : undefined;
  });

  async function send(action: SushiGoAction) {
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

  function tap(card: SushiCard) {
    if (chopsticks) {
      selected = selected.includes(card.id) ? selected.filter((id) => id !== card.id) : [...selected, card.id].slice(-2);
      return;
    }
    if (selected[0] === card.id) void send({ type: 'pick', cardIds: [card.id] });
    else selected = [card.id];
  }
</script>

{#snippet plateView(plate: PlateCard[], revealed: number[])}
  <ul class="plate">
    {#each groups(plate) as group (group.kind)}
      <li>
        {#each group.items as item (item.card.id)}
          <CharacterCard corner={item.card.kind === 'nigiri' ? (item.pairedWith !== null ? `${item.card.value}×3` : item.card.value) : item.card.kind === 'maki' ? item.card.count : ''}
            name={cardName(item.card)} marked={revealed.includes(item.card.id)}
            label={`${cardName(item.card)}${item.pairedWith !== null && item.card.kind === 'nigiri' ? ' on Wasabi' : ''}`} />
        {/each}
      </li>
    {:else}
      <li class="empty">Nothing yet</li>
    {/each}
  </ul>
{/snippet}

{#snippet table()}
  <div class="scores">
    <table>
      <thead><tr><th scope="col">Round</th>{#each view.players as player (player.id)}<th scope="col">{player.name}</th>{/each}</tr></thead>
      <tbody>
        {#each Array.from({ length: Math.max(0, ...view.players.map(({ roundScores }) => roundScores.length)) }) as _, round (round)}
          <tr><th scope="row">Round {round + 1}</th>{#each view.players as player (player.id)}<td>{player.roundScores[round]?.total ?? '–'}</td>{/each}</tr>
        {/each}
        {#if view.phase === 'game-over'}
          <tr><th scope="row">Puddings</th>{#each view.players as player (player.id)}<td>{player.puddingScore ?? 0} ({player.puddings})</td>{/each}</tr>
        {/if}
        <tr class="total"><th scope="row">Total</th>{#each view.players as player (player.id)}<td>{player.total}</td>{/each}</tr>
      </tbody>
    </table>
  </div>
{/snippet}

<CardBoard label="Sushi Go game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerIds.length > 1 ? 'Shared win!' : view.winnerIds[0] === playerId ? 'You win!' : `${standings[0].name} wins!`}
      {standings} more={table} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner mine={view.canPick} {title} {detail} />
    <ul class="seats" aria-label="Players">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected && !player.removed}
          you={player.id === playerId}
          stat={`${view.phase === 'picking' ? (player.locked ? 'Picked · ' : 'Choosing · ') : ''}${player.total} pts`}
          onclick={() => (showing = player.id === (me?.id ?? null) ? null : player.id)} /></li>
      {/each}
    </ul>
    <Felt label="Plates">
      <div class="felt">
        {#if view.phase === 'round-scoring'}
          {@render table()}
        {/if}
        <section class="mine" aria-label={shown.id === playerId ? 'Your plate' : `${shown.name}’s plate`}>
          <p class="heading">
            <strong>{shown.id === playerId ? 'Your plate' : `${shown.name}’s plate`}</strong>
            <span>{running(shown.plate)} this round · {makiIcons(shown.plate)} maki · {shown.puddings} {shown.puddings === 1 ? 'pudding' : 'puddings'}</span>
          </p>
          {@render plateView(shown.plate, shown.revealed)}
        </section>
        <ul class="others">
          {#each view.players.filter(({ id }) => id !== shown.id) as player (player.id)}
            <li>
              <button type="button" class="summary" onclick={() => (showing = player.id === me?.id ? null : player.id)}>
                <strong>{player.id === playerId ? 'You' : player.name}</strong>
                <span>{running(player.plate)} pts · maki {makiIcons(player.plate)} · pudding {player.puddings}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    </Felt>

    {#if me}
      <section class="hand" aria-label="Your hand">
        {#if view.canUseChopsticks}
          <Button pressed={chopsticks} disabled={pending} onclick={() => { chopsticks = !chopsticks; selected = []; }}>Use chopsticks</Button>
        {/if}
        <div class="cards">
          {#each view.myHand as card (card.id)}
            {@const picked = view.myPick?.includes(card.id) ?? false}
            <CharacterCard corner={card.kind === 'nigiri' ? card.value : card.kind === 'maki' ? card.count : ''} name={cardName(card)}
              effect={cardHint(card)} selected={selected.includes(card.id) || picked} playable={view.canPick && !pending}
              dimmed={!view.canPick && !picked && view.phase === 'picking'} onclick={view.canPick ? () => tap(card) : undefined} />
          {/each}
        </div>
        {#if chopsticks && selected.length === 2}
          <Button shout disabled={pending} onclick={() => send({ type: 'pick', cardIds: [...selected] })}>Take both</Button>
        {/if}
        {#if view.myPick && view.phase === 'picking'}
          <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'unpick' })}>Change</Button>
        {/if}
      </section>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .felt { width: 100%; display: grid; gap: 10px; --card-w: 56px; }
  .heading { margin: 0 0 6px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 10px; }
  .heading span { font-size: .85rem; opacity: .85; }
  .plate { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .plate li { display: flex; }
  .plate li :global(.card + .card) { margin-left: calc(var(--card-w) * -0.55); }
  .plate .empty { opacity: .7; font-size: .9rem; }
  .others { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .summary { width: 100%; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 10px; padding: 6px 10px;
    border-radius: 10px; border: 1.5px solid var(--color-espresso); background: var(--color-cream); color: var(--color-espresso);
    font: inherit; font-size: .9rem; cursor: pointer; text-align: left; }
  .hand { display: grid; justify-items: center; gap: 10px; padding-top: 14px; }
  .cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; --card-w: clamp(62px, 18vw, 84px); }
  .scores { width: 100%; overflow-x: auto; background: var(--color-paper); color: var(--color-espresso); border-radius: 12px; padding: 6px; box-sizing: border-box; }
  .scores table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  .scores th, .scores td { padding: 3px 6px; text-align: center; border-bottom: 1px solid var(--color-linen); }
  .scores th[scope='row'] { text-align: left; }
  .scores .total { font-weight: 900; }
</style>
