<script lang="ts">
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { TurnBanner, SeatChip, GameOver, Button, Felt } from '@parlor/ui';
  import type { BootyDicePlayerView } from '../../types/game.js';
  import BootyDie from './BootyDie.svelte';
  import FaceIcon from './FaceIcon.svelte';
  import GameLog from './GameLog.svelte';

  let {
    view,
    socket,
    playerId,
  }: {
    view: BootyDicePlayerView;
    socket: GameSocket<'booty-dice'>;
    playerId: string;
  } = $props();

  let current = $derived(view.players[view.currentPlayerIndex] ?? null);
  let me = $derived(view.players[view.myIndex] ?? null);
  let mine = $derived(view.isMyTurn);
  let hasRolled = $derived(view.rollsRemaining < 3);

  let unresolved = $derived(view.pendingActions.filter((a) => !a.resolved));
  // Targets are picked one die at a time, in die order.
  let targeting = $derived(mine && view.turnPhase === 'selecting_targets' ? (unresolved[0] ?? null) : null);

  let canRoll = $derived(mine && view.turnPhase === 'rolling' && view.rollsRemaining > 0);
  let canKeep = $derived(mine && view.turnPhase === 'rolling' && hasRolled);
  let canEndTurn = $derived(mine && hasRolled && unresolved.length === 0 && view.turnPhase !== 'rolling');

  let banner = $derived.by(() => {
    const name = current?.name ?? 'Someone';
    if (!mine) {
      if (view.turnPhase === 'selecting_targets') return { title: `${name} is picking a target`, detail: undefined };
      return { title: `${name}'s turn`, detail: hasRolled ? `${view.rollsRemaining} ${view.rollsRemaining === 1 ? 'roll' : 'rolls'} left` : undefined };
    }
    if (targeting) {
      const total = view.pendingActions.length;
      const done = total - unresolved.length;
      const what = targeting.face === 'cutlass' ? 'Tap the pirate your cutlass hits.' : 'Tap the pirate your Jolly Roger robs.';
      return { title: 'Pick a target', detail: total > 1 ? `${what} ${done + 1} of ${total}.` : what };
    }
    if (view.turnPhase === 'rolling') {
      if (!hasRolled) return { title: 'Your turn', detail: 'Roll the dice. You get three rolls.' };
      if (view.rollsRemaining === 0) return { title: 'Your turn', detail: 'Out of rolls. Keep this roll.' };
      return { title: 'Your turn', detail: `Tap dice to keep them, then roll again (${view.rollsRemaining} left) or keep this roll.` };
    }
    return { title: 'Your turn', detail: 'Done plundering. End your turn.' };
  });

  function toggleKeep(index: number) {
    if (!mine || view.turnPhase !== 'rolling' || !hasRolled) return;
    const kept = view.dice.filter((d) => d.locked).map((d) => d.id);
    const next = kept.includes(index) ? kept.filter((i) => i !== index) : [...kept, index];
    socket.emit('game:action', { type: 'lockDice', diceIndices: next });
  }

  function target(id: string) {
    if (!targeting) return;
    socket.emit('game:action', { type: 'selectTarget', dieIndex: targeting.dieIndex, targetPlayerId: id });
  }

  const roll = () => socket.emit('game:action', { type: 'roll' });
  const keep = () => socket.emit('game:action', { type: 'finishRolling' });
  const endTurn = () => socket.emit('game:action', { type: 'endTurn' });
  const playAgain = () => socket.emit('lobby:restartGame');
  const backToLobby = () => socket.emit('lobby:resetGame');

  let winner = $derived(view.players.find((p) => p.id === view.winnerId) ?? null);

  let standings = $derived(
    view.players
      .map((p, seat) => ({ p, seat }))
      .sort((a, b) =>
        (b.p.id === view.winnerId ? 1 : 0) - (a.p.id === view.winnerId ? 1 : 0) ||
        Number(a.p.isEliminated) - Number(b.p.isEliminated) ||
        b.p.doubloons - a.p.doubloons,
      )
      .map(({ p, seat }) => ({
        id: p.id,
        name: p.name,
        seat,
        detail: p.isEliminated ? 'Sunk' : `${p.doubloons} doubloons`,
        winner: p.id === view.winnerId,
        you: p.id === playerId,
        bot: p.isAI,
      })),
  );
