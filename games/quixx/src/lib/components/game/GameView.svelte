<script lang="ts">
  import './inks.css';
  import type { GameSocket } from '@parlor/multiplayer/client';
  import { TurnBanner, SeatChip, Button } from '@parlor/ui';
  import type { QuixxPlayerView, RowColor, AvailableMove } from '../../types/game.js';
  import { ROW_COLORS } from '../../types/game.js';
  import { scoreRow } from '../../game/scoring.js';
  import { getAvailablePhase2Moves } from '../../game/validation.js';
  import DiceTray from './DiceTray.svelte';
  import Scoresheet from './Scoresheet.svelte';
  import GameOverScreen from './GameOverScreen.svelte';

  let {
    view,
    socket,
    playerId,
  }: {
    view: QuixxPlayerView;
    socket: GameSocket<'quixx'>;
    playerId: string;
  } = $props();

  let selectedMove = $state<{ row: RowColor; cellIndex: number } | null>(null);

  // A pick only lasts for the phase it was made in.
  let previousPhase: QuixxPlayerView['phase'] | undefined;
  $effect(() => {
    const phase = view.phase;
    if (previousPhase !== undefined && phase !== previousPhase) selectedMove = null;
    previousPhase = phase;
  });

  type Player = QuixxPlayerView['players'][number];

  function scoreOf(p: Player): number {
    return ROW_COLORS.reduce((sum, row) => sum + scoreRow(p.sheet[row], p.lockedRows.includes(row)), 0) - p.penalties * 5;
  }

  let me = $derived<Player | undefined>(view.players[view.myIndex]);
  let activeName = $derived(view.players[view.activePlayerIndex]?.name ?? 'Someone');
  let whiteSum = $derived(view.dice.rolled ? view.dice.white1 + view.dice.white2 : null);
  let submitted = $derived(me?.phase1Submitted ?? false);
  let submittedCount = $derived(view.players.filter((p) => p.phase1Submitted).length);

  // The active player's colour combos, shown dashed while everyone picks a white sum.
  let phase2Preview = $derived<AvailableMove[]>(
    view.phase === 'phase1' && view.isActivePlayer && view.dice.rolled && me
      ? getAvailablePhase2Moves(me.sheet, view.dice, view.lockedRows, view.removedDice)
      : [],
  );

  let choosing = $derived(
    !!me && ((view.phase === 'phase1' && !submitted) || (view.phase === 'phase2' && view.isActivePlayer)),
  );
  let canRoll = $derived(view.phase === 'rolling' && view.isActivePlayer);
  let noMoves = $derived(choosing && view.availableMoves.length === 0);
  let penaltyIfPass = $derived(view.phase === 'phase2' && view.activePlayerPhase1Passed);

  let banner = $derived.by(() => {
    const mine = canRoll || choosing;
    if (view.phase === 'rolling') {
      return canRoll
        ? { mine, title: 'Your roll', detail: 'Roll the dice to start your turn.' }
        : { mine, title: `${activeName} is rolling`, detail: undefined };
    }
    if (view.phase === 'phase1') {
      if (!me) return { mine, title: `${activeName} rolled ${whiteSum}`, detail: 'Everyone may cross off the white sum.' };
      if (submitted) return { mine, title: 'Waiting for the table', detail: `${submittedCount} of ${view.players.length} players have chosen.` };
      if (noMoves) return { mine, title: `White sum ${whiteSum}`, detail: 'Nothing to cross off. Pass.' };
      if (selectedMove) return { mine, title: `White sum ${whiteSum}`, detail: 'Confirm your cross, or pick another box.' };
      return {
        mine,
        title: view.isActivePlayer ? `You rolled ${whiteSum}` : `${activeName} rolled ${whiteSum}`,
        detail: phase2Preview.length > 0
          ? 'Cross off the white sum in any row, or pass. Dashed boxes are your colour combos next.'
          : 'Cross off the white sum in any row, or pass.',
      };
    }
    if (view.phase === 'phase2') {
      if (!view.isActivePlayer) return { mine, title: `${activeName} is using a colour`, detail: undefined };
      const pass = penaltyIfPass ? 'or take a penalty' : 'or pass';
      if (noMoves) return { mine, title: 'Colour combo', detail: penaltyIfPass ? 'Nothing to cross off. Take a penalty.' : 'Nothing to cross off. Pass.' };
      return { mine, title: 'Colour combo', detail: `Add a white die to a coloured die and cross it off, ${pass}.` };
    }
    return { mine: false, title: 'Turn over', detail: undefined };
  });

  let seats = $derived(
    view.players.map((p, seat) => ({ ...p, seat })).filter((p) => p.seat !== view.myIndex),
  );

  function seatStat(p: Player): string {
    if (view.phase === 'phase1') return p.phase1Submitted ? 'done' : 'choosing';
    const score = scoreOf(p);
    return `${score} ${Math.abs(score) === 1 ? 'pt' : 'pts'}`;
  }

  function select(row: RowColor, cellIndex: number) {
    selectedMove = selectedMove?.row === row && selectedMove.cellIndex === cellIndex ? null : { row, cellIndex };
  }

  function confirm() {
    if (!selectedMove) return;
    const { row, cellIndex } = selectedMove;
    socket.emit('game:action', { type: view.phase === 'phase1' ? 'phase1-mark' : 'phase2-mark', row, cellIndex });
  }

  function pass() {
    selectedMove = null;
    socket.emit('game:action', { type: view.phase === 'phase1' ? 'phase1-pass' : 'phase2-pass' });
  }

  const roll = () => socket.emit('game:action', { type: 'roll-dice' });
</script>

<div class="board quixx-inks">
  {#if view.gameOver && view.scores}
    <GameOverScreen {socket} scores={view.scores} players={view.players} myPlayerId={playerId} />
  {:else}
    <TurnBanner mine={banner.mine} title={banner.title} detail={banner.detail} />

    {#if seats.length > 0}
      <ul class="seats" aria-label={me ? 'Other players' : 'Players'}>
        {#each seats as p (p.id)}
          <li>
            <SeatChip
              name={p.name}
              seat={p.seat}
              stat={seatStat(p)}
              active={p.seat === view.activePlayerIndex}
              connected={p.connected}
              bot={p.isBot}
            />
          </li>
        {/each}
      </ul>
    {/if}

    <DiceTray dice={view.dice} removedDice={view.removedDice} />

    {#if me}
      <Scoresheet
        sheet={me.sheet}
        penalties={me.penalties}
        score={scoreOf(me)}
        lockedRows={me.lockedRows}
        closedRows={view.lockedRows}
        availableMoves={choosing ? view.availableMoves : []}
        {selectedMove}
        {phase2Preview}
        onselect={choosing ? select : undefined}
      />
    {/if}

    {#if canRoll}
      <div class="actions">
        <Button shout onclick={roll}>Roll dice</Button>
      </div>
    {:else if choosing}
      <div class="actions">
        {#if !noMoves}
          <Button shout disabled={!selectedMove} onclick={confirm}>Cross it off</Button>
        {/if}
        <Button variant={noMoves ? 'primary' : 'secondary'} onclick={pass}>
          {penaltyIfPass ? 'Take a penalty' : 'Pass'}
        </Button>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Quixx's own colours are its four printed row inks (inks.css); felt, its
     shelf colour, is the dice tray. */
  .board {
    --die-size: 42px;
    max-width: 600px;
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
      --die-size: 52px;
      gap: 18px;
    }
  }

  .seats {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .seats li {
    max-width: 100%;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    width: 100%;
    max-width: 360px;
    margin: 0 auto;
  }
</style>
