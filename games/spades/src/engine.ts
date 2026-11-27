import { aceHighRankValue, cardEquals, createDeck, SUITS, type Card } from '@parlor/cards';
import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { legalCards, scoreRound, winningPlay, winsAgainst } from './rules.js';
import type { RoundScore, SpadesAction, SpadesPhase, SpadesView, TeamIndex, TrickPlay } from './types.js';

const HAND_SIZE = 13;
const NUM_SEATS = 4;

interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  team: TeamIndex;
  hand: Card[];
  bid: number | null;
  tricks: number;
}

function makeTeam(team: TeamIndex) {
  return { team, score: 0, bags: 0, roundScore: null as RoundScore | null };
}

export class SpadesEngine {
  private readonly seats: Seat[];
  private readonly teams = [makeTeam(0), makeTeam(1)];
  private phase: SpadesPhase = 'bidding';
  private dealer = -1;
  private active = 0;
  private round = 0;
  private trickNumber = 1;
  private trick: TrickPlay[] = [];
  private trickWinnerId: string | null = null;
  private spadesBroken = false;
  private winningTeam: TeamIndex | null = null;

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly randomInt: RandomInt = secureRandomInt,
    private readonly goal = 500,
  ) {
    if (players.length !== NUM_SEATS) throw new GameRuleError('Spades requires four players.');
    this.seats = players.map((player, index) => ({
      ...player, team: index % 2 === 0 ? 0 : 1, connected: true, hand: [], bid: null, tricks: 0,
    }));
    this.deal();
  }

  get currentPhase(): SpadesPhase {
    return this.phase;
  }

  setConnected(id: string, connected: boolean): void {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  bid(id: string, amount: number): void {
    const seat = this.assertTurn(id, 'bidding');
    if (!Number.isInteger(amount) || amount < 0 || amount > HAND_SIZE) {
      throw new GameRuleError('Choose a bid from 0 to 13.');
    }
    seat.bid = amount;
    this.active = this.next(this.active);
    if (this.seats.every((player) => player.bid !== null)) this.phase = 'playing';
  }

  playCard(id: string, card: Card): void {
    const seat = this.assertTurn(id, 'playing');
    const chosen = this.playable().find((candidate) => cardEquals(candidate, card));
    if (!chosen) throw new GameRuleError('That card cannot be played on this trick.');

    seat.hand.splice(seat.hand.indexOf(chosen), 1);
    this.trick.push({ playerId: id, card: chosen });
    if (chosen.suit === 'spades') this.spadesBroken = true;
    const winner = this.trick.length === NUM_SEATS ? winningPlay(this.trick) : undefined;
    if (!winner) {
      this.active = this.next(this.active);
      return;
    }

    this.active = this.seats.findIndex((player) => player.id === winner.playerId);
    this.seats[this.active].tricks++;
    this.trickWinnerId = winner.playerId;
    this.phase = 'trick-won';
  }

  advanceReveal(): void {
    if (this.phase === 'round-scoring') {
      this.deal();
      return;
    }
    if (this.phase !== 'trick-won') return;
    if (this.trickNumber === HAND_SIZE) {
      this.finishRound();
      return;
    }
    this.trickNumber++;
    this.trick = [];
    this.trickWinnerId = null;
    this.phase = 'playing';
  }

  automaticAction(): { id: string; action: SpadesAction } | undefined {
    const seat = this.seats[this.active];
    if ((seat.connected && !seat.bot) || !this.seats.some((player) => player.connected && !player.bot)) return;
    if (this.phase === 'bidding') {
      const estimate = seat.hand.reduce((total, card) => {
        const rank = aceHighRankValue(card.rank);
        const strength = card.suit === 'spades'
          ? (rank >= 12 ? 0.9 : 0.5)
          : (rank === 14 ? 0.85 : rank === 13 ? 0.4 : 0);
        return total + strength;
      }, 0);
      return { id: seat.id, action: { type: 'bid', amount: Math.max(1, Math.round(estimate)) } };
    }
    if (this.phase !== 'playing') return;

    const choices = this.playable().sort((a, b) => this.strength(a) - this.strength(b));
    const currentWinner = winningPlay(this.trick);
    const partner = this.seats[(this.active + 2) % NUM_SEATS];
    const teamNeedsTricks = seat.tricks + (partner.bid ? partner.tricks : 0) < (seat.bid ?? 0) + (partner.bid ?? 0);
    const avoidingTricks = seat.bid === 0 || !teamNeedsTricks;
    let card = choices[0];
    if (currentWinner) {
      const canDuck = choices.filter((choice) => !winsAgainst(choice, currentWinner.card));
      const partnerCovered = currentWinner.playerId === partner.id && partner.bid !== 0;
      if (avoidingTricks || partnerCovered) card = canDuck.at(-1) ?? card;
      else card = choices.find((choice) => winsAgainst(choice, currentWinner.card)) ?? card;
    } else if (!avoidingTricks) {
      card = choices.at(-1) ?? card;
    }
    return { id: seat.id, action: { type: 'play-card', card } };
  }

  view(id?: string): SpadesView {
    const seat = this.seats.find((player) => player.id === id);
    const activePlayerId = this.phase === 'bidding' || this.phase === 'playing' ? this.seats[this.active].id : null;
    return {
      phase: this.phase,
      round: this.round,
      trickNumber: this.trickNumber,
      spadesBroken: this.spadesBroken,
      goal: this.goal,
      dealerId: this.seats[this.dealer].id,
      activePlayerId,
      trickWinnerId: this.trickWinnerId,
      winningTeam: this.winningTeam,
      trick: [...this.trick],
      players: this.seats.map(({ id, name, team, bid, tricks }) => ({ id, name, team, bid, tricks })),
      teams: this.teams.map((team) => {
        const players = this.seats.filter((player) => player.team === team.team);
        return {
          ...team,
          bid: players.every((player) => player.bid !== null)
            ? players.reduce((sum, player) => sum + (player.bid ?? 0), 0)
            : null,
          tricks: players.reduce((sum, player) => sum + (player.bid ? player.tricks : 0), 0),
        };
      }),
      myHand: seat ? [...seat.hand] : [],
      playableCards: seat && seat.id === activePlayerId && this.phase === 'playing' ? this.playable() : [],
    };
  }

  private deal(): void {
    this.round++;
    this.dealer = this.next(this.dealer);
    this.active = this.next(this.dealer);
    this.trickNumber = 1;
    this.trick = [];
    this.trickWinnerId = null;
    this.spadesBroken = false;
    this.phase = 'bidding';
    const deck = fisherYatesShuffle(createDeck(), this.randomInt);
    for (const [index, seat] of this.seats.entries()) {
      seat.hand = deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE)
        .sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || aceHighRankValue(a.rank) - aceHighRankValue(b.rank));
      seat.bid = null;
      seat.tricks = 0;
    }
    for (const team of this.teams) team.roundScore = null;
  }

  private finishRound(): void {
    for (const team of this.teams) {
      const players = this.seats.filter((player) => player.team === team.team);
      const result = scoreRound(players.map(({ bid, tricks }) => ({ bid: bid ?? 0, tricks })), team.bags);
      team.score += result.total;
      team.bags = result.bags;
      team.roundScore = result;
    }
    const [first, second] = this.teams;
    if (Math.max(first.score, second.score) >= this.goal && first.score !== second.score) {
      this.winningTeam = first.score > second.score ? first.team : second.team;
      this.phase = 'game-over';
    } else {
      this.phase = 'round-scoring';
    }
  }

  private next(index: number): number {
    return (index + 1) % NUM_SEATS;
  }

  private assertTurn(id: string, phase: SpadesPhase): Seat {
    const seat = this.seats[this.active];
    if (this.phase !== phase || seat.id !== id) {
      throw new GameRuleError('It is not your turn.', 'NOT_YOUR_TURN');
    }
    return seat;
  }

  private playable(): Card[] {
    return legalCards(this.seats[this.active].hand, this.trick[0]?.card, this.spadesBroken);
  }

  private strength(card: Card): number {
    return aceHighRankValue(card.rank) + (card.suit === 'spades' ? 14 : 0);
  }
}
