<script lang="ts">
  interface Props {
    message: string;
    type?: 'info' | 'success' | 'error';
    visible?: boolean;
    duration?: number;
  }

  let { message, type = 'info', visible = $bindable(false), duration = 3000 }: Props = $props();

  $effect(() => {
    if (visible && duration > 0) {
      const timeout = setTimeout(() => {
        visible = false;
      }, duration);
      return () => clearTimeout(timeout);
    }
  });
</script>

{#if visible}
  <!-- Errors interrupt; info and success are announced politely. -->
  <div class="toast toast-{type}" role={type === 'error' ? 'alert' : 'status'}>
    {message}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100vw - 32px);
    box-sizing: border-box;
    padding: 12px 20px;
    border: 2px solid var(--color-espresso, #3B2F2F);
    border-radius: 999px;
    font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-cream, #FDF6EC);
    box-shadow: 0 10px 24px rgba(59, 47, 47, 0.16);
    z-index: 100;
    animation: slide-up 0.2s ease-out;
  }

  .toast-info {
    background: var(--color-espresso, #3B2F2F);
  }

  .toast-success {
    background: var(--color-forest-deep, #2F5A3E);
  }

  .toast-error {
    background: var(--color-danger, #991B1B);
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(1rem);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
