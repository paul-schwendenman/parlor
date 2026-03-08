<script lang="ts">
  import type { Die } from '$lib/types/game.js';
  import { FACE_EMOJI, FACE_NAMES } from '$lib/types/game.js';

  interface Props {
    die: Die;
    selectable?: boolean;
    onclick?: () => void;
  }

  let { die, selectable = false, onclick }: Props = $props();
</script>

<button
  class="die"
  class:locked={die.locked}
  class:rolling={die.rolling}
  class:selectable
  disabled={!selectable}
  aria-label="{FACE_NAMES[die.face]} die{die.locked ? ', locked' : ''}"
  aria-pressed={die.locked}
  title={FACE_NAMES[die.face]}
  {onclick}
>
  <span class="face" aria-hidden="true">{FACE_EMOJI[die.face]}</span>
  {#if die.locked}
    <span class="lock-indicator" aria-hidden="true">🔒</span>
  {/if}
</button>

<style>
  .die {
    width: 70px;
    height: 70px;
    border-radius: 10px;
    background: #2a2a2a;
    border: 3px solid #444;
    font-size: 2.2rem;
    cursor: default;
    position: relative;
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .die.selectable {
    cursor: pointer;
  }

  .die.selectable:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }

  .die.locked {
    border-color: #d4a574;
    background: #3d2a1a;
    box-shadow: 0 0 12px rgba(212, 165, 116, 0.5);
  }

  .die.rolling {
    animation: roll 0.4s ease-in-out;
  }

  .lock-indicator {
    position: absolute;
    top: -10px;
    right: -10px;
    font-size: 1rem;
    background: #d4a574;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @keyframes roll {
    0%,
    100% {
      transform: rotate(0deg) scale(1);
    }
    25% {
      transform: rotate(20deg) scale(1.1);
    }
    50% {
      transform: rotate(-15deg) scale(1.05);
    }
    75% {
      transform: rotate(10deg) scale(1.08);
    }
  }
</style>
