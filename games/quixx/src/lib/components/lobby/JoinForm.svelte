<script lang="ts">
  import { createRoomAction, joinRoomAction } from '../../stores/socketClient.js';

  let { ongameready }: { ongameready: (roomCode: string) => void } = $props();

  let playerName = $state('');
  let roomCode = $state('');
  let error = $state('');
  let mode = $state<'choose' | 'create' | 'join'>('choose');
  let loading = $state(false);

  async function handleCreate() {
    if (!playerName.trim()) return;
    loading = true;
    error = '';
    try {
      const code = await createRoomAction(playerName.trim());
      ongameready(code);
    } catch {
      error = 'Failed to create room';
    } finally {
      loading = false;
    }
  }

  async function handleJoin() {
    if (!playerName.trim() || !roomCode.trim()) return;
    loading = true;
    error = '';
    try {
      const result = await joinRoomAction(roomCode.trim(), playerName.trim());
      if (result.success) {
        ongameready(roomCode.trim().toUpperCase());
      } else {
        error = result.error ?? 'Failed to join room';
      }
    } catch {
      error = 'Failed to join room';
    } finally {
      loading = false;
    }
  }
</script>

<div class="join-form">
  <h1>Quixx</h1>

  {#if mode === 'choose'}
    <div class="name-input">
      <label for="name">Your Name</label>
      <input id="name" type="text" bind:value={playerName} placeholder="Enter your name" maxlength="20" />
    </div>
    <div class="buttons">
      <button onclick={() => { mode = 'create'; }} disabled={!playerName.trim()}>Create Game</button>
      <button onclick={() => { mode = 'join'; }} disabled={!playerName.trim()}>Join Game</button>
    </div>
  {:else if mode === 'create'}
    <p>Creating as <strong>{playerName}</strong></p>
    <button onclick={handleCreate} disabled={loading}>
      {loading ? 'Creating...' : 'Create Room'}
    </button>
    <button class="back" onclick={() => { mode = 'choose'; }}>Back</button>
  {:else}
    <p>Joining as <strong>{playerName}</strong></p>
    <div class="code-input">
      <label for="code">Room Code</label>
      <input id="code" type="text" bind:value={roomCode} placeholder="ABCD" maxlength="4"
        style="text-transform: uppercase; letter-spacing: 4px; font-size: 24px; text-align: center;" />
    </div>
    <button onclick={handleJoin} disabled={loading || !roomCode.trim()}>
      {loading ? 'Joining...' : 'Join Room'}
    </button>
    <button class="back" onclick={() => { mode = 'choose'; }}>Back</button>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .join-form {
    max-width: 400px;
    margin: 0 auto;
    padding: 32px 16px;
    text-align: center;
  }
  h1 {
    font-size: 48px;
    font-weight: 700;
    margin-bottom: 32px;
    letter-spacing: 8px;
  }
  .name-input, .code-input {
    margin-bottom: 16px;
  }
  label {
    display: block;
    margin-bottom: 4px;
    font-size: 14px;
    color: #666;
  }
  input {
    width: 100%;
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 16px;
    box-sizing: border-box;
  }
  input:focus {
    border-color: #3b82f6;
    outline: none;
  }
  .buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
  }
  button {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    background: #3b82f6;
    color: white;
    min-width: 120px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:hover:not(:disabled) {
    background: #2563eb;
  }
  button.back {
    background: #e5e7eb;
    color: #374151;
  }
  button.back:hover {
    background: #d1d5db;
  }
  .error {
    color: #ef4444;
    margin-top: 12px;
  }
</style>
