import type { Card, PilePosition, KingsCornerPlayerView, PlayableCard, MovablePile } from '../../types/game.js';
import { isCornerPosition } from '../../game/validation.js';

export type AIDecision =
  | { action: 'play-card'; card: Card; target: PilePosition }
  | { action: 'move-pile'; from: PilePosition; to: PilePosition }
  | { action: 'end-turn' };

export class AIStrategy {
  decide(view: KingsCornerPlayerView): AIDecision {
    // Priority 1: Play Kings to corners (mandatory)
    const kingPlay = this.findKingPlay(view.playableCards);
    if (kingPlay) {
      return { action: 'play-card', card: kingPlay.card, target: kingPlay.validTargets[0] };
    }

    // Priority 2: Move piles to free up cardinal positions
    const pileMove = this.findBestPileMove(view.movablePiles, view);
    if (pileMove) {
      return { action: 'move-pile', from: pileMove.from, to: pileMove.validTargets[0] };
    }

    // Priority 3: Play cards from hand (prefer higher rank cards first)
    const cardPlay = this.findBestCardPlay(view.playableCards);
    if (cardPlay) {
      return { action: 'play-card', card: cardPlay.card, target: cardPlay.target };
    }

    // Nothing to play
    return { action: 'end-turn' };
  }

  private findKingPlay(playableCards: PlayableCard[]): PlayableCard | null {
    return playableCards.find((pc) => pc.card.rank === 'K') ?? null;
  }

  private findBestPileMove(movablePiles: MovablePile[], view: KingsCornerPlayerView): MovablePile | null {
    if (movablePiles.length === 0) return null;

    // Prefer moving cardinal piles to free them up (player can then play any card there)
    // Only move if it frees a cardinal position
    const cardinalMoves = movablePiles.filter((mp) => !isCornerPosition(mp.from));
    if (cardinalMoves.length > 0) {
      // Prefer moving smaller piles (easier to place)
      return cardinalMoves[0];
    }

    return null;
  }

  private findBestCardPlay(playableCards: PlayableCard[]): { card: Card; target: PilePosition } | null {
    // Filter out Kings (handled separately)
    const nonKingPlays = playableCards.filter((pc) => pc.card.rank !== 'K');
    if (nonKingPlays.length === 0) return null;

    // Prefer playing higher-rank cards first (harder to place later)
    const RANK_ORDER: Record<string, number> = {
      Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6,
      '5': 5, '4': 4, '3': 3, '2': 2, A: 1,
    };

    const sorted = [...nonKingPlays].sort(
      (a, b) => (RANK_ORDER[b.card.rank] ?? 0) - (RANK_ORDER[a.card.rank] ?? 0),
    );

    const best = sorted[0];
    // Prefer playing on cardinal piles over corner piles (corners are premium)
    const cardinalTarget = best.validTargets.find((t) => !isCornerPosition(t));
    const target = cardinalTarget ?? best.validTargets[0];

    return { card: best.card, target };
  }
}
