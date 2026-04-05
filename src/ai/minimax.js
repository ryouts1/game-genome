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
    return {
      score: evaluateState(context.game, state, context.rootPlayerId),
      line: [],
    };
  }

  const cacheKey = `${serializeState(state)}|${depth}`;
  if (context.table.has(cacheKey)) {
    return context.table.get(cacheKey);
  }

  const legalActions = generateLegalActions(context.game, state, state.currentPlayer);
  if (legalActions.length === 0) {
    const fallback = {
      score: evaluateState(context.game, state, context.rootPlayerId),
      line: [],
    };
    context.table.set(cacheKey, fallback);
    return fallback;
  }

  const maximizing = shouldMaximize(state, context.rootPlayerId);
  let best = {
    score: maximizing ? -Infinity : Infinity,
    line: [],
  };

  for (const action of orderActions(context.game, legalActions)) {
    const childState = applyAction(context.game, state, action);
    const childResult = search(context, childState, depth - 1, alpha, beta);
    const candidate = {
      score: childResult.score,
      line: [action, ...childResult.line],
    };

    if (maximizing ? candidate.score > best.score : candidate.score < best.score) {
      best = candidate;
    }

    if (maximizing) {
      alpha = Math.max(alpha, best.score);
    } else {
      beta = Math.min(beta, best.score);
    }

    if (beta <= alpha) {
      break;
    }
  }

  context.table.set(cacheKey, best);
  return best;
}

export function analyzeMinimax(game, state, options = {}) {
  const depth = options.depth ?? 3;
  const candidateLimit = options.candidateLimit ?? 5;
  const pvLimit = options.pvLimit ?? 6;
  const rootPlayerId = state.currentPlayer;
  const context = createSearchContext(game, rootPlayerId);
  const legalActions = orderActions(game, generateLegalActions(game, state, rootPlayerId));

  if (legalActions.length === 0) {
    return {
      action: null,
      score: evaluateState(game, state, rootPlayerId),
      exploredNodes: 0,
      depth,
      candidates: [],
      principalVariation: [],
      summary: '合法手がありません。',
    };
  }

  const scoredCandidates = legalActions.map((action) => {
    const nextState = applyAction(game, state, action);
    const result = search(context, nextState, depth - 1, -Infinity, Infinity);
    return {
      action,
      score: result.score,
      principalVariation: [action, ...result.line].slice(0, pvLimit).map((entry) => entry.text),
    };
  });

  scoredCandidates.sort((left, right) => right.score - left.score);
  const best = scoredCandidates[0];

  return {
    action: best.action,
    score: best.score,
    exploredNodes: context.nodesExplored,
    depth,
    candidates: scoredCandidates.slice(0, candidateLimit),
    principalVariation: best.principalVariation,
    summary: `depth ${depth} / nodes ${context.nodesExplored} / eval ${best.score.toFixed(2)}`,
  };
}

export function chooseMinimaxAction(game, state, options = {}) {
  return analyzeMinimax(game, state, options);
}
