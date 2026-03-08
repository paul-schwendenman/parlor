<script lang="ts">
  import type { QuixxPlayerView, RowColor, AvailableMove } from '../../types/game.js';
  import { ROW_COLORS } from '../../types/game.js';
  import { scoreRow } from '../../game/scoring.js';
  import { getAvailablePhase2Moves } from '../../game/validation.js';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import DiceDisplay from './DiceDisplay.svelte';
  import Scoresheet from './Scoresheet.svelte';
  import PhaseIndicator from './PhaseIndicator.svelte';
  import PlayerList from './PlayerList.svelte';
  import GameOverScreen from './GameOverScreen.svelte';
  import TurnBanner from './TurnBanner.svelte';
  import OptionsSummary from './OptionsSummary.svelte';

  let {
    view,
    socket,
    playerId,
  }: {
    view: QuixxPlayerView;
    socket: GameSocket;
    playerId: string;
  } = $props();

  let selectedMove = $state<{ row: RowColor; cellIndex: number } | null>(null);

  // Clear selection when phase changes
  let currentPhase = $derived(view.phase);
  let previousPhase: typeof currentPhase | undefined;
  $effect(() => {
    if (previousPhase !== undefined && currentPhase !== previousPhase) {
      selectedMove = null;
    }
    previousPhase = currentPhase;
  });

  let myScore = $derived.by(() => {
    const me = view.players[view.myIndex];
    if (!me) return 0;
    let total = 0;
    for (const row of ROW_COLORS) {
      const hasLock = me.lockedRows.includes(row);
      total += scoreRow(me.sheet[row], hasLock);
    }
    total -= me.penalties * 5;
    return total;
  });

  let submittedCount = $derived(
    view.players.filter((p) => p.phase1Submitted).length,
  );

  let whiteSum = $derived.by(() => {
    if (!view.dice.rolled) return null;
    return view.dice.white1 + view.dice.white2;
  });

  let phase1Submitted = $derived(
    view.players[view.myIndex]?.phase1Submitted ?? false,
  );

  let activePlayerName = $derived(
    view.players[view.activePlayerIndex]?.name ?? null,
  );

  let phase2Preview: AvailableMove[] = $derived.by(() => {
    if (view.phase !== 'phase1' || !view.isActivePlayer || !view.dice.rolled) return [];
    const myPlayer = view.players[view.myIndex];
    if (!myPlayer) return [];
    return getAvailablePhase2Moves(
      myPlayer.sheet,
      view.dice,
      view.lockedRows,
      view.removedDice,
    );
  });

  function handleSelect(row: RowColor, cellIndex: number) {
    if (
      selectedMove &&
      selectedMove.row === row &&
      selectedMove.cellIndex === cellIndex
    ) {
      selectedMove = null;
    } else {
      selectedMove = { row, cellIndex };
    }
  }

  function handleConfirm() {
    if (!selectedMove) return;
    const { row, cellIndex } = selectedMove;
    if (view.phase === 'phase1') {
      socket.emit('game:action', { type: 'phase1-mark', row, cellIndex });
    } else if (view.phase === 'phase2') {
      socket.emit('game:action', { type: 'phase2-mark', row, cellIndex });
    }
  }

  function handlePass() {
    selectedMove = null;
    if (view.phase === 'phase1') {
      socket.emit('game:action', { type: 'phase1-pass' });
    } else if (view.phase === 'phase2') {
      socket.emit('game:action', { type: 'phase2-pass' });
    }
  }

  function handleRoll() {
    socket.emit('game:action', { type: 'roll-dice' });
  }
</script>

{#if view.gameOver && view.scores}
  <GameOverScreen scores={view.scores} players={view.players} myPlayerId={playerId} />
{:else}
  <div class="game-page">
    <TurnBanner
      round={view.round}
      isActivePlayer={view.isActivePlayer}
      {activePlayerName}
      phase={view.phase}
    />

    {#if view.dice.rolled}
      <DiceDisplay dice={view.dice} removedDice={view.removedDice} />
    {/if}

    <PhaseIndicator
      phase={view.phase}
      isActivePlayer={view.isActivePlayer}
      {activePlayerName}
      {phase1Submitted}
      {submittedCount}
      totalPlayers={view.players.length}
      hasSelection={selectedMove !== null}
      activePlayerPhase1Passed={view.activePlayerPhase1Passed}
      onpass={handlePass}
      onroll={handleRoll}
      onconfirm={handleConfirm}
    />

    <OptionsSummary
      phase={view.phase}
      isActivePlayer={view.isActivePlayer}
      {whiteSum}
      availableMoves={view.availableMoves}
      {phase2Preview}
      {phase1Submitted}
    />

    <Scoresheet
      sheet={view.players[view.myIndex].sheet}
      penalties={view.players[view.myIndex].penalties}
      score={myScore}
      lockedRows={view.players[view.myIndex].lockedRows}
      availableMoves={view.availableMoves}
      {selectedMove}
      {phase2Preview}
      onselect={handleSelect}
    />

    <PlayerList {view} />
  </div>
{/if}

<style>
  .game-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }
</style>
