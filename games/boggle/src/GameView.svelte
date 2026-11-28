<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, Countdown, Felt, GameOver, SeatChip, TurnBanner } from '@parlor/ui';
  import { faceText, findPath, MIN_LENGTH, neighbours, points } from './rules.js';
  import type { BoggleAction, BoggleView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: BoggleView; socket: GameSocket<'boggle'>; playerId: string; isHost: boolean;
  } = $props();

  let typed = $state('');
  let trace = $state<number[]>([]);
  let pending = $state(false);
  let error = $state('');
  let deadline = $derived(Date.now() + view.endsInMs);
  let me = $derived(view.players.find(({ id }) => id === playerId));
  let highlight = $derived(trace.length ? trace : typed.length >= 2 ? findPath(view.grid, typed) ?? [] : []);
  let name = (id: string) => id === playerId ? 'You' : view.players.find((player) => player.id === id)?.name ?? '';
  let standings = $derived(view.players.map((player, seat) => ({
    ...player, seat, you: player.id === playerId, winner: view.winnerIds.includes(player.id),
    place: 1 + view.players.filter(({ score }) => score > player.score).length, detail: `${player.score} points`,
  })).sort((a, b) => a.place - b.place));

  let roundKey = $derived(`${view.round}|${view.phase}`);
  $effect(() => {
    void roundKey;
    typed = '';
    trace = [];
  });

  async function send(action: BoggleAction) {
    if (pending) return false;
    pending = true;
    error = '';
    try {
      const reply = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!reply.ok) error = reply.message;
      return reply.ok;
    } catch {
      error = 'The table did not respond. Try again.';
      return false;
    } finally {
      pending = false;
    }
  }

  async function submit(event?: SubmitEvent) {
    event?.preventDefault();
    const word = typed.trim();
    if (word.length < MIN_LENGTH) return;
    if (await send({ type: 'submit', round: view.round, word })) {
      typed = '';
      trace = [];
    }
  }

  function tapTile(cell: number) {
    if (!view.canSubmit) return;
    if (trace.at(-1) === cell) { trace = trace.slice(0, -1); }
    else if (trace.includes(cell) || (trace.length && !neighbours(trace.at(-1)!).includes(cell))) trace = [cell];
    else trace = [...trace, cell];
    typed = trace.map((at) => faceText(view.grid[at]).toLowerCase()).join('');
  }
</script>

