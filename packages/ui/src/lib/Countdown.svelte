<script lang="ts">
  import { onMount } from 'svelte';

  let { deadline }: { deadline: number } = $props();
  let now = $state<number>();
  let seconds = $derived(now === undefined ? '–' : Math.max(0, Math.ceil((deadline - now) / 1000)));

  onMount(() => {
    const tick = () => now = Date.now();
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  });
</script>

<span role="timer" aria-label="Seconds remaining">{seconds} s</span>
