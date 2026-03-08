<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { getSocket, createRoomAction, joinRoomAction } from '$lib/stores/socketClient.js';
  import type { GameMeta } from '@parlor/game-types';

  // Game metadata - static list matching server registry
  const games: GameMeta[] = [
    {
      id: 'quixx',
      name: 'Quixx',
      description: 'A fast-paced dice game of marking numbers and strategic choices.',
      minPlayers: 2,
      maxPlayers: 5,
      estimatedMinutes: '15-20',
      tags: ['dice', 'strategy', 'quick'],
      displayModes: ['peer'],
    },
    {
      id: 'crazy-eights',
      name: 'Crazy Eights',
      description: 'Classic card game — match suits or ranks, play eights to change the suit.',
      minPlayers: 2,
      maxPlayers: 5,
      estimatedMinutes: '10-15',
      tags: ['cards', 'classic', 'quick'],
      displayModes: ['peer'],
    },
    {
      id: 'booty-dice',
      name: 'Booty Dice',
      description: 'A pirate dice game of treasure, attacks, and survival.',
      minPlayers: 2,
      maxPlayers: 6,
      estimatedMinutes: '15-30',
      tags: ['dice', 'pirates', 'competitive'],
      displayModes: ['peer'],
    },
  ];

  let prefillCode = $derived($page.url.searchParams.get('join') ?? '');
  let joinName = $state('');
  let joinCode = $state('');
  let error = $state('');
  let loading = $state(false);

  // For game card "create" flow
  let selectedGameForCreate = $state<string | null>(null);
  let createName = $state('');

  $effect(() => {
    joinCode = prefillCode;
  });

  onMount(() => {
    if (browser) {
      getSocket();
    }
  });

  async function handleJoin() {
    if (!joinName.trim()) { error = 'Enter your name'; return; }
    if (!joinCode.trim()) { error = 'Enter a room code'; return; }
    loading = true;
    error = '';
    try {
      const result = await joinRoomAction(joinCode.trim(), joinName.trim());
      if (result.success) {
        goto(`/lobby/${joinCode.trim().toUpperCase()}`);
      } else {
        error = result.error ?? 'Failed to join room';
      }
    } catch {
      error = 'Failed to join room';
    } finally {
      loading = false;
    }
  }

  function handleGameClick(gameId: string) {
    selectedGameForCreate = gameId;
  }

  async function handleCreateWithGame() {
    if (!createName.trim()) { error = 'Enter your name'; return; }
    if (!selectedGameForCreate) return;
    loading = true;
    error = '';
    try {
      const roomCode = await createRoomAction(createName.trim(), selectedGameForCreate);
      goto(`/lobby/${roomCode}`);
    } catch {
      error = 'Failed to create room';
    } finally {
      loading = false;
    }
  }

  function cancelCreate() {
    selectedGameForCreate = null;
    createName = '';
    error = '';
  }

  function handleJoinKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleJoin();
  }

  function handleCreateKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleCreateWithGame();
  }
</script>

<svelte:head><title>Parlor - Game Night</title></svelte:head>

