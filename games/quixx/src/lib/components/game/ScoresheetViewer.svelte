<script lang="ts">
  import './inks.css';
  import type { Scoresheet as ScoresheetType, RowColor, PlayerScore } from '../../types/game.js';
  import { ROW_COLORS } from '../../types/game.js';
  import { Modal, Button } from '@parlor/ui';
  import Scoresheet from './Scoresheet.svelte';

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

  let selectedPlayerId = $state('');

  $effect(() => {
    if (open) selectedPlayerId = initialPlayerId;
  });

  let selectedPlayer = $derived(players.find((p) => p.id === selectedPlayerId) ?? players[0]);
  let selectedScore = $derived(scores.find((s) => s.playerId === selectedPlayer?.id));

  const ROW_NAMES: Record<RowColor, string> = { red: 'Red', yellow: 'Yellow', green: 'Green', blue: 'Blue' };

  function close() {
    open = false;
    onclose?.();
  }
</script>

<Modal bind:open {onclose} title="Scoresheets">
  <div class="viewer quixx-inks">
    <div class="tabs" role="tablist" aria-label="Players">
      {#each players as player (player.id)}
        <button
          type="button"
          role="tab"
          class="tab"
          aria-selected={player.id === selectedPlayer?.id}
          onclick={() => (selectedPlayerId = player.id)}
        >
          {player.name}{player.id === myPlayerId ? ' · you' : ''}
        </button>
      {/each}
    </div>

    {#if selectedPlayer && selectedScore}
      <div role="tabpanel" aria-label="{selectedPlayer.name}'s scoresheet">
        <Scoresheet
          sheet={selectedPlayer.sheet}
          penalties={selectedPlayer.penalties}
          score={selectedScore.total}
          lockedRows={selectedPlayer.lockedRows}
        />

        <dl class="breakdown">
          {#each ROW_COLORS as row (row)}
            <div class="line"><dt><span class="swatch swatch-{row}" aria-hidden="true"></span>{ROW_NAMES[row]}</dt><dd>{selectedScore.rowScores[row]}</dd></div>
          {/each}
          {#if selectedScore.penalties > 0}
            <div class="line penalty"><dt>Penalties ×{selectedScore.penalties}</dt><dd>−{selectedScore.penalties * 5}</dd></div>
          {/if}
          <div class="line total"><dt>Total</dt><dd>{selectedScore.total}</dd></div>
        </dl>
      </div>
    {/if}

    <div class="footer">
      <Button variant="secondary" onclick={close}>Close</Button>
    </div>
  </div>
</Modal>

<style>
  .viewer {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 2px 4px;
  }

  .tab {
    flex-shrink: 0;
    min-height: 40px;
    padding: 0 16px;
    border: 2px solid var(--color-espresso);
    border-radius: 999px;
    background: transparent;
    color: var(--color-espresso);
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 0.9375rem;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .tab:hover {
    background: rgba(59, 47, 47, 0.06);
  }

  .tab[aria-selected='true'] {
    background: var(--color-espresso);
    color: var(--color-cream);
  }

  .breakdown {
    margin: 14px 0 0;
    padding: 0 4px;
  }

  .line {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1.5px solid var(--color-linen);
  }

  dt {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  dd {
    margin: 0;
    font-family: var(--font-heading);
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .swatch {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-espresso);
    border-radius: 4px;
  }

  .swatch-red { background: var(--row-red); }
  .swatch-yellow { background: var(--row-yellow); }
  .swatch-green { background: var(--row-green); }
  .swatch-blue { background: var(--row-blue); }

  .penalty dd {
    color: var(--color-danger);
  }

  .total {
    border-bottom: 0;
    border-top: 2px solid var(--color-espresso);
    margin-top: 4px;
    padding-top: 10px;
  }

  .total dt {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.125rem;
  }

  .total dd {
    font-size: 1.375rem;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
  }
</style>
