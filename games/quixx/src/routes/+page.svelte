<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import JoinForm from '$lib/components/lobby/JoinForm.svelte';
  import { getSocket } from '$lib/stores/socketClient.js';

  onMount(() => {
    if (browser) {
      getSocket();
    }
  });

  function handleGameReady(roomCode: string) {
    goto(`/lobby/${roomCode}`);
  }
</script>

<JoinForm ongameready={handleGameReady} />
