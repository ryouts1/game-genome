import { applyAction } from '../core/game-engine.js';
import { evaluateState } from '../core/evaluator.js';
import { generateLegalActions } from '../core/move-generator.js';
import { getGameStatus } from '../core/termination.js';
import { serializeState } from '../core/state.js';

function centerBias(game, action) {
  const centerX = (game.board.width - 1) / 2;
  const centerY = (game.board.height - 1) / 2;
  return -Math.abs(centerX - action.to.x) - Math.abs(centerY - action.to.y);
}

function orderActions(game, actions) {
  return [...actions].sort((left, right) => {
    const leftScore = (left.capture ? 100 : 0) + centerBias(game, left);
    const rightScore = (right.capture ? 100 : 0) + centerBias(game, right);
    return rightScore - leftScore;
  });
}

function shouldMaximize(state, rootPlayerId) {
  return state.currentPlayer === rootPlayerId;
}

function createSearchContext(game, rootPlayerId) {
  return {
    game,
    rootPlayerId,
    nodesExplored: 0,
    table: new Map(),
  };
}

function search(context, state, depth, alpha, beta) {
  context.nodesExplored += 1;
  const status = getGameStatus(context.game, state);
  if (depth === 0 || status.isTerminal) {
    return evaluateState(context.game, state, context.rootPlayerId);
  }

  const cacheKey = `${serializeState(state)}|${depth}`;
  if (context.table.has(cacheKey)) {
    return context.table.get(cacheKey);
  }

  const legalActions = generateLegalActions(context.game, state, state.currentPlayer);
  if (legalActions.length === 0) {
    return evaluateState(context.game, state, context.rootPlayerId);
  }

  const maximizing = shouldMaximize(state, context.rootPlayerId);
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const action of orderActions(context.game, legalActions)) {
    const childState = applyAction(context.game, state, action);
    const childScore = search(context, childState, depth - 1, alpha, beta);

    if (maximizing) {
      bestScore = Math.max(bestScore, childScore);
      alpha = Math.max(alpha, bestScore);
    } else {
      bestScore = Math.min(bestScore, childScore);
      beta = Math.min(beta, bestScore);
    }

    if (beta <= alpha) {
      break;
    }
  }

  context.table.set(cacheKey, bestScore);
  return bestScore;
}

export function chooseMinimaxAction(game, state, options = {}) {
  const depth = options.depth ?? 3;
  const rootPlayerId = state.currentPlayer;
  const context = createSearchContext(game, rootPlayerId);
  const legalActions = orderActions(game, generateLegalActions(game, state, rootPlayerId));

  if (legalActions.length === 0) {
    return {
      action: null,
      score: evaluateState(game, state, rootPlayerId),
      exploredNodes: 0,
      depth,
      summary: '合法手がありません。',
    };
  }

  let bestAction = legalActions[0];
  let bestScore = -Infinity;

  for (const action of legalActions) {
    const nextState = applyAction(game, state, action);
    const score = search(context, nextState, depth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  return {
    action: bestAction,
    score: bestScore,
    exploredNodes: context.nodesExplored,
    depth,
    summary: `depth ${depth} / nodes ${context.nodesExplored} / eval ${bestScore.toFixed(2)}`,
  };
}
