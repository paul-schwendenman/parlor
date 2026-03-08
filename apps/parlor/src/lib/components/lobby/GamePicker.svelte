<script lang="ts">
  import type { GameMeta } from '@parlor/game-types';
  import RulesModal from './RulesModal.svelte';

  interface Props {
    games: GameMeta[];
    onselect: (gameId: string) => void;
  }

  let { games, onselect }: Props = $props();

  let rulesGameId = $state<string | null>(null);
  let rulesOpen = $derived(rulesGameId !== null);
  let rulesGame = $derived(games.find((g) => g.id === rulesGameId));

  function openRules(gameId: string) {
    rulesGameId = gameId;
  }

  function closeRules() {
    rulesGameId = null;
  }

  function playFromRules() {
    if (rulesGameId) {
      onselect(rulesGameId);
      rulesGameId = null;
    }
  }
</script>

<div class="game-picker">
  <p class="picker-label">Choose a game</p>
  <div class="picker-options">
    {#each games as game (game.id)}
      <div class="picker-card">
        <span class="picker-name">{game.name}</span>
        <span class="picker-meta">{game.minPlayers}-{game.maxPlayers}p &middot; {game.estimatedMinutes} min</span>
        <span class="picker-desc">{game.description}</span>
        <div class="picker-actions">
          <button class="action-learn" onclick={() => openRules(game.id)}>Learn More</button>
          <button class="action-start" onclick={() => onselect(game.id)}>Start Game</button>
        </div>
      </div>
    {/each}
  </div>
</div>

<RulesModal
  open={rulesOpen}
  gameId={rulesGameId}
  gameName={rulesGame?.name ?? ''}
  onclose={closeRules}
  onplay={playFromRules}
/>

<style>
  .game-picker {
    text-align: center;
  }

  .picker-label {
    font-size: 0.85rem;
    color: #a8a29e;
    margin: 0 0 0.75rem;
  }

  .picker-options {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .picker-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.75rem 1.25rem;
    background: white;
    border: 1.5px solid var(--color-linen);
    border-radius: 10px;
    transition: border-color 0.2s, box-shadow 0.2s;
    min-width: 130px;
  }

  .picker-card:hover {
    border-color: var(--color-terracotta);
    box-shadow: 0 2px 8px rgba(196, 102, 58, 0.1);
  }

  .picker-name {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--color-espresso);
  }

  .picker-meta {
    font-size: 0.7rem;
    color: #a8a29e;
  }

  .picker-desc {
    font-size: 0.75rem;
    color: #78716c;
    margin-top: 0.1rem;
  }

  .picker-actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.5rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .picker-card:hover .picker-actions {
    opacity: 1;
  }

  @media (hover: none) {
    .picker-actions {
      opacity: 1;
    }
  }

  .action-learn, .action-start {
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.2s;
    border: none;
  }

  .action-learn {
    background: var(--color-linen);
    color: #78716c;
  }

  .action-learn:hover {
    background: #e7e5e4;
  }

  .action-start {
    background: var(--color-terracotta);
    color: white;
  }

  .action-start:hover {
    background: #a8552f;
  }
</style>
