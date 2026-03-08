<script lang="ts">
  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="drawer-backdrop" onclick={handleBackdropClick} role="presentation">
    <aside class="drawer">
      <header class="drawer-header">
        <h2>Game Rules</h2>
        <button class="close-btn" onclick={onclose} aria-label="Close rules">
          &times;
        </button>
      </header>

      <div class="drawer-content">
        <section>
          <h3>Objective</h3>
          <p>Be the first to collect <strong>25 doubloons</strong> or be the <strong>last pirate standing</strong>!</p>
        </section>

        <section>
          <h3>Setup</h3>
          <ul>
            <li>2-6 players</li>
            <li>Each pirate starts with 5 doubloons and 10 lives</li>
          </ul>
        </section>

        <section>
          <h3>Your Turn</h3>
          <ol>
            <li>Roll 6 dice (up to 3 rolls per turn)</li>
            <li>Lock dice you want to keep between rolls</li>
            <li>Resolve your dice effects</li>
            <li>Select targets for attacks and steals</li>
          </ol>
        </section>

        <section>
          <h3>Dice Faces</h3>
          <div class="dice-list">
            <div class="dice-item">
              <span class="dice-emoji">{'\u{1FA99}'}</span>
              <div>
                <strong>Doubloon</strong>
                <p>Gain 2 doubloons</p>
              </div>
            </div>
            <div class="dice-item">
              <span class="dice-emoji">{'\u274C'}</span>
              <div>
                <strong>X Marks the Spot</strong>
                <p>Lose 2 doubloons</p>
              </div>
            </div>
            <div class="dice-item">
              <span class="dice-emoji">{'\u2620\uFE0F'}</span>
              <div>
                <strong>Jolly Roger</strong>
                <p>Steal 2 doubloons from another player</p>
              </div>
            </div>
            <div class="dice-item">
              <span class="dice-emoji">{'\u2694\uFE0F'}</span>
              <div>
                <strong>Cutlass</strong>
                <p>Attack! Target loses 1 life (blocked by shields)</p>
              </div>
            </div>
            <div class="dice-item">
              <span class="dice-emoji">{'\u{1F30A}'}</span>
              <div>
                <strong>Walk the Plank</strong>
                <p>You lose 1 life</p>
              </div>
            </div>
            <div class="dice-item">
              <span class="dice-emoji">{'\u{1F6E1}\uFE0F'}</span>
              <div>
                <strong>Shield</strong>
                <p>Gain 1 shield (blocks cutlass attacks)</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3>Combos</h3>
          <div class="combo-list">
            <div class="combo-item">
              <strong>{'\u{1F30A}'} Mutiny</strong>
              <p>3+ Walk the Planks - All enemies lose 1 life (+1 per extra plank)</p>
            </div>
            <div class="combo-item">
              <strong>{'\u274C'} Shipwreck</strong>
              <p>3+ X Marks the Spot - All enemies lose 3 doubloons (+1 per extra X)</p>
            </div>
            <div class="combo-item">
              <strong>{'\u2620\uFE0F'} Blackbeard's Curse</strong>
              <p>All 6 different faces - All enemies lose 2 lives and 5 doubloons!</p>
            </div>
          </div>
        </section>

        <section>
          <h3>Captain's Plunder</h3>
          <p>If you eliminate another pirate, you claim <strong>all their doubloons</strong>!</p>
        </section>
      </div>
    </aside>
  </div>
{/if}

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 200;
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 360px;
    max-width: 90vw;
    background: #1e1e1e;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
    overflow-y: auto;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: #2a2a2a;
    border-bottom: 1px solid #333;
    position: sticky;
    top: 0;
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #d4a574;
  }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 1.75rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-btn:hover { color: #eee; }

  .drawer-content { padding: 1.25rem; }

  section { margin-bottom: 1.5rem; }
  section:last-child { margin-bottom: 0; }

  h3 {
    font-size: 1rem;
    color: #d4a574;
    margin: 0 0 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  p { margin: 0; color: #ccc; line-height: 1.5; }
  ul, ol { margin: 0; padding-left: 1.25rem; color: #ccc; }
  li { margin-bottom: 0.25rem; line-height: 1.4; }
  strong { color: #eee; }

  .dice-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .dice-item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.5rem;
    background: #252525;
    border-radius: 6px;
  }

  .dice-emoji { font-size: 1.5rem; line-height: 1; }
  .dice-item p { font-size: 0.875rem; color: #999; margin-top: 0.125rem; }

  .combo-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .combo-item {
    padding: 0.5rem 0.75rem;
    background: #2a1a1a;
    border-left: 3px solid #c44;
    border-radius: 0 4px 4px 0;
  }

  .combo-item p { font-size: 0.875rem; color: #999; margin-top: 0.25rem; }
</style>
