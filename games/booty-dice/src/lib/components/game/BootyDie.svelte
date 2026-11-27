<script lang="ts">
  /**
   * A Booty Dice die: printed in Deep Clay (the game's shelf colour) with a
   * drawn cream face. A kept die is butter, like anything picked up in Parlor.
   * Before the first roll the dice sit blank.
   */
  import type { Die } from '../../types/game.js';
  import { FACE_NAMES } from '../../types/game.js';
  import FaceIcon from './FaceIcon.svelte';

  let {
    die,
    blank = false,
    selectable = false,
    current = false,
    onclick,
  }: {
    die: Die;
    blank?: boolean;
    selectable?: boolean;
    /** The die whose target is being picked right now. */
    current?: boolean;
    onclick?: () => void;
  } = $props();

  let label = $derived(
    blank ? 'Die, not rolled yet' : `${FACE_NAMES[die.face]}${die.locked ? ', kept' : ''}`,
  );
</script>

<button
  type="button"
  class="die"
  class:kept={die.locked && !blank}
  class:selectable
  class:current
  disabled={!selectable}
  aria-label={label}
  aria-pressed={selectable ? die.locked : undefined}
  {onclick}
>
  {#if !blank}<FaceIcon face={die.face} size="62%" />{/if}
</button>

<style>
  .die {
    --s: var(--die-size, 56px);
    width: var(--s);
    height: var(--s);
    box-sizing: border-box;
    padding: 0;
    border: 2px solid var(--color-espresso);
    border-radius: calc(var(--s) * 0.24);
    background: var(--color-terracotta-deep);
    color: var(--color-cream);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), background 0.18s ease;
  }

  .die.selectable {
    cursor: pointer;
  }

  @media (hover: hover) {
    .die.selectable:hover {
      transform: translateY(-3px);
    }
  }

  .die.selectable:active {
    transform: scale(0.96);
  }

  .die.kept {
    background: var(--color-mustard-tint);
    color: var(--color-espresso);
    border-width: 3px;
    transform: translateY(-4px);
  }

  /* Mustard ring: this die is the one you're aiming. */
  .die.current {
    outline: 3px solid var(--color-mustard);
    outline-offset: 3px;
  }

  .die:focus-visible {
    outline: 3px solid var(--color-cream);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .die {
      transition: none;
    }
  }
</style>
