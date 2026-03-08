<script lang="ts">
  import '../app.css';
  import ConnectionStatus from '$lib/components/ui/ConnectionStatus.svelte';

  let { children } = $props();
</script>

<ConnectionStatus />

<main>
  {@render children()}
</main>

<style>
  main {
    min-height: 100vh;
    background: var(--color-cream);
  }
</style>
