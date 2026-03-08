<script lang="ts">
  import { Modal } from '@parlor/ui';

  interface Props {
    open: boolean;
    gameId: string | null;
    gameName: string;
    onclose: () => void;
    onplay: () => void;
  }

  let { open, gameId, gameName, onclose, onplay }: Props = $props();
</script>

{#if open}
<Modal open={true} {onclose} title="{gameName} — How to Play">
  <div class="rules-content">
    {#if gameId === 'quixx'}
      <section>
        <h3>Objective</h3>
        <p>Score the most points by crossing off numbers on your scoresheet.</p>
      </section>

      <section>
        <h3>The Scoresheet</h3>
        <p>Four colored rows of numbers 2-12:</p>
        <ul>
          <li><span class="color-dot red"></span> <strong>Red</strong> and <span class="color-dot yellow"></span> <strong>Yellow</strong> — ascending (2 to 12)</li>
          <li><span class="color-dot green"></span> <strong>Green</strong> and <span class="color-dot blue"></span> <strong>Blue</strong> — descending (12 to 2)</li>
        </ul>
        <p>Numbers must be crossed off <strong>left to right</strong> — you can skip numbers, but you can never go back.</p>
      </section>

      <section>
        <h3>The Dice</h3>
        <p>6 dice total: 2 white + 1 red, 1 yellow, 1 green, 1 blue.</p>
      </section>

      <section>
        <h3>Each Turn</h3>
        <ol>
          <li><strong>Phase 1 — White sum:</strong> The active player rolls all dice. <em>Every</em> player may cross off the sum of the two white dice in any row.</li>
          <li><strong>Phase 2 — Colored combo:</strong> Only the active player may add one white die + one colored die and cross off that number in the matching colored row.</li>
        </ol>
        <p class="note">If the active player doesn't cross off anything in either phase, they take a <strong>penalty</strong> (-5 points).</p>
      </section>

      <section>
        <h3>Locking a Row</h3>
        <p>To cross off the last number in a row (12 for red/yellow, 2 for green/blue), you need <strong>5 or more</strong> marks in that row. Locking a row removes its die from the game for everyone.</p>
      </section>

      <section>
        <h3>Scoring</h3>
        <p>More marks in a row = exponentially more points:</p>
        <div class="scoring-table">
          <span>1 mark = 1pt</span>
          <span>2 = 3pt</span>
          <span>3 = 6pt</span>
          <span>4 = 10pt</span>
          <span>5 = 15pt</span>
          <span>...</span>
        </div>
        <p>Each penalty costs <strong>-5 points</strong>. The game ends when a player has 4 penalties or 2 rows are locked.</p>
      </section>

    {:else if gameId === 'crazy-eights'}
      <section>
        <h3>Objective</h3>
        <p>Be the first player to get rid of all your cards.</p>
      </section>

      <section>
        <h3>Setup</h3>
        <ul>
          <li>2-4 players: <strong>7 cards</strong> each</li>
          <li>5 players: <strong>5 cards</strong> each</li>
          <li>Remaining cards form the draw pile, top card flipped to start the discard pile</li>
        </ul>
      </section>

      <section>
        <h3>Your Turn</h3>
        <ol>
          <li>Play a card that matches the top card's <strong>suit</strong> or <strong>rank</strong></li>
          <li>If you can't play, <strong>draw</strong> a card from the pile</li>
          <li>If the drawn card is playable, you may play it immediately — otherwise your turn ends</li>
        </ol>
      </section>

      <section>
        <h3>Eights are Wild</h3>
        <p>Play an <strong>8</strong> at any time, regardless of the top card. When you play an 8, you choose the suit that the next player must follow.</p>
      </section>

      <section>
        <h3>Winning</h3>
        <p>The first player to empty their hand wins. If no one can play and the draw pile is empty, the player with the <strong>fewest cards</strong> wins.</p>
      </section>

    {:else if gameId === 'booty-dice'}
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
          <div class="dice-item"><span class="dice-emoji">{'\u{1FA99}'}</span><div><strong>Doubloon</strong> — Gain 2 doubloons</div></div>
          <div class="dice-item"><span class="dice-emoji">{'\u274C'}</span><div><strong>X Marks the Spot</strong> — Lose 2 doubloons</div></div>
          <div class="dice-item"><span class="dice-emoji">{'\u2620\uFE0F'}</span><div><strong>Jolly Roger</strong> — Steal 2 doubloons from another player</div></div>
          <div class="dice-item"><span class="dice-emoji">{'\u2694\uFE0F'}</span><div><strong>Cutlass</strong> — Target loses 1 life (blocked by shields)</div></div>
          <div class="dice-item"><span class="dice-emoji">{'\u{1F30A}'}</span><div><strong>Walk the Plank</strong> — You lose 1 life</div></div>
          <div class="dice-item"><span class="dice-emoji">{'\u{1F6E1}\uFE0F'}</span><div><strong>Shield</strong> — Blocks 1 cutlass attack</div></div>
        </div>
      </section>

      <section>
        <h3>Combos</h3>
        <div class="combo-list">
          <div class="combo-item"><strong>{'\u{1F30A}'} Mutiny</strong> — 3+ planks: all enemies lose 1 life (+1 per extra plank)</div>
          <div class="combo-item"><strong>{'\u274C'} Shipwreck</strong> — 3+ X's: all enemies lose 3 doubloons (+1 per extra X)</div>
          <div class="combo-item"><strong>{'\u2620\uFE0F'} Blackbeard's Curse</strong> — All 6 different faces: all enemies lose 2 lives and 5 doubloons!</div>
        </div>
      </section>

      <section>
        <h3>Captain's Plunder</h3>
        <p>If you eliminate another pirate, you claim <strong>all their doubloons</strong>!</p>
      </section>
    {/if}
  </div>

  <div class="modal-footer">
    <button class="btn-close" onclick={onclose}>Close</button>
    <button class="btn-play" onclick={onplay}>Play Now</button>
  </div>
</Modal>
{/if}

<style>
  .rules-content {
    max-width: 28rem;
  }

  section {
    margin-bottom: 1.25rem;
  }

  section:last-child {
    margin-bottom: 0;
  }

  h3 {
    font-family: var(--font-heading);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-terracotta);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.5rem;
  }

  p {
    margin: 0 0 0.5rem;
    color: var(--color-espresso);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  p:last-child {
    margin-bottom: 0;
  }

  .note {
    font-size: 0.85rem;
    color: #78716c;
    font-style: italic;
  }

  ul, ol {
    margin: 0 0 0.5rem;
    padding-left: 1.25rem;
    color: var(--color-espresso);
    font-size: 0.9rem;
  }

  li {
    margin-bottom: 0.3rem;
    line-height: 1.4;
  }

  strong {
    color: var(--color-espresso);
    font-weight: 700;
  }

  .color-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    vertical-align: middle;
  }

  .color-dot.red { background: #ef4444; }
  .color-dot.yellow { background: #eab308; }
  .color-dot.green { background: #22c55e; }
  .color-dot.blue { background: #3b82f6; }

  .scoring-table {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #78716c;
    margin: 0.25rem 0 0.5rem;
  }

  .scoring-table span {
    background: var(--color-linen);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .dice-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dice-item {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    padding: 0.4rem 0.5rem;
    background: var(--color-linen);
    border-radius: 6px;
    font-size: 0.85rem;
    color: var(--color-espresso);
  }

  .dice-emoji {
    font-size: 1.25rem;
    line-height: 1;
  }

  .combo-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .combo-item {
    padding: 0.4rem 0.6rem;
    background: #fef2f2;
    border-left: 3px solid var(--color-terracotta);
    border-radius: 0 4px 4px 0;
    font-size: 0.85rem;
    color: var(--color-espresso);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-linen);
  }

  .btn-close, .btn-play {
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-close {
    background: var(--color-linen);
    border: none;
    color: #78716c;
  }

  .btn-close:hover {
    background: #e7e5e4;
  }

  .btn-play {
    background: var(--color-terracotta);
    border: none;
    color: white;
  }

  .btn-play:hover {
    background: #a8552f;
  }
</style>
