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
  <div class="toast toast-{type}" role="alert">
    {message}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 500;
    z-index: 100;
    animation: slide-up 0.2s ease-out;
  }

  .toast-info {
    background: #1e293b;
    color: white;
  }

  .toast-success {
    background: #22c55e;
    color: white;
  }

  .toast-error {
    background: #ef4444;
    color: white;
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
</style>