</script>

<div class="board">
  {#if view.phase === 'ended'}
    <GameOver
      headline={winner ? (winner.id === playerId ? 'You win!' : `${winner.name} wins!`) : 'Game over'}
      detail={winner && winner.doubloons >= 25 ? 'Rich enough to retire: 25 doubloons.' : 'Last pirate standing.'}
      {standings}
      onplayagain={playerId ? playAgain : undefined}
      onlobby={playerId ? backToLobby : undefined}
    />
  {:else}
    <TurnBanner {mine} title={banner.title} detail={banner.detail} />

    <Felt tone="night" label="Dice">
      <div class="tray">
        <div class="dice" role="group" aria-label="Dice">
          {#each view.dice as die, i (die.id)}
            <BootyDie {die} blank={!hasRolled} selectable={canKeep} current={targeting?.dieIndex === i} onclick={() => toggleKeep(i)} />
          {/each}
        </div>
        <p class="rolls">
          {hasRolled ? `${view.rollsRemaining} of 3 rolls left` : 'Three rolls a turn'}
        </p>
      </div>
    </Felt>

    {#if canRoll || canKeep || canEndTurn}
      <div class="actions">
        {#if canRoll}
          <Button shout onclick={roll}>{hasRolled ? 'Roll again' : 'Roll dice'}</Button>
        {/if}
        {#if canKeep}
          <Button variant={canRoll ? 'secondary' : 'primary'} shout={!canRoll} onclick={keep}>Keep this roll</Button>
        {/if}
        {#if canEndTurn}
          <Button shout onclick={endTurn}>End turn</Button>
        {/if}
      </div>
    {/if}

    <ul class="seats" aria-label="Pirates">
      {#each view.players as p, seat (p.id)}
        {@const canTarget = !!targeting && p.id !== me?.id && !p.isEliminated}
        <li>
          <SeatChip
            wide
            name={p.name}
            {seat}
            stat="{p.doubloons} doubloons, {p.lives} lives, {p.shields} shields"
            active={p.id === current?.id}
            connected={p.isConnected}
            you={p.id === me?.id}
            bot={p.isAI}
            out={p.isEliminated}
            targetable={canTarget}
            onclick={targeting ? () => target(p.id) : undefined}
          >
            <span class="stat"><FaceIcon face="doubloon" size={16} />{p.doubloons}</span>
            <span class="stat"><FaceIcon face="heart" size={16} />{p.lives}</span>
            <span class="stat"><FaceIcon face="shield" size={16} />{p.shields}</span>
          </SeatChip>
        </li>
      {/each}
    </ul>

    <GameLog entries={view.gameLog} />
  {/if}
</div>

<style>
  /* Booty Dice prints its dice in Deep Clay, its shelf colour, on the
     pirates' night table. */
  .board {
    --die-size: 48px;
    max-width: 560px;
    margin: 0 auto;
    padding: 4px 16px 32px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: var(--color-espresso);
    font-family: var(--font-body);
  }

  @media (min-width: 600px) {
    .board {
      --die-size: 60px;
      gap: 18px;
    }
  }

  .tray {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .dice {
    display: grid;
    grid-template-columns: repeat(6, var(--die-size));
    gap: 8px;
    padding-top: 4px;
  }

  @media (max-width: 400px) {
    .dice {
      grid-template-columns: repeat(3, var(--die-size));
      gap: 12px 14px;
    }
  }

  .rolls {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .actions {
    width: 100%;
    max-width: 360px;
    margin: 0 auto;
    display: grid;
    gap: 10px;
  }

  .seats {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stat {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
</style>
