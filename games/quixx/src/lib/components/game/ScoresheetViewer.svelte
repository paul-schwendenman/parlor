<script lang="ts">
  import type { Scoresheet as ScoresheetType, RowColor, PlayerScore } from '../../types/game.js';
  import { ROW_COLORS } from '../../types/game.js';
  import Scoresheet from './Scoresheet.svelte';
  import { Modal } from '@parlor/ui';

  interface PlayerData {
    id: string;
    name: string;
    sheet: ScoresheetType;
    penalties: number;
    lockedRows: RowColor[];
  }

  let {
    players,
    scores,
    myPlayerId,
    initialPlayerId,
    open = $bindable(),
    onclose,
  }: {
    players: PlayerData[];
    scores: PlayerScore[];
    myPlayerId: string;
    initialPlayerId: string;
    open: boolean;
    onclose?: () => void;
  } = $props();

  let selectedPlayerId = $state(initialPlayerId);

  $effect(() => {
    if (open) {
      selectedPlayerId = initialPlayerId;
    }
  });

  let selectedPlayer = $derived(players.find((p) => p.id === selectedPlayerId) ?? players[0]);
  let selectedScore = $derived(scores.find((s) => s.playerId === selectedPlayerId) ?? scores[0]);

  const ROW_DISPLAY_COLORS: Record<RowColor, string> = {
    red: '#dc2626',
    yellow: '#ca8a04',
    green: '#16a34a',
    blue: '#2563eb',
  };

  function isWinner(playerId: string): boolean {
    return scores[0]?.playerId === playerId;
  }
</script>

<Modal bind:open {onclose}>
  <div class="viewer">
    <div class="header">
      <h3>Scoresheets</h3>
      <button class="close-btn" onclick={() => { open = false; onclose?.(); }} aria-label="Close">✕</button>
    </div>

    <div class="tabs">
      {#each players as player}
        <button
          class="tab"
          class:active={player.id === selectedPlayerId}
          class:me={player.id === myPlayerId}
          onclick={() => (selectedPlayerId = player.id)}
        >
          {isWinner(player.id) ? '★ ' : ''}{player.name}{player.id === myPlayerId ? ' (You)' : ''}
        </button>
      {/each}
    </div>

    {#if selectedPlayer}
      <div class="scoresheet-container">
        <Scoresheet
          sheet={selectedPlayer.sheet}
          penalties={selectedPlayer.penalties}
          score={selectedScore?.total ?? 0}
          lockedRows={selectedPlayer.lockedRows}
          availableMoves={[]}
        />
      </div>

      {#if selectedScore}
        <div class="breakdown">
          <h4>Score Breakdown</h4>
          <table>
            <tbody>
              {#each ROW_COLORS as color}
                <tr>
                  <td class="row-label" style="color: {ROW_DISPLAY_COLORS[color]}">{color[0].toUpperCase() + color.slice(1)}</td>
                  <td class="row-score">{selectedScore.rowScores[color]}</td>
                </tr>
              {/each}
              {#if selectedScore.penalties > 0}
                <tr class="penalty-row">
                  <td class="row-label">Penalties ({selectedScore.penalties}×)</td>
                  <td class="row-score">-{selectedScore.penalties * 5}</td>
                </tr>
              {/if}
              <tr class="total-row">
                <td class="row-label">Total</td>
                <td class="row-score">{selectedScore.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </div>
</Modal>

<style>
  .viewer {
    min-width: 320px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 4px 8px;
    color: #6b7280;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }

  .tab {
    scroll-snap-align: start;
    flex-shrink: 0;
    padding: 6px 14px;
    border-radius: 9999px;
    border: 2px solid #e5e7eb;
    background: #f9fafb;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .tab:hover {
    background: #e5e7eb;
  }

  .tab.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }

  .tab.me:not(.active) {
    border-color: #93c5fd;
  }

  .scoresheet-container {
    margin-bottom: 16px;
  }

  .breakdown {
    background: #f9fafb;
    border-radius: 8px;
    padding: 12px 16px;
  }

  .breakdown h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .breakdown table {
    width: 100%;
    border-collapse: collapse;
  }

  .breakdown td {
    padding: 4px 0;
  }

  .row-label {
    font-weight: 600;
    text-transform: capitalize;
  }

  .row-score {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .penalty-row {
    color: #dc2626;
  }

  .total-row {
    border-top: 2px solid #d1d5db;
  }

  .total-row td {
    padding-top: 8px;
    font-size: 18px;
    font-weight: 700;
  }
</style>
