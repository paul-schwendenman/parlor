<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import ConnectionStatus from '$lib/components/ui/ConnectionStatus.svelte';
  import RoomToast from '$lib/components/ui/RoomToast.svelte';

  let { children } = $props();
</script>

{#if page.route.id !== '/watch/[roomCode]'}
  <ConnectionStatus />
  <RoomToast />
{/if}

<main>
  {@render children()}
</main>

<style>
  main {
    min-height: 100vh;
    background: var(--color-cream);
  }
</style>
