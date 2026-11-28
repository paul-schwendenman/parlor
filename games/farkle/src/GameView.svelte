<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { Button, CardBoard, Felt, GameOver, PipDie, SeatChip, TurnBanner } from '@parlor/ui';
  import { OPENING_SCORE, TARGET_SCORE, scoreDice, scoringSelections } from './rules.js';
  import type { FarkleAction, FarkleView } from './types.js';

  let { view, socket, playerId, isHost }: {
    view: FarkleView; socket: GameSocket<'farkle'>; playerId: string; isHost: boolean;
  } = $props();

  let selection = $state<{ roll: number; indices: number[] }>();
  let pending = $state(false);
  let error = $state('');
  let active = $derived(view.players.find(({ id }) => id === view.activePlayerId));
  let acting = $derived(view.activePlayerId === playerId);
  let selecting = $derived(view.phase === 'selecting');
  let selected = $derived(selecting && acting && selection?.roll === view.rollNumber ? selection.indices : []);
  let points = $derived(scoreDice(selected.map((index) => view.dice[index]).filter(Boolean)));
  let eligible = $derived(new Set(scoringSelections(view.dice).flatMap(({ indices }) => indices)));
  let standings = $derived(view.players.map((player, seat) => {
    const place = 1 + view.players.filter((other) => !other.out && (player.out || other.score > player.score)).length;
    return { ...player, seat, place, detail: `${player.score.toLocaleString()} pts${player.out ? ' · Left' : ''}`, winner: !player.out && place === 1, you: player.id === playerId };
  }).sort((a, b) => a.place - b.place));

  function toggle(index: number) {
    const indices = selected.includes(index) ? selected.filter((die) => die !== index) : [...selected, index];
    selection = { roll: view.rollNumber, indices };
  }

  async function send(action: FarkleAction) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      const result = await socket.timeout(5000).emitWithAck('game:action', action);
      if (!result.ok) error = result.message;
      else if (action.type === 'keep') selection = undefined;
    } catch {
      error = 'The table did not respond. Try again.';
    } finally {
      pending = false;
    }
  }
</script>

<CardBoard label="Farkle game">
  {#if view.phase === 'game-over'}
    <GameOver
      headline={standings[1]?.winner ? 'Shared win!' : standings[0].you ? 'You win!' : `${standings[0].name} wins!`}
      {standings}
      onplayagain={isHost ? () => socket.emit('lobby:restartGame') : undefined}
      onlobby={isHost ? () => socket.emit('lobby:resetGame') : undefined}
    />
  {:else}
    <TurnBanner mine={acting && (selecting || view.phase === 'ready')}
      title={view.phase === 'bust' ? 'Farkle!' : view.phase === 'banked' ? `${active?.name} banked ${view.turnScore.toLocaleString()} points` : acting ? 'Your turn' : `${active?.name}’s turn`}
      detail={view.phase === 'bust' ? `${active?.name} lost ${view.turnScore.toLocaleString()} unbanked points.`
        : acting && selecting ? 'Pick scoring dice, then keep them.'
        : acting && view.phase === 'ready' && !active?.score && !view.canBank ? `Your first bank needs ${OPENING_SCORE} points.`
        : undefined} />
    <ul class="seats" aria-label="Scores">
      {#each view.players as player, seat (player.id)}
        <li><SeatChip name={player.name} {seat} you={player.id === playerId} bot={player.bot}
          connected={player.connected} active={player.id === view.activePlayerId} stat={`${player.score.toLocaleString()} pts${player.out ? ' · Left' : ''}`} /></li>
      {/each}
    </ul>

    <Felt label="Dice table">
      <div class="tray">
        <div class="score">
          <strong>{view.turnScore.toLocaleString()} unbanked</strong>
          <span>{view.finalRound ? 'Final turns' : `Target ${TARGET_SCORE.toLocaleString()}`}</span>
        </div>
        {#if view.dice.length}
          <div class="dice">
            {#each view.dice as die, index (index)}
              <PipDie value={die} picked={selected.includes(index)} dimmed={selecting && !eligible.has(index)}
                onclick={selecting && acting ? () => toggle(index) : undefined} disabled={pending || !eligible.has(index)} />
            {/each}
          </div>
        {:else if view.phase === 'ready'}
          <p>{view.kept.length && view.diceToRoll === 6 ? 'Hot dice! All six can roll again.' : `${view.diceToRoll} dice ready to roll`}</p>
        {/if}
        {#if view.kept.length}
          <p class="kept">Kept this turn · {view.kept.map(({ dice, points }) => `${dice.join('–')} (+${points})`).join(' · ')}</p>
        {/if}
      </div>
    </Felt>

    {#if acting}
      <div class="actions">
        {#if selecting}
          <Button shout disabled={pending || !points} onclick={() => send({ type: 'keep', indices: [...selected] })}>
            {points ? `Keep for ${points}` : 'Keep dice'}
          </Button>
        {:else if view.phase === 'ready'}
          <Button shout disabled={pending} onclick={() => send({ type: 'roll' })}>Roll {view.diceToRoll}</Button>
          <Button variant="secondary" disabled={pending || !view.canBank} onclick={() => send({ type: 'bank' })}>Bank {view.turnScore.toLocaleString()}</Button>
        {/if}
      </div>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</CardBoard>

<style>
  .seats, .dice, .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .seats { margin: 0; padding: 0; list-style: none; }
  .tray { display: grid; gap: 16px; width: 100%; text-align: center; }
  .tray p { margin: 0; overflow-wrap: anywhere; }
  .kept { padding: 8px; border-radius: 8px; background: var(--color-linen); color: var(--color-espresso); }
  .dice { gap: 6px; --die-size: clamp(44px, 10vw, 56px); }
  .score { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .score strong { font: 900 1.2rem var(--font-heading); }
</style>
