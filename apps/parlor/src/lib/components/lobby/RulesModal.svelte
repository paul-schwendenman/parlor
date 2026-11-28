<script lang="ts">
  import { Modal } from '@parlor/ui';
  import FaceIcon from '@parlor/booty-dice/face-icon';
  import { findGame, playerCount } from '$lib/games/catalog.js';

  interface Props {
    open: boolean;
    gameId: string | null;
    gameName: string;
    onclose: () => void;
    /** Omitted mid-game, where there is nothing to start. Labelled "Play <game>". */
    onplay?: () => void;
    /** The lobby ballot: a toggle that reads "Vote", or "Your vote" when pressed. */
    onvote?: () => void;
    voted?: boolean;
  }

  let { open, gameId, gameName, onclose, onplay, onvote, voted = false }: Props = $props();

  let game = $derived(findGame(gameId));
  /** "4 players · bots can fill seats", "2–5 players · no bots". */
  let fitLine = $derived(game ? `${playerCount(game)} · ${game.supportsBots ? 'bots can fill seats' : 'no bots'}` : '');
</script>

{#if open}
<Modal open={true} {onclose} title="How to play {gameName}">
  {#if fitLine}<p class="fit">{fitLine}</p>{/if}
  <div class="rules-content">
    {#if gameId === 'quixx'}
      <section>
        <h3>Objective</h3>
        <p>Score the most points by crossing off numbers on your scoresheet.</p>
      </section>

      <section>
        <h3>The scoresheet</h3>
        <p>Four colored rows of numbers 2-12:</p>
        <ul>
          <li><span class="color-dot red"></span> <strong>Red</strong> and <span class="color-dot yellow"></span> <strong>Yellow</strong> — ascending (2 to 12)</li>
          <li><span class="color-dot green"></span> <strong>Green</strong> and <span class="color-dot blue"></span> <strong>Blue</strong> — descending (12 to 2)</li>
        </ul>
        <p>Numbers must be crossed off <strong>left to right</strong> — you can skip numbers, but you can never go back.</p>
      </section>

      <section>
        <h3>The dice</h3>
        <p>6 dice total: 2 white + 1 red, 1 yellow, 1 green, 1 blue.</p>
      </section>

      <section>
        <h3>Each turn</h3>
        <ol>
          <li><strong>Phase 1 — White sum:</strong> The active player rolls all dice. <em>Every</em> player may cross off the sum of the two white dice in any row.</li>
          <li><strong>Phase 2 — Colored combo:</strong> Only the active player may add one white die + one colored die and cross off that number in the matching colored row.</li>
        </ol>
        <p class="note">If the active player doesn't cross off anything in either phase, they take a <strong>penalty</strong> (-5 points).</p>
      </section>

      <section>
        <h3>Locking a row</h3>
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
        <h3>Your turn</h3>
        <ol>
          <li>Play a card that matches the top card's <strong>suit</strong> or <strong>rank</strong></li>
          <li>If you can't play, <strong>draw</strong> a card from the pile</li>
          <li>If the drawn card is playable, you may play it immediately — otherwise your turn ends</li>
        </ol>
      </section>

      <section>
        <h3>Eights are wild</h3>
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
        <h3>The table</h3>
        <p>Everyone gets <strong>7 cards</strong>. Four cards are dealt face up to the north, south, east and west piles around the draw pile. The four <strong>corners</strong> start empty.</p>
      </section>

      <section>
        <h3>Your turn</h3>
        <ol>
          <li><strong>Draw</strong> a card from the draw pile</li>
          <li>Play as many cards as you like, then <strong>end your turn</strong></li>
        </ol>
      </section>

      <section>
        <h3>Playing cards</h3>
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

    {:else if gameId === 'fault-line'}
      <section>
        <h3>Plant a hidden cache</h3>
        <p>Each player starts with two faults, two silver caches, and two gold caches. Plant one each round and offer up to two of your four bounty chips. The offer is public once all caches are planted.</p>
      </section>
      <section>
        <h3>Open a rival cache or pass</h3>
        <p>Silver pays one point and gold pays two, plus the posted bounty. A fault costs the opener one point. Owners earn two points per opener on a fault and one per opener on a safe cache. An unopened cache scores its printed value for its owner.</p>
        <p>Reveal everyone's choices together. After six rounds the highest score wins. Ties share the win.</p>
      </section>
    {:else if gameId === 'signal-relay'}
      <section>
        <h3>Send signals together</h3>
        <p>Send a signal to either antenna if the channel matches or the strength differs by exactly one. The new signal becomes the antenna's signal. Everyone can act at once.</p>
      </section>
      <section>
        <h3>Beat the clock</h3>
        <p>Each relay lasts 55 seconds. Once per relay, your team can reroute a signal to either antenna regardless of its channel or strength.</p>
        <p>Clear every player's signals in four relays to win together. If time runs out, the team loses.</p>
      </section>
    {:else if gameId === 'night-market'}
      <section>
        <h3>Draft, then pass</h3>
        <p>Everyone chooses a good in secret and decides whether to sell it or display it. Once all picks are locked, reveal them and pass the remaining goods. Each season has four picks. The last good is discarded.</p>
      </section>
      <section>
        <h3>Collect coins and build your stall</h3>
        <p>Sell a good for its coin value, or display it for one point. Each lantern and silk pair and each tea and pottery pair earns five extra points. A spice earns one extra point for each distinct other kind you display.</p>
        <p>Score and reset the stalls after each season. The highest total after three seasons wins.</p>
      </section>
    {:else if gameId === 'ridge-run'}
      <section>
        <h3>Climb a route</h3>
        <p>Roll three dice. Choose one route that matches the sum of any two dice. Move one step, or two with a matching pair. You can climb at most two different routes each turn.</p>
      </section>
      <section>
        <h3>Roll again or make camp</h3>
        <p>Camp to bank every step you climbed. If you roll and have no available route, your turn ends and you lose your unbanked steps.</p>
        <p>The first player to bank a summit earns three points. Anyone who summits that route later earns two. You can score each route once. First to seven points wins.</p>
      </section>
    {:else if gameId === 'harbor-dice'}
      <section>
        <h3>Roll and hold</h3>
        <p>Roll five dice. You can hold any dice and reroll the rest up to twice. Change your holds between rolls.</p>
      </section>
      <section>
        <h3>Fill your scorecard</h3>
        <p>After any roll, choose one open category. A category can score zero and you can only fill it once. Face categories add up dice of that face. Twin docks uses two different pairs, Lighthouse needs a one and a six, Channel rewards consecutive faces, and Fleet rewards matching dice.</p>
        <p>Play ten rounds. The highest total wins, and ties share the win.</p>
      </section>
    {:else if gameId === 'farkle'}
      <section>
        <h3>Roll, keep, or bank</h3>
        <p>Start with six dice. Keep at least one scoring combination, then bank your turn points or roll the remaining dice. If you keep all six, you can roll all six again. A roll with no scoring dice ends your turn and wipes out your unbanked points.</p>
        <p>Your first bank must be at least 500 points. After that you can bank any scoring turn.</p>
      </section>
      <section>
        <h3>Scoring dice</h3>
        <ul>
          <li>Single 1s score 100 each. Single 5s score 50 each.</li>
          <li>Three 1s score 1,000. Other triples score 100 times the face value. Four, five, and six of a kind score 1,000, 2,000, and 3,000. If your dice can score in more than one way, you get the highest total.</li>
          <li>A straight, three pairs, or four of a kind with a pair score 1,500. Two triplets score 2,500.</li>
        </ul>
      </section>
      <section>
        <h3>Final turns</h3>
        <p>When someone banks 10,000 points or more, everyone else gets one last turn. The highest score wins, with ties shared.</p>
      </section>
    {:else if gameId === 'president'}
      <section>
        <h3>Beat the standing set</h3>
        <p>Lead with a single card or several of the same rank. On your turn, play the same number of cards at a higher rank or pass. Twos are highest, followed by aces and kings. You may play later in the trick if someone beats the standing set.</p>
        <p>When everyone else still in the hand passes, the last player to play leads next. If they have emptied their hand, the lead moves clockwise to the next player with cards.</p>
      </section>
      <section>
        <h3>Empty your hand first</h3>
        <p>The first player out becomes President and earns two points. The second earns one point. In the next hand, the last-place player gives the President their highest card. The President returns any card and leads.</p>
        <p>Finish the hand in which someone reaches 11 points. The highest score wins. Final-hand placement breaks ties.</p>
      </section>
    {:else if gameId === 'gin-rummy'}
      <section>
        <h3>Make sets and runs</h3>
        <p>Build groups of three or four cards of a rank or sequences of three or more in one suit. Aces are low. Cards outside your groups are deadwood. Aces count one, face cards count ten, and other cards count their number.</p>
      </section>
      <section>
        <h3>Draw and discard</h3>
        <p>Both players get a chance to take the opening upcard. On later turns, draw from the stock or take the top discard, then discard a card. You must keep the card you took from the discard pile for that turn.</p>
      </section>
      <section>
        <h3>Knock or go gin</h3>
        <p>You may knock if your chosen discard leaves at most ten deadwood. The other player can lay off onto your groups and scores an undercut if they finish even or lower. Going gin leaves zero deadwood, scores a bonus, and prevents layoffs. Reach 100 points to end the game.</p>
      </section>
    {:else if gameId === 'golf'}
      <section>
        <h3>Set up your grid</h3>
        <p>Each hole starts with six face-down cards in two rows. Turn any two face up.</p>
      </section>
      <section>
        <h3>Draw and swap</h3>
        <p>On your turn, draw from the stock and swap that card into any slot or discard it. If you take the top discard, you must swap it into your grid. The replaced card goes on the discard pile. The hole ends when any player turns their sixth card face up.</p>
      </section>
      <section>
        <h3>Aim low</h3>
        <p>Matching ranks in a column cancel out. Kings are worth zero, twos are worth minus two, aces are worth one, and jacks and queens are worth ten. All other cards are worth their number.</p>
        <p>Reveal and score every grid at the end of each hole. The lowest total after nine holes wins. Ties share the win.</p>
      </section>
    {:else if gameId === 'word-split'}
      <section>
        <h3>Build words</h3>
        <p>Everyone gets the same eight letter tiles and 75 seconds to submit words. Use three or more letters and use each tile at most once per word. You can reuse the tiles for your next word.</p>
      </section>
      <section>
        <h3>Score unique finds</h3>
        <p>Words stay private until time runs out or everyone finishes. A word scores one point per letter if exactly one player submitted it. A word found by two or more players scores zero.</p>
        <p>The highest total after three rounds wins. Tied players share the win.</p>
      </section>
    {:else if gameId === 'oh-hell'}
      <section>
        <h3>Bidding</h3>
        <p>A trick is one card from each player. Whoever plays the best card takes them all.</p>
        <p>Starting left of the dealer, bid exactly how many tricks you expect to win. The dealer bids last and must leave the total bids different from the number of tricks available.</p>
      </section>
      <section>
        <h3>Playing tricks</h3>
        <p>The face-up card sets trump, the suit that beats all the others. Follow the led suit (the suit of the first card in the trick) if you can. The highest trump takes the trick. If nobody plays trump, the highest card of the led suit wins. The winner leads next.</p>
      </section>
      <section>
        <h3>Scoring</h3>
        <p>Hit your bid exactly to score 10 points plus your tricks. A missed bid scores zero. Hand sizes grow from one to five cards, then shrink back to one. The highest score after nine hands wins, with ties shared.</p>
      </section>

    {:else if gameId === 'euchre'}
      <section>
        <h3>Calling trump</h3>
        <p>Partners sit across from each other and each player gets five cards. A trick is one card from each player, and the best card takes them all. Trump is the suit that beats all the others.</p>
        <p>Order up (say yes to) the face-up card to make its suit trump, then the dealer takes the card and discards one.</p>
        <p>If everyone passes, choose from the other three suits. If the decision gets back to the dealer again, the dealer must name trump.</p>
      </section>
      <section>
        <h3>The bowers</h3>
        <p>The bowers are the two highest trumps. The jack of trump is the right bower, the strongest card. The other jack of the same color is the left bower. It ranks second and counts as trump when following suit.</p>
        <p>Follow suit (play the same suit as the first card in the trick) when you can. The highest trump takes the trick, or the highest card of the led suit if no one played trump. The winner leads the next trick.</p>
      </section>
      <section>
        <h3>Scoring</h3>
        <p>The makers are the team that chose trump; the other team defends. Take three or four tricks as makers for one point, or all five for two. If the makers take fewer than three, the defenders score two.</p>
        <p>Call trump alone to sit out your partner. A lone sweep scores four points. The first team to 10 wins.</p>
      </section>

    {:else if gameId === 'spades'}
      <section>
        <h3>Bidding</h3>
        <p>Partners sit across from each other. Starting left of the dealer, bid how many of the 13 tricks you expect to take. A trick is one card from each player, and the best card takes all four. Add both partners’ bids to get your team’s contract, the number of tricks your team promised to take.</p>
      </section>
      <section>
        <h3>Trump and tricks</h3>
        <p>Spades are trump: they beat every other suit. Follow the led suit (the suit of the first card in the trick) if you can. The highest spade wins the trick, or the highest card of the led suit if nobody played a spade. The winner leads next.</p>
        <p>You can lead (play the first card of a trick) with spades after one has been played or if your hand contains only spades.</p>
      </section>
      <section>
        <h3>Scoring and nil</h3>
        <p>Make your contract to score 10 points per bid trick. Each extra trick scores one point and adds a bag (a trick over your bid). Ten bags cost 100 points. Miss your contract and lose 10 points per bid trick.</p>
        <p>A nil bid means you promise to take no tricks at all. It earns 100 points for taking zero tricks and loses 100 if you take any. Tricks taken by a nil bidder do not count toward their team’s contract.</p>
        <p>The higher-scoring team wins once either team reaches 500. A tie goes to another round.</p>
      </section>

    {:else if gameId === 'hearts'}
      <section>
        <h3>Passing</h3>
        <p>Each player gets 13 cards. Pass three cards left in the first round, right in the second, and across in the third. Keep your hand in the fourth round, then repeat.</p>
      </section>
      <section>
        <h3>Taking tricks</h3>
        <p>A trick is one card from each player. The 2 of clubs opens the round. Play the same suit if you can. The highest card of that suit wins, and its player leads the next trick. Aces are high.</p>
        <p>Avoid playing penalty cards (any heart, or the queen of spades) on the first trick. If you have only penalty cards and cannot follow suit, play a heart. You may lead (play the first card of a trick with) hearts once a heart has been played, or if your hand contains only hearts.</p>
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
        <h3>Your turn</h3>
        <ol>
          <li>Roll 6 dice (up to 3 rolls per turn)</li>
          <li>Lock dice you want to keep between rolls</li>
          <li>Resolve your dice effects</li>
          <li>Select targets for attacks and steals</li>
        </ol>
      </section>

      <section>
        <h3>Dice faces</h3>
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
        <h3>Captain's plunder</h3>
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
        <h3>Wild ones</h3>
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
        <h3>Spot on</h3>
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
    <button type="button" class="btn-close" onclick={onclose}>Close</button>
    {#if onvote}
      <button type="button" class="btn-close btn-vote" aria-pressed={voted} onclick={onvote}>
        {#if voted}
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
          Your vote
        {:else}
          Vote
        {/if}
      </button>
    {/if}
    {#if onplay}<button type="button" class="btn-play" onclick={onplay}>Play {gameName}</button>{/if}
  </div>
</Modal>
{/if}

<style>
  .rules-content {
    max-width: 28rem;
  }

  .fit {
    margin: -6px 0 16px;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-ink-muted);
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

  /* Pinned to the bottom of the sheet: on a phone the rules scroll beneath
     it, so Close and the actions are always in reach. */
  .modal-footer {
    position: sticky;
    bottom: 0;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin: 20px -24px -24px;
    padding: 12px 24px 16px;
    background: var(--color-paper);
    border-top: 2px solid var(--color-linen);
  }

  .btn-close, .btn-play {
    min-height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    font-size: 0.9375rem;
    font-weight: 700;
    font-family: var(--font-body);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.2s ease;
  }

  .btn-close {
    background: transparent;
    border: 2px solid var(--color-espresso);
    color: var(--color-espresso);
  }

  /* Pressed reads as a marked ballot, not as a call to action. */
  .btn-vote[aria-pressed='true'] {
    background: var(--color-mustard-tint);
  }

  .btn-play {
    background: var(--color-terracotta-deep);
    border: 2px solid var(--color-terracotta-deep);
    color: var(--color-cream);
  }

  @media (hover: hover) {
    .btn-close:hover {
      background: rgba(59, 47, 47, 0.06);
    }

    .btn-vote[aria-pressed='true']:hover {
      background: var(--color-mustard-tint);
    }

    .btn-play:hover {
      background: var(--color-terracotta-press);
      border-color: var(--color-terracotta-press);
    }
  }

  .btn-close:active, .btn-play:active {
    transform: scale(0.98);
  }

  /* On a phone the buttons share the row; a third wraps to a full-width row. */
  @media (max-width: 519px) {
    .btn-close, .btn-play {
      flex: 1 1 auto;
    }
  }
</style>
