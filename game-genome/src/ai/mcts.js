import { applyAction } from '../core/game-engine.js';
import { generateLegalActions } from '../core/move-generator.js';
import { getGameStatus } from '../core/termination.js';
import { previousPlayerId } from '../core/utils.js';
import { createRandomNumberGenerator } from './random.js';

class MctsNode {
  constructor({ state, parent = null, action = null, playerJustMoved = null, untriedActions = [] }) {
    this.state = state;
    this.parent = parent;
    this.action = action;
    this.playerJustMoved = playerJustMoved;
    this.untriedActions = [...untriedActions];
    this.children = [];
    this.visits = 0;
    this.wins = 0;
  }

  get winRate() {
    return this.visits === 0 ? 0 : this.wins / this.visits;
  }
}

function uctScore(parent, child, explorationWeight) {
  if (child.visits === 0) {
    return Infinity;
  }
  return child.winRate + explorationWeight * Math.sqrt(Math.log(parent.visits) / child.visits);
}

function selectChild(node, explorationWeight) {
  return node.children.reduce((bestChild, candidate) => {
    if (!bestChild) {
      return candidate;
    }
    return uctScore(node, candidate, explorationWeight) > uctScore(node, bestChild, explorationWeight)
      ? candidate
      : bestChild;
  }, null);
}

function pickRandom(actions, random) {
  const index = Math.floor(random() * actions.length);
  return actions[index];
}

function actionHeuristic(action, board) {
  const centerX = (board.width - 1) / 2;
  const centerY = (board.height - 1) / 2;
  const centerBias = -Math.abs(centerX - action.to.x) - Math.abs(centerY - action.to.y);
  return (action.capture ? 5 : 0) + centerBias * 0.1;
}

function pickRolloutAction(game, state, actions, random) {
  const scored = actions.map((action) => ({
    action,
    score: actionHeuristic(action, game.board),
  }));

  scored.sort((left, right) => right.score - left.score);
  const topBucket = scored.slice(0, Math.min(3, scored.length));
  return pickRandom(topBucket.map((entry) => entry.action), random);
}

function rollout(game, state, rootNode, random, maxDepth) {
  let simulationState = state;

  for (let step = 0; step < maxDepth; step += 1) {
    const status = getGameStatus(game, simulationState);
    if (status.isTerminal) {
      return status;
    }

    const actions = generateLegalActions(game, simulationState, simulationState.currentPlayer);
    if (actions.length === 0) {
      return getGameStatus(game, simulationState);
    }

    const chosenAction = pickRolloutAction(game, simulationState, actions, random);
    simulationState = applyAction(game, simulationState, chosenAction);
  }

  return getGameStatus(game, simulationState);
}

function backpropagate(node, result) {
  let current = node;
  while (current) {
    current.visits += 1;
    if (result.outcome === 'draw') {
      current.wins += 0.5;
    } else if (result.winner && result.winner === current.playerJustMoved) {
      current.wins += 1;
    }
    current = current.parent;
  }
}

export function chooseMctsAction(game, state, options = {}) {
  const iterations = options.iterations ?? 800;
  const maxRolloutDepth = options.maxRolloutDepth ?? 40;
  const explorationWeight = options.explorationWeight ?? Math.sqrt(2);
  const random = createRandomNumberGenerator(options.seed ?? null);

  const rootActions = generateLegalActions(game, state, state.currentPlayer);
  const root = new MctsNode({
    state,
    playerJustMoved: previousPlayerId(game, state.currentPlayer),
    untriedActions: rootActions,
  });

  if (rootActions.length === 0) {
    return {
      action: null,
      iterations: 0,
      summary: '合法手がありません。',
    };
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let node = root;
    let simulationState = state;

    while (node.untriedActions.length === 0 && node.children.length > 0) {
      node = selectChild(node, explorationWeight);
      simulationState = node.state;
    }

    if (node.untriedActions.length > 0) {
      const actionIndex = Math.floor(random() * node.untriedActions.length);
      const action = node.untriedActions.splice(actionIndex, 1)[0];
      const nextState = applyAction(game, simulationState, action);
      const childNode = new MctsNode({
        state: nextState,
        parent: node,
        action,
        playerJustMoved: action.playerId,
        untriedActions: generateLegalActions(game, nextState, nextState.currentPlayer),
      });
      node.children.push(childNode);
      node = childNode;
      simulationState = nextState;
    }

    const result = rollout(game, simulationState, root, random, maxRolloutDepth);
    backpropagate(node, result);
  }

  const bestChild = [...root.children].sort((left, right) => right.visits - left.visits)[0];
  if (!bestChild) {
    return {
      action: rootActions[0],
      iterations,
      summary: `iterations ${iterations} / fallback`,
    };
  }

  return {
    action: bestChild.action,
    iterations,
    visits: bestChild.visits,
    winRate: bestChild.winRate,
    summary: `iterations ${iterations} / visits ${bestChild.visits} / win-rate ${(bestChild.winRate * 100).toFixed(1)}%`,
  };
}
