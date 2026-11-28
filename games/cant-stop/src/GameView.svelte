<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, DiceTray, Felt, GameOver, PipDie, SeatChip, TurnBanner, initial, seatTone } from '@parlor/ui';
  import { COLUMNS, HEIGHT, moveKey, tryPlace, type Column, type Move } from './rules.js';
  import type { CantStopAction, CantStopView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: CantStopView; socket: GameSocket<'cant-stop'>; playerId: string; isHost: boolean;
  } = $props();

  let pending = $state(false);
  let error = $state('');
  let lifted = $state<string | null>(null);
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let mine = $derived(view.canAct);
  let liftedMove = $derived(view.pairings?.flatMap(({ moves }) => moves).find((move) => moveKey(move) === lifted) ?? null);
  let preview = $derived(liftedMove && active
    ? tryPlace(liftedMove, { runners: view.runners, markers: active.markers, claimed: view.claimedBy }) : null);
  let progress = (markers: CantStopView['players'][number]['markers']) =>
    COLUMNS.reduce((sum, column) => sum + (markers[column] ?? 0) / HEIGHT[column], 0);
  let standings = $derived(view.players.map((player) => ({
    ...player, you: player.id === playerId, winner: view.winnerId === player.id,
    place: player.id === view.winnerId ? 1 : 1 + view.players.filter((other) => other.id === view.winnerId ||
      other.claimed.length > player.claimed.length ||
      (other.claimed.length === player.claimed.length && progress(other.markers) > progress(player.markers))).length,
    detail: `${player.claimed.length} ${player.claimed.length === 1 ? 'column' : 'columns'}`,
  })).sort((a, b) => a.place - b.place));

  // A primitive key, so a fresh view object alone does not clear a selection.
  let turnKey = $derived(`${view.rollId}|${view.phase}`);
  $effect(() => {
    void turnKey;
    lifted = null;
  });

  const label = (move: Move) => move.length === 2 ? (move[0] === move[1] ? `${move[0]} twice` : `${move[0]} and ${move[1]}`) : `Move ${move[0]}`;

  let title = $derived(view.phase === 'busted' ? `${active?.name} busted!` : mine ? 'Your turn' : `${active?.name}’s turn`);
  let detail = $derived.by(() => {
    if (view.phase === 'busted') return 'No progress this turn.';
    if (!mine) return view.phase === 'choosing' ? 'Choosing a move…' : undefined;
    if (view.phase === 'first-roll') return 'Roll to start your turn.';
    if (view.phase === 'choosing') return liftedMove ? `Tap ${label(liftedMove)} again to move.` : 'Pick a move.';
    if (view.certainBust) return 'Every runner is at the top. Rolling will bust.';
    return view.stopWins ? 'Stop now to win!' : 'Roll again or stop to lock in your progress.';
  });

  async function send(action: CantStopAction) {
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

  function tapMove(move: Move) {
    const key = moveKey(move);
    if (lifted === key) void send({ type: 'place', columns: move });
    else lifted = key;
  }

  function columnLabel(column: Column) {
    const owner = view.players.find(({ id }) => id === view.claimedBy[column]);
    if (owner) return `Column ${column}, claimed by ${owner.name}`;
    const parts = [view.runners[column] ? `runner on ${view.runners[column]}` : '',
      ...view.players.filter(({ markers }) => markers[column]).map(({ name, markers }) => `${name} marker ${markers[column]}`)];
    return `Column ${column}, ${HEIGHT[column]} spaces${parts.filter(Boolean).length ? `: ${parts.filter(Boolean).join('; ')}` : ''}`;
  }
</script>

<CardBoard label="Can't Stop game">
  {#if view.phase === 'game-over'}
    <GameOver headline={standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner {mine} {title} {detail} />
    <ul class="seats" aria-label={`Players, first to ${view.goal} columns`}>
      {#each view.players as player (player.id)}
        <li><SeatChip name={player.name} seat={player.seat} bot={player.bot} you={player.id === playerId}
          connected={player.connected} active={player.id === view.activePlayerId}
          stat={`${player.claimed.length}/${view.goal} columns`}><i class="dot {seatTone(player.seat)}" aria-hidden="true"></i>
          {player.claimed.length}/{view.goal}</SeatChip></li>
      {/each}
    </ul>
    <div class="table">
      <ol class="board" aria-label="Board">
        {#each COLUMNS as column (column)}
          {@const owner = view.players.find(({ id }) => id === view.claimedBy[column])}
          {@const runner = view.runners[column]}
          <li class="column" aria-label={columnLabel(column)}>
            <div class="cells">
              {#each Array.from({ length: HEIGHT[column] }, (_, i) => HEIGHT[column] - i) as space (space)}
                <div class="cell {owner ? seatTone(owner.seat) : ''}" class:filled={!!owner} class:top={space === HEIGHT[column]}
                  class:target={preview?.[column] === space && preview[column] !== runner}>
                  {#if !owner}
                    {#each view.players as player (player.id)}
                      {#if player.markers[column] === space}<i class="marker c{player.seat % 4} {seatTone(player.seat)}"></i>{/if}
                    {/each}
                    {#if runner === space}<i class="runner" class:summit={space === HEIGHT[column]}></i>
                    {:else if preview?.[column] === space}<i class="runner ghost"></i>{/if}
                  {/if}
                </div>
              {/each}
            </div>
            <strong class="pill {owner ? seatTone(owner.seat) : ''}">{owner ? initial(owner.name) : column}</strong>
          </li>
        {/each}
      </ol>
      <Felt label="Dice table">
        <div class="controls">
          <DiceTray dice={view.dice ?? []} count={4} rollId={view.rollId} />
          {#if view.pairings && view.dice}
            <ul class="pairings" aria-label="Pairings">
              {#each view.pairings as option, index (index)}
                <li class:dim={!option.moves.length}>
                  <span class="pair">
                    {#each option.pairs as pair, p (p)}
                      <span class="mini">{#each pair as die (die)}<PipDie value={view.dice[die]} />{/each}</span>
                    {/each}
                  </span>
                  {#if !option.moves.length}
                    <span class="reason">Can't use: {option.reason}</span>
                  {:else if mine && view.phase === 'choosing'}
                    {#each option.moves as move (moveKey(move))}
                      <Button pressed={lifted === moveKey(move)} disabled={pending} onclick={() => tapMove(move)}>{label(move)}</Button>
                    {/each}
                  {:else}
                    <span>{option.moves.map(label).join(' or ')}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
          {#if mine && view.phase === 'first-roll'}
            <Button shout disabled={pending} onclick={() => send({ type: 'roll' })}>Roll</Button>
          {:else if mine && view.phase === 'deciding'}
            <div class="actions">
              {#if view.stopWins}
                <Button shout disabled={pending} onclick={() => send({ type: 'stop' })}>Stop and win</Button>
                <Button variant="secondary" disabled={pending} onclick={() => send({ type: 'roll' })}>Roll</Button>
              {:else}
                <Button shout disabled={pending} onclick={() => send({ type: 'roll' })}>Roll</Button>
                <Button variant="secondary" disabled={pending || !view.canStop} onclick={() => send({ type: 'stop' })}>Stop</Button>
              {/if}
            </div>
          {/if}
        </div>
      </Felt>
    </div>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; list-style: none; padding: 0; margin: 0; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--color-espresso); margin-right: 2px; }
  .table { display: grid; gap: 12px; min-width: 0; }
  .clay { background: var(--color-terracotta-deep, #a9532d); }
  .felt { background: var(--color-forest-deep, #2f5a3e); }
  .mustard { background: var(--color-mustard, #d4a843); }
  .ink { background: var(--color-espresso, #3b2f2f); }
  .board { --cell-w: 28px; --cell-h: 22px; display: grid; grid-template-columns: repeat(11, minmax(0, var(--cell-w)));
    justify-content: center; align-items: end; gap: 3px;
    list-style: none; margin: 0; padding: 12px 4px 8px; background: var(--color-linen); border: 2.5px solid var(--color-espresso);
    border-radius: 18px; }
  .column { display: grid; gap: 4px; justify-items: center; min-width: 0; }
  .cells { display: grid; gap: 2px; width: 100%; }
  .cell { position: relative; box-sizing: border-box; width: 100%; height: var(--cell-h); border-radius: 4px;
    background: var(--color-paper); border: 1.5px solid var(--color-espresso); }
  .cell.top:not(.filled) { border-radius: 4px 12px 4px 4px; }
  .cell.target { box-shadow: 0 0 0 2.5px var(--color-mustard); }
  .marker { position: absolute; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--color-espresso); }
  .c0 { top: 1px; left: 1px; } .c1 { top: 1px; right: 1px; } .c2 { bottom: 1px; left: 1px; } .c3 { bottom: 1px; right: 1px; }
  .runner { position: absolute; inset: 0; margin: auto; width: 14px; height: 14px; border-radius: 50%;
    background: var(--color-paper); border: 2.5px solid var(--color-espresso); transition: transform .18s ease; }
  .runner.summit { box-shadow: 0 0 0 2.5px var(--color-mustard); }
  .runner.ghost { opacity: .45; border-style: dashed; }
  .pill { min-width: 0; max-width: 100%; box-sizing: border-box; padding: 1px 4px; border-radius: 999px; border: 1.5px solid var(--color-espresso);
    background: var(--color-paper); font-family: var(--font-display, Nunito, sans-serif); font-weight: 900; font-size: .8rem; text-align: center; }
  .pill.clay, .pill.felt, .pill.ink { color: var(--color-cream); }
  .controls { width: 100%; display: grid; gap: 12px; justify-items: center; --die-size: 46px; }
  .pairings { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; width: 100%; max-width: 420px; }
  .pairings li { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px;
    padding: 6px 10px; border-radius: 14px; background: var(--color-cream); color: var(--color-espresso); }
  .pairings li.dim { opacity: .55; }
  .pair { display: flex; gap: 8px; --die-size: 22px; }
  .mini { display: flex; gap: 2px; }
  .reason { font-size: .9rem; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  @media (min-width: 520px) { .board { --cell-w: 36px; --cell-h: 26px; } }
  @media (min-width: 900px) {
    .table { grid-template-columns: minmax(0, 1fr) 340px; align-items: start; }
    .board { --cell-w: 44px; --cell-h: 32px; }
  }
  @media (prefers-reduced-motion: reduce) { .runner { transition: none; } }
</style>
