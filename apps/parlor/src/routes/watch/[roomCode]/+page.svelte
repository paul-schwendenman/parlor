<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import type { GameView } from '@parlor/game-types';
  import { createGameClient } from '@parlor/multiplayer/client';
  import { Felt } from '@parlor/ui';
  import SharedScreen from '@parlor/farkle/shared-screen';
  import ParlorMark from '$lib/components/ui/ParlorMark.svelte';
  import { qrPath } from '$lib/qr.js';

  let roomCode = $derived(page.params.roomCode?.toUpperCase() ?? '');
  let view = $state<GameView<'farkle'>>();
  let joined = $state(false);
  let reconnecting = $state(false);
  let closed = $state('');
  let fullscreenAvailable = $state(false);
  let fullscreen = $state(false);
  let origin = $state('');
  let qr = $derived(joined && !view && origin ? qrPath(`${origin}${resolve('/')}?join=${encodeURIComponent(roomCode)}`) : null);

  onMount(() => {
    origin = window.location.origin;
    fullscreenAvailable = document.fullscreenEnabled;
    const socket = createGameClient();
    socket.on('connect', () => {
      socket.timeout(5000).emit('lobby:spectate', roomCode, (error, success, message) => {
        if (error || !success) {
          closed = message ?? 'Could not connect to this room.';
          view = undefined;
          joined = false;
        } else {
          closed = '';
          joined = true;
          view = undefined;
        }
        reconnecting = false;
      });
    });
    socket.on('connect_error', () => { reconnecting = true; });
    socket.on('disconnect', () => { reconnecting = true; });
    socket.on('lobby:returned', () => { view = undefined; });
    socket.on('game:state', (state) => {
      view = state.gameId === 'farkle' ? state.view : undefined;
    });
    socket.on('room:closed', () => {
      closed = 'This room has closed.';
      view = undefined;
      joined = false;
    });
    function syncFullscreen() { fullscreen = !!document.fullscreenElement; }
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      socket.removeAllListeners();
      socket.disconnect();
    };
  });

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }
</script>

<svelte:head><title>Farkle shared screen · Parlor</title></svelte:head>

<header class="lid">
  <div class="lid-inner">
    <span class="wordmark"><ParlorMark /> PARLOR</span>
    <h1>Farkle</h1>
    <div class="display-actions">
      <span class="code" aria-label={`Room code ${roomCode}`}>{roomCode}</span>
      {#if fullscreenAvailable}
        <button type="button" onclick={() => toggleFullscreen().catch(() => {})}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
      {/if}
    </div>
  </div>
</header>

<div class="display">
  {#if reconnecting}<p class="connection" role="status">Reconnecting to the room…</p>{/if}
  {#if view}
    <SharedScreen {view} />
  {:else}
    <Felt label="Shared screen lobby">
      <div class="waiting">
        <h2>{closed || (joined ? 'Waiting for Farkle' : 'Connecting to the room…')}</h2>
        {#if closed}
          <a href={resolve('/')}>Back to Parlor</a>
        {:else if joined && qr}
          <svg class="qr" role="img" aria-label={`Scan to join room ${roomCode}`} viewBox="0 0 {qr.size} {qr.size}" shape-rendering="crispEdges">
            <rect width={qr.size} height={qr.size} fill="white" />
            <path d={qr.path} fill="currentColor" />
          </svg>
          <p>Scan to join on your phone. The table goes live when the host starts Farkle.</p>
        {/if}
      </div>
    </Felt>
  {/if}
</div>

<style>
  .lid { background: var(--color-terracotta); border-bottom: 3px solid var(--color-espresso); }
  .lid-inner, .display { box-sizing: border-box; width: min(100%, 1640px); margin-inline: auto; padding: clamp(12px, 2vw, 30px); }
  .lid-inner, .display-actions, .wordmark { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; }
  .wordmark, h1 { color: var(--color-cream); font: 900 clamp(1.5rem, 2.6vw, 2.8rem)/1 var(--font-heading); }
  h1 { margin: 0; }
  .display-actions { margin-left: auto; }
  .code, button { padding: .4rem .75rem; border: 2px solid var(--color-espresso); font: 900 1rem var(--font-heading); }
  .code { background: var(--color-mustard); border-radius: 8px; letter-spacing: .12em; }
  button { border-radius: 999px; background: var(--color-cream); color: var(--color-espresso); cursor: pointer; min-height: 44px; }
  .waiting { display: grid; justify-items: center; align-content: center; width: 100%; min-height: min(55vh, 510px); gap: 16px; text-align: center; }
  .waiting h2 { font: 900 clamp(2rem, 4vw, 4rem)/1 var(--font-heading); }
  .waiting h2, .waiting p { margin: 0; }
  .waiting a { color: inherit; }
  .qr { display: block; width: clamp(140px, 19vw, 270px); color: var(--color-espresso); border-radius: 10px; border: 2px solid currentColor; }
  .connection { margin: 0 0 12px; font-weight: 800; }
</style>