<CardBoard label="Boggle game">
  {#if view.phase === 'game-over'}
    <GameOver headline={view.winnerIds.length > 1 ? 'Shared win!' : view.winnerIds[0] === playerId ? 'You win!' : `${name(view.winnerIds[0])} wins!`}
      {standings} onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined} />
  {:else}
    <TurnBanner mine={view.canSubmit && !me?.done}
      title={view.phase === 'reveal' ? `Round ${view.round} results` : me?.done ? 'Waiting for the others' : 'Find words'}
      detail={view.phase === 'reveal' ? 'Words someone else also found score nothing.' : `Round ${view.round} of ${view.rounds} · trace adjacent letters, 3 or more`} />
    <ul class="seats" aria-label="Players">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} bot={player.bot} connected={player.connected} you={player.id === playerId}
          stat={view.phase === 'reveal' ? `+${player.roundScore} · ${player.score} pts` : `${player.wordCount} words${player.done ? ' · done' : ''} · ${player.score} pts`} /></li>
      {/each}
    </ul>
    <Felt label="Letter grid">
      <div class="felt">
        <p class="timer"><Countdown {deadline} /></p>
        <div class="grid" role="group" aria-label="Letters">
          {#each view.grid as face, cell (cell)}
            <button type="button" class="tile" class:lit={highlight.includes(cell)} disabled={!view.canSubmit}
              aria-label={faceText(face)} onclick={() => tapTile(cell)}>{faceText(face)}</button>
          {/each}
        </div>
      </div>
    </Felt>
    {#if view.phase === 'playing' && view.canSubmit}
      <form class="entry" onsubmit={submit}>
        <label class="sr" for="boggle-word">Word</label>
        <input id="boggle-word" bind:value={typed} autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="16"
          placeholder="Type or tap letters" oninput={() => (trace = [])} />
        <Button shout disabled={pending || typed.trim().length < MIN_LENGTH} onclick={() => void submit()}>Add</Button>
      </form>
      {#if error}<p role="alert">{error}</p>{/if}
      <section class="words" aria-label="Your words">
        <p class="heading"><strong>Your words</strong> <span>{view.myWords.length}</span></p>
        <ul>
          {#each view.myWords as word (word)}
            <li><button type="button" class="chip" aria-label={`Remove ${word}`} onclick={() => send({ type: 'remove', round: view.round, word })}>
              {word.toUpperCase()} <span aria-hidden="true">×</span></button></li>
          {/each}
        </ul>
        <Button variant="secondary" pressed={me?.done} onclick={() => send({ type: 'done', round: view.round, done: !me?.done })}>
          {me?.done ? 'Keep looking' : 'I’m done'}
        </Button>
      </section>
    {:else if view.phase === 'reveal'}
      <section class="results" aria-label="Round results">
        {#each view.players as player (player.id)}
          {@const mine = view.results.filter(({ playerIds }) => playerIds.includes(player.id))}
          <div class="found">
            <p class="heading"><strong>{name(player.id)}</strong> <span>+{player.roundScore}</span></p>
            <ul>
              {#each mine as result (result.word)}
                <li class:shared={!result.points}>{result.word.toUpperCase()}{result.points ? ` ${result.points}` : ''}</li>
              {:else}
                <li class="none">No words</li>
              {/each}
            </ul>
          </div>
        {/each}
        {#if view.missed.length}
          <p class="missed">Nobody found: {view.missed.map((word) => `${word.toUpperCase()} (${points(word)})`).join(', ')}</p>
        {/if}
      </section>
    {/if}
  {/if}
</CardBoard>

<style>
  .seats { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .felt { width: 100%; display: grid; justify-items: center; gap: 10px; }
  .timer { margin: 0; font-weight: 800; font-size: 1.1rem; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: min(100%, 340px); }
  .tile { aspect-ratio: 1; border: 2.5px solid var(--color-espresso); border-radius: 14px; background: var(--color-paper);
    color: var(--color-espresso); font: 900 clamp(1.5rem, 8vw, 2.2rem) var(--font-heading, Nunito, sans-serif); cursor: pointer; }
  .tile:disabled { cursor: default; }
  .tile.lit { background: var(--color-mustard-tint); box-shadow: 0 0 0 3px var(--color-mustard); }
  .entry { display: flex; gap: 8px; width: 100%; max-width: 420px; margin: 0 auto; }
  .entry input { flex: 1; min-width: 0; min-height: 46px; padding: 0 14px; border: 2px solid var(--color-espresso); border-radius: 999px;
    font: 700 1.1rem var(--font-body, 'DM Sans', sans-serif); text-transform: uppercase; background: var(--color-paper); color: var(--color-espresso); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .words { display: grid; gap: 8px; justify-items: center; }
  .heading { margin: 0; display: flex; gap: 8px; }
  .words ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .chip { border: 1.5px solid var(--color-espresso); border-radius: 999px; padding: 4px 10px; background: var(--color-cream);
    color: var(--color-espresso); font: 700 .9rem var(--font-body, 'DM Sans', sans-serif); cursor: pointer; }
  .results { display: grid; gap: 12px; }
  .found ul { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
  .found li { padding: 2px 8px; border-radius: 999px; background: var(--color-linen); font-weight: 700; font-size: .85rem; }
  .found li.shared { color: var(--color-ink-muted); text-decoration: line-through; }
  .found li.none { background: none; color: var(--color-ink-muted); font-weight: 400; }
  .missed { color: var(--color-ink-muted); }
</style>
