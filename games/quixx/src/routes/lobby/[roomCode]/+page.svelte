<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import LobbyView from '$lib/components/lobby/LobbyView.svelte';
  import { lobbyState } from '$lib/stores/lobbyStore.svelte.js';
  import { gameState } from '$lib/stores/gameStore.svelte.js';
  import { getSocket } from '$lib/stores/socketClient.js';

  let roomCode = $derived($page.params.roomCode ?? '');

  onMount(() => {
    if (browser) {
      getSocket();
    }
  });

  $effect(() => {
    if (lobbyState.gameStarting || gameState.view) {
      goto(`/game/${roomCode}`);
    }
  });
</script>

<LobbyView {roomCode} />
