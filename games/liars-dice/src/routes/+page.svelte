<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import JoinForm from '$lib/components/lobby/JoinForm.svelte';
  import { getSocket } from '$lib/stores/socketClient.js';

  let prefillCode = $derived($page.url.searchParams.get('join') ?? '');

  onMount(() => {
    if (browser) {
      getSocket();
    }
  });

  function handleGameReady(roomCode: string) {
    goto(`/lobby/${roomCode}`);
  }
</script>

<svelte:head><title>Parlor - Liar's Dice</title></svelte:head>

<JoinForm ongameready={handleGameReady} {prefillCode} />