<div class="home">
  <header class="brand">
    <h1 class="logo">Parlor</h1>
    <p class="tagline">Game night, anywhere</p>
  </header>

  <!-- Join Section -->
  <div class="join-section">
    <div class="join-card">
      <h2 class="section-title">Join a Room</h2>
      <div class="join-fields">
        <input
          type="text"
          bind:value={joinCode}
          placeholder="ABCD"
          maxlength="4"
          class="input input-code"
          onkeydown={handleJoinKeydown}
        />
        <input
          type="text"
          bind:value={joinName}
          placeholder="Your name"
          maxlength="20"
          class="input"
          onkeydown={handleJoinKeydown}
        />
        <button class="btn btn-join" onclick={handleJoin} disabled={loading}>
          Join
        </button>
      </div>
    </div>
  </div>

  <div class="divider"><span>or</span></div>

  <!-- Game Browser -->
  <div class="games-section">
    <h2 class="section-title">Choose a Game</h2>
    <div class="game-grid">
      {#each games as game (game.id)}
        <button class="game-card" onclick={() => handleGameClick(game.id)}>
          <h3 class="game-name">{game.name}</h3>
          <p class="game-desc">{game.description}</p>
          <div class="game-meta">
            <span class="meta-item">{game.minPlayers}-{game.maxPlayers} players</span>
            <span class="meta-item">{game.estimatedMinutes} min</span>
          </div>
          <div class="game-tags">
            {#each game.tags as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>
        </button>
      {/each}
    </div>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <!-- Create room modal overlay -->
  {#if selectedGameForCreate}
    {@const game = games.find(g => g.id === selectedGameForCreate)}
    <div class="modal-overlay" onclick={cancelCreate} role="presentation">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog">
        <h3 class="modal-title">Create {game?.name} Room</h3>
        <p class="modal-desc">{game?.description}</p>
        <div class="modal-fields">
          <label for="create-name">Your Name</label>
          <input
            id="create-name"
            type="text"
            bind:value={createName}
            placeholder="Enter your name"
            maxlength="20"
            class="input"
            onkeydown={handleCreateKeydown}
          />
        </div>
        {#if error}
          <p class="error">{error}</p>
        {/if}
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={cancelCreate}>Cancel</button>
          <button class="btn btn-primary" onclick={handleCreateWithGame} disabled={loading}>
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .home {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
    min-height: 100vh;
  }

  .brand {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .logo {
    font-family: var(--font-heading);
    font-size: 3.5rem;
    font-weight: 800;
    color: var(--color-espresso);
    margin: 0;
    line-height: 1;
  }

  .tagline {
    font-size: 1rem;
    color: #a8a29e;
    margin: 0.5rem 0 0;
    letter-spacing: 0.1em;
  }

  .section-title {
    font-family: var(--font-heading);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-espresso);
    margin: 0 0 1rem;
  }

  /* Join Section */
  .join-section {
    margin-bottom: 2.5rem;
  }

  .join-card {
    background: var(--color-linen);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(59, 47, 47, 0.06);
  }

  .join-fields {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .input {
    padding: 0.7rem 0.85rem;
    border: 1.5px solid #e7e5e4;
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: var(--font-body);
    color: var(--color-espresso);
    background: white;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input::placeholder {
    color: #c7c2be;
  }

  .input:focus {
    outline: none;
    border-color: var(--color-terracotta);
    box-shadow: 0 0 0 3px rgba(196, 102, 58, 0.1);
  }

  .input-code {
    width: 100px;
    text-transform: uppercase;
    letter-spacing: 0.25em;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .join-fields .input:not(.input-code) {
    flex: 1;
  }

  /* Buttons */
  .btn {
    padding: 0.7rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    white-space: nowrap;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-join {
    background: var(--color-espresso);
    color: white;
    flex-shrink: 0;
  }

  .btn-join:hover:not(:disabled) {
    background: #2a2020;
  }

  .btn-primary {
    background: var(--color-terracotta);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #a8552f;
  }

  .btn-secondary {
    background: var(--color-linen);
    color: var(--color-espresso);
  }

  .btn-secondary:hover:not(:disabled) {
    background: #ebe3d6;
  }

  /* Divider */
  .divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2.5rem;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1.5px;
    background: var(--color-linen);
  }

  .divider span {
    font-size: 0.85rem;
    font-weight: 600;
    color: #c7c2be;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }

  /* Game Grid */
  .games-section {
    margin-bottom: 2rem;
  }

  .game-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }

  .game-card {
    background: white;
    border: 2px solid var(--color-linen);
    border-radius: 16px;
    padding: 1.25rem;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .game-card:hover {
    border-color: var(--color-terracotta);
    box-shadow: 0 4px 16px rgba(196, 102, 58, 0.12);
    transform: translateY(-2px);
  }

  .game-name {
    font-family: var(--font-heading);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--color-espresso);
    margin: 0;
  }

  .game-desc {
    font-size: 0.85rem;
    color: #78716c;
    margin: 0;
    line-height: 1.4;
    flex: 1;
  }

  .game-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.8rem;
    color: #a8a29e;
  }

  .game-tags {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .tag {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: var(--color-linen);
    color: #78716c;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .error {
    color: #dc2626;
    font-size: 0.85rem;
    text-align: center;
    margin: 0.75rem 0;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(59, 47, 47, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .modal {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(59, 47, 47, 0.15);
  }

  .modal-title {
    font-family: var(--font-heading);
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--color-espresso);
    margin: 0 0 0.5rem;
  }

  .modal-desc {
    font-size: 0.85rem;
    color: #78716c;
    margin: 0 0 1.5rem;
  }

  .modal-fields {
    margin-bottom: 1rem;
  }

  .modal-fields label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: #78716c;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.35rem;
  }

  .modal-fields .input {
    width: 100%;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  @media (max-width: 600px) {
    .join-fields {
      flex-direction: column;
    }

    .input-code {
      width: 100%;
    }

    .btn-join {
      width: 100%;
    }

    .game-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
