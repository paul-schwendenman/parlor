<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    onclick?: () => void;
    children: Snippet;
  }

  let { variant = 'primary', disabled = false, onclick, children }: Props = $props();
</script>

<button class="btn btn-{variant}" {disabled} {onclick}>
  {@render children()}
</button>

<style>
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #6366f1;
    color: white;
  }

  .btn-secondary {
    background: #e2e8f0;
    color: #1e293b;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }
</style>
