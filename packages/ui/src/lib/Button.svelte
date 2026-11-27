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

<button type="button" class="btn btn-{variant}" {disabled} {onclick}>
  {@render children()}
</button>

<style>
  /* DESIGN.md: every button is an ink-outlined pill. Tokens fall back for standalone games. */
  .btn {
    min-height: 46px;
    padding: 0 20px;
    border: 2px solid var(--color-espresso, #3B2F2F);
    border-radius: 999px;
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn:disabled {
    background: var(--color-linen, #F5EDE0);
    border-style: dashed;
    color: var(--color-ink-muted, #71625A);
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--color-espresso, #3B2F2F);
    color: var(--color-cream, #FDF6EC);
  }

  .btn-primary:hover:not(:disabled) {
    background: #2E2727;
  }

  .btn-secondary {
    background: transparent;
    color: var(--color-espresso, #3B2F2F);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(59, 47, 47, 0.06);
  }

  .btn-danger {
    background: var(--color-danger, #991B1B);
    border-color: var(--color-danger, #991B1B);
    color: var(--color-cream, #FDF6EC);
  }

  .btn-danger:hover:not(:disabled) {
    background: #771D1A;
    border-color: #771D1A;
  }
</style>
