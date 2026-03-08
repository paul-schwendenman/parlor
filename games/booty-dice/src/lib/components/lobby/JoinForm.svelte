<script lang="ts">
  import { createRoomAction, joinRoomAction } from '../../stores/socketClient.js';

  let { ongameready, prefillCode = '' }: { ongameready: (roomCode: string) => void; prefillCode?: string } = $props();

  let joinName = $state('');
  let createName = $state('');
  let roomCode = $state('');
  let error = $state('');
  let errorSide = $state<'join' | 'create' | null>(null);
  let loading = $state(false);
  let hasJoinCode = $derived(!!prefillCode);

  $effect(() => {
    roomCode = prefillCode;
  });

  async function handleCreate() {
    if (!createName.trim()) {
      error = 'Enter your name';
      errorSide = 'create';
      return;
    }
    loading = true;
    error = '';
    errorSide = null;
    try {
      const code = await createRoomAction(createName.trim());
      ongameready(code);
    } catch {
      error = 'Failed to create room';
      errorSide = 'create';
    } finally {
      loading = false;
    }
  }

  async function handleJoin() {
    if (!joinName.trim()) {
      error = 'Enter your name';
      errorSide = 'join';
      return;
    }
    if (!roomCode.trim()) {
      error = 'Enter a room code';
      errorSide = 'join';
      return;
    }
    loading = true;
    error = '';
    errorSide = null;
    try {
      const result = await joinRoomAction(roomCode.trim(), joinName.trim());
      if (result.success) {
        ongameready(roomCode.trim().toUpperCase());
      } else {
        error = result.error ?? 'Failed to join room';
        errorSide = 'join';
      }
    } catch {
      error = 'Failed to join room';
      errorSide = 'join';
    } finally {
      loading = false;
    }
  }

  function handleJoinKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleJoin();
  }

  function handleCreateKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleCreate();
  }
</script>

<div class="lobby-page">
  <header class="brand">
    <h1 class="logo">Parlor</h1>
    <p class="subtitle">Booty Dice</p>
  </header>

  <div class="panels">
    <div class="panel panel-join">
      <h2 class="panel-title">Join Game</h2>
      <p class="panel-desc">Got a room code? Jump right in.</p>

      <div class="fields">
        <div class="field">
          <label for="join-code">Room Code</label>
          <input
            id="join-code"
            type="text"
            bind:value={roomCode}
            placeholder="ABCD"
            maxlength="4"
            class="input input-code"
            onkeydown={handleJoinKeydown}
          />
        </div>
        <div class="field">
          <label for="join-name">Your Name</label>
          <input
            id="join-name"
            type="text"
            bind:value={joinName}
            placeholder="Enter your name"
            maxlength="20"
            class="input"
            onkeydown={handleJoinKeydown}
          />
        </div>
      </div>

      {#if error && errorSide === 'join'}
        <p class="error">{error}</p>
      {/if}

      <button
        class="btn {hasJoinCode ? 'btn-create' : 'btn-join'}"
        onclick={handleJoin}
        disabled={loading}
      >
        {loading && errorSide !== 'create' ? 'Joining...' : 'Join Game'}
      </button>
    </div>

    <div class="divider">
      <span class="divider-text">or</span>
    </div>

    <div class="panel panel-create">
      <h2 class="panel-title">Create Game</h2>
      <p class="panel-desc">Start a new room and invite friends.</p>

      <div class="fields">
        <div class="field">
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
      </div>

      {#if error && errorSide === 'create'}
        <p class="error">{error}</p>
      {/if}

      <button
        class="btn {hasJoinCode ? 'btn-join' : 'btn-create'}"
        onclick={handleCreate}
        disabled={loading}
      >
        {loading && errorSide !== 'join' ? 'Creating...' : 'Create Game'}
      </button>
    </div>
  </div>
</div>

<style>
  .lobby-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    font-family: 'DM Sans', system-ui, sans-serif;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(212, 165, 116, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 50%, rgba(180, 83, 9, 0.05) 0%, transparent 50%),
      #1a1a1a;
  }

  .brand { text-align: center; margin-bottom: 2.5rem; }

  .logo {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 3.5rem;
    font-weight: 700;
    color: #eee;
    letter-spacing: 0.08em;
    margin: 0;
    line-height: 1;
  }

  .subtitle {
    font-size: 0.95rem;
    font-weight: 500;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.25em;
    margin: 0.5rem 0 0;
  }

  .panels {
    display: flex;
    align-items: stretch;
    gap: 0;
    width: 100%;
    max-width: 720px;
    background: #2a2a2a;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .panel {
    flex: 1;
    padding: 2rem 2rem 2.25rem;
    display: flex;
    flex-direction: column;
  }

  .panel-title {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 1.5rem;
    font-weight: 600;
    color: #eee;
    margin: 0 0 0.25rem;
  }

  .panel-desc {
    font-size: 0.85rem;
    color: #888;
    margin: 0 0 1.5rem;
    line-height: 1.4;
  }

  .fields { display: flex; flex-direction: column; gap: 1rem; flex: 1; }

  .field { display: flex; flex-direction: column; gap: 0.35rem; }

  label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .input {
    width: 100%;
    padding: 0.7rem 0.85rem;
    border: 1.5px solid #444;
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: 'DM Sans', system-ui, sans-serif;
    color: #eee;
    background: #333;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input::placeholder { color: #666; }

  .input:focus {
    outline: none;
    border-color: #d97706;
    box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.1);
    background: #2a2a2a;
  }

  .input-code {
    text-transform: uppercase;
    letter-spacing: 0.35em;
    text-align: center;
    font-size: 1.25rem;
    font-weight: 600;
    padding: 0.65rem 0.85rem;
    font-family: 'Crimson Pro', Georgia, serif;
  }

  .divider {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1px;
    background: #444;
    position: relative;
    flex-shrink: 0;
  }

  .divider-text {
    position: absolute;
    background: #2a2a2a;
    color: #666;
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.75rem 0;
    text-transform: lowercase;
    letter-spacing: 0.05em;
  }

  .btn {
    margin-top: 1.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    font-family: 'DM Sans', system-ui, sans-serif;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
    width: 100%;
  }

  .btn:active:not(:disabled) { transform: scale(0.98); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-join { background: #444; color: #eee; }
  .btn-join:hover:not(:disabled) { background: #555; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); }

  .btn-create { background: #d97706; color: white; }
  .btn-create:hover:not(:disabled) { background: #b45309; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.25); }

  .error { color: #e77; font-size: 0.85rem; margin: 0.75rem 0 0; }

  @media (max-width: 600px) {
    .lobby-page { justify-content: flex-start; padding-top: 3rem; }
    .brand { margin-bottom: 2rem; }
    .logo { font-size: 2.75rem; }
    .panels { flex-direction: column; max-width: 400px; }
    .panel { padding: 1.75rem 1.5rem; }
    .divider { width: 100%; height: 1px; flex-direction: row; }
    .divider-text { padding: 0 1rem; }
  }
</style>
