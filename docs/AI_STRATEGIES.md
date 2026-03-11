# Smarter Game AIs for Parlor

Ideas for evolving beyond hand-tuned heuristic bots.

## Approaches

### Genetic Algorithm (Recommended Starting Point)

Parameterize `AIStrategy` as a weight vector instead of hardcoded priorities. Evolve optimal weights via tournament selection.

**How it works:**
1. Define strategy as weighted heuristics (e.g., "prefer high cards: 0.8", "free cardinal spots: 0.3", "hold kings: 0.6")
2. Spawn a population of random weight vectors
3. Tournament them against each other
4. Breed winners, mutate, repeat
5. After a few hundred generations, extract strong strategies

**Why it fits Parlor:**
- Pure TypeScript, no ML dependencies
- Weekend-project scope
- Can evolve multiple "personalities" (aggressive, defensive) and assign per bot
- Weights are interpretable — easy to tune and debug
- Directly replaces the current priority system in `AIStrategy`

### Monte Carlo Tree Search (MCTS)

Simulate random playouts from the current state, pick the move that wins most often.

**How it works:**
1. From current game state, enumerate legal moves
2. For each move, simulate many random games to completion
3. Pick the move with the highest win rate
4. Handle hidden information (opponent's hand) by sampling possible hands

**Why it fits Parlor:**
- Pure TypeScript, no dependencies
- Card games resolve fast — thousands of simulations per second
- Handles imperfect information via hand sampling
- Good for games where lookahead matters (e.g., Crazy Eights card counting)

### Reinforcement Learning (Neural Net)

Train a model via self-play to learn which moves lead to wins.

**How it works:**
1. Represent game state as a tensor (hand, piles, discard info)
2. Output a move probability distribution
3. Train via self-play over thousands of games
4. Use TensorFlow.js or ONNX for in-browser/server inference without Python

**Trade-offs:**
- Most powerful long-term, but highest complexity
- Needs significant training compute
- Model is a black box — hard to tune personality
- Requires ML infrastructure (training pipeline, model storage)

## Suggested Roadmap

1. **Genetic algorithm for Kings Corner** — parameterize existing `AIStrategy`, build a tournament runner, evolve weights
2. **Apply GA to other games** — Crazy Eights, Booty Dice
3. **Layer MCTS** for games where lookahead adds value
4. **RL later** if we want superhuman play or more complex games
