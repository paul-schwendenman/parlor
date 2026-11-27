<script lang="ts">
  import { Modal } from '@parlor/ui';
  import FaceIcon from '@parlor/booty-dice/face-icon';

  interface Props {
    open: boolean;
    gameId: string | null;
    gameName: string;
    onclose: () => void;
    /** Omitted mid-game, where there is nothing to start. */
    onplay?: () => void;
    playLabel?: string;
  }

  let { open, gameId, gameName, onclose, onplay, playLabel = 'Play Now' }: Props = $props();
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
        <p>Each row scores by how many boxes you crossed in it. The lock counts as one more cross.</p>
        {#each [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]] as range, half (half)}
          <div class="score-scale" role="table" aria-label="Points for {range[0]} to {range[5]} crosses in one row">
            <div class="scale-row" role="row">
              <span class="scale-head" role="rowheader">Crosses</span>
              {#each range as n (n)}<span class="scale-n" role="cell">{n}</span>{/each}
            </div>
            <div class="scale-row" role="row">
              <span class="scale-head" role="rowheader">Points</span>
              {#each range as n (n)}<span class="scale-pts" role="cell">{(n * (n + 1)) / 2}</span>{/each}
            </div>
          </div>
        {/each}
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

    {:else if gameId === 'kings-corner'}
      <section>
        <h3>Objective</h3>
        <p>Be the first player to get rid of all your cards.</p>
      </section>

      <section>
        <h3>The Table</h3>
        <p>Everyone gets <strong>7 cards</strong>. Four cards are dealt face up to the north, south, east and west piles around the draw pile. The four <strong>corners</strong> start empty.</p>
      </section>

      <section>
        <h3>Your Turn</h3>
        <ol>
          <li><strong>Draw</strong> a card from the draw pile</li>
          <li>Play as many cards as you like, then <strong>end your turn</strong></li>
        </ol>
      </section>

      <section>
        <h3>Playing Cards</h3>
        <ul>
          <li>A card goes on a pile if it is <strong>one rank lower</strong> and the <strong>opposite colour</strong>: a red 9 on a black 10</li>
          <li>Only a <strong>King</strong> can start an empty corner</li>
          <li>Any card can fill an empty north, south, east or west pile</li>
          <li>You can move a <strong>whole pile</strong> onto another if its first card fits there</li>
          <li>If you hold a King and a corner is empty, you must play it before ending your turn</li>
        </ul>
      </section>

      <section>
        <h3>Winning</h3>
        <p>The first player to empty their hand wins. If the draw pile runs out and everyone passes, the <strong>lowest penalty</strong> wins: Kings in hand count 10 points, every other card 1.</p>
      </section>

    {:else if gameId === 'spades'}
      <section>
        <h3>Bidding</h3>
        <p>Partners sit across from each other. Starting left of the dealer, bid how many of the 13 tricks you expect to take. Add both partners’ bids to get your team’s contract.</p>
      </section>
      <section>
        <h3>Trump and Tricks</h3>
        <p>Follow the led suit if you can. The highest spade wins the trick, or the highest card of the led suit if nobody played a spade. The winner leads next.</p>
        <p>You can lead with spades after one has been played or if your hand contains only spades.</p>
      </section>
      <section>
        <h3>Scoring and Nil</h3>
        <p>Make your contract to score 10 points per bid trick. Each extra trick scores one point and adds a bag. Ten bags cost 100 points. Miss your contract and lose 10 points per bid trick.</p>
        <p>A nil bid earns 100 points for taking zero tricks and loses 100 if you take any. Tricks taken by a nil bidder do not count toward their team’s contract.</p>
        <p>The higher-scoring team wins once either team reaches 500. A tie goes to another round.</p>
      </section>

    {:else if gameId === 'hearts'}
      <section>
        <h3>Passing</h3>
        <p>Each player gets 13 cards. Pass three cards left in the first round, right in the second, and across in the third. Keep your hand in the fourth round, then repeat.</p>
      </section>
      <section>
        <h3>Taking Tricks</h3>
        <p>The 2 of clubs opens the round. Play the same suit if you can. The highest card of that suit wins, and its player leads the next trick. Aces are high.</p>
        <p>Avoid playing penalty cards on the first trick. If you have only penalty cards and cannot follow suit, play a heart. You may lead hearts once a heart has been played, or if your hand contains only hearts.</p>
      </section>
      <section>
        <h3>Scoring</h3>
        <p>Each heart you take costs one point. The queen of spades costs 13. Take all 26 points to shoot the moon and give 26 to everyone else.</p>
        <p>When anyone reaches 100 points, the lowest total wins. Tied players share the win.</p>
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
          <div class="dice-item"><span class="dice-icon"><FaceIcon face="doubloon" size={20} /></span><div><strong>Doubloon</strong> — Gain 2 doubloons</div></div>
          <div class="dice-item"><span class="dice-icon"><FaceIcon face="x_marks_spot" size={20} /></span><div><strong>X Marks the Spot</strong> — Lose 2 doubloons</div></div>
          <div class="dice-item"><span class="dice-icon"><FaceIcon face="jolly_roger" size={20} /></span><div><strong>Jolly Roger</strong> — Steal 2 doubloons from another player</div></div>
          <div class="dice-item"><span class="dice-icon"><FaceIcon face="cutlass" size={20} /></span><div><strong>Cutlass</strong> — Target loses 1 life (blocked by shields)</div></div>
          <div class="dice-item"><span class="dice-icon"><FaceIcon face="walk_plank" size={20} /></span><div><strong>Walk the Plank</strong> — You lose 1 life</div></div>
          <div class="dice-item"><span class="dice-icon"><FaceIcon face="shield" size={20} /></span><div><strong>Shield</strong> — Blocks 1 cutlass attack</div></div>
        </div>
      </section>

      <section>
        <h3>Combos</h3>
        <div class="combo-list">
          <div class="combo-item"><strong>Mutiny</strong> — 3+ planks: all enemies lose 1 life (+1 per extra plank)</div>
          <div class="combo-item"><strong>Shipwreck</strong> — 3+ X's: all enemies lose 3 doubloons (+1 per extra X)</div>
          <div class="combo-item"><strong>Blackbeard's Curse</strong> — All 6 different faces: all enemies lose 2 lives and 5 doubloons!</div>
        </div>
      </section>

      <section>
        <h3>Captain's Plunder</h3>
        <p>If you eliminate another pirate, you claim <strong>all their doubloons</strong>!</p>
      </section>
    {:else if gameId === 'liars-dice'}
      <section>
        <h3>Objective</h3>
        <p>Be the <strong>last player with dice remaining</strong>.</p>
      </section>

      <section>
        <h3>Setup</h3>
        <ul>
          <li>2-6 players, 5 dice each</li>
          <li>Everyone rolls at the start of each round. Only you can see your dice.</li>
        </ul>
      </section>

      <section>
        <h3>Bidding</h3>
        <p>On your turn, bid how many dice of one face are on the <strong>whole table</strong>, counting everyone's dice. Each bid must beat the last one:</p>
        <ul>
          <li>Raise the count: "three 4s" to "four 4s"</li>
          <li>Or keep the count and raise the face: "three 4s" to "three 5s"</li>
        </ul>
      </section>

      <section>
        <h3>Wild Ones</h3>
        <p><strong>1s count as every face.</strong> If someone bids "four 3s", every 1 and every 3 counts.</p>
        <ul>
          <li>Switching to a bid on 1s: the count can drop to half (rounded up)</li>
          <li>Switching back from 1s: the count must be double plus one</li>
        </ul>
      </section>

      <section>
        <h3>Liar!</h3>
        <p>Instead of bidding, call the last bidder a liar. Everyone shows their dice:</p>
        <ul>
          <li>If the bid was right, <strong>you</strong> lose a die</li>
          <li>If the bid was wrong, the <strong>bidder</strong> loses a die</li>
        </ul>
      </section>

      <section>
        <h3>Spot On</h3>
        <p>Think the bid is exactly right? Call Spot on:</p>
        <ul>
          <li>If it's exact, <strong>everyone else</strong> loses a die</li>
          <li>If it isn't, <strong>you</strong> lose a die</li>
        </ul>
      </section>

      <section>
        <h3>Out</h3>
        <p>Lose your last die and you're out. The loser of each call starts the next round.</p>
      </section>
    {/if}
  </div>

  <div class="modal-footer">
    <button class="btn-close" onclick={onclose}>Close</button>
    {#if onplay}<button class="btn-play" onclick={onplay}>{playLabel}</button>{/if}
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
    font-size: 1.0625rem;
    font-weight: 900;
    color: var(--color-espresso);
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
    color: var(--color-ink-muted);
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

  .color-dot.red { background: #B8372B; }
  .color-dot.yellow { background: #D4A843; }
  .color-dot.green { background: #3F7350; }
  .color-dot.blue { background: #2F5C8A; }

  /* Crosses over points, in two blocks of six so every number stays
     readable at phone width. */
  .score-scale {
    margin: 0.5rem 0;
    border: 2px solid var(--color-espresso);
    border-radius: 12px;
    overflow: hidden;
    background: var(--color-paper);
  }

  .score-scale + .score-scale {
    margin-bottom: 0.75rem;
  }

  .scale-row {
    display: grid;
    grid-template-columns: 4.75rem repeat(6, minmax(0, 1fr));
  }

  .scale-row + .scale-row {
    border-top: 2px solid var(--color-espresso);
  }

  .scale-head,
  .scale-n,
  .scale-pts {
    padding: 0.4rem 0.25rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .scale-head {
    padding-left: 0.6rem;
    text-align: left;
    background: var(--color-linen);
    border-right: 2px solid var(--color-espresso);
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .scale-n {
    font-weight: 600;
    color: var(--color-ink-muted);
  }

  .scale-pts {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.0625rem;
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

  /* Booty Dice faces as printed on the dice: cream on Deep Clay. */
  .dice-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    box-sizing: border-box;
    border: 2px solid var(--color-espresso);
    border-radius: 8px;
    background: var(--color-terracotta-deep);
    color: var(--color-cream);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .combo-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .combo-item {
    padding: 0.4rem 0.6rem;
    background: var(--color-mustard-tint);
    border: 1.5px solid var(--color-espresso);
    border-radius: 8px;
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
    height: 46px;
    padding: 0 20px;
    border-radius: 999px;
    font-size: 0.9375rem;
    font-weight: 700;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-close {
    background: transparent;
    border: 2px solid var(--color-espresso);
    color: var(--color-espresso);
  }

  .btn-close:hover {
    background: rgba(59, 47, 47, 0.06);
  }

  .btn-play {
    background: var(--color-terracotta-deep);
    border: 2px solid var(--color-terracotta-deep);
    color: var(--color-cream);
  }

  .btn-play:hover {
    background: var(--color-terracotta-press);
    border-color: var(--color-terracotta-press);
  }
</style>
