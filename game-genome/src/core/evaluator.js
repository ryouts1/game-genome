import { generateLegalActions } from './move-generator.js';
import { getGameStatus } from './termination.js';
import { buildBoardIndex } from './state.js';
import { directionVectors, getPlayer, inBounds } from './utils.js';

function pieceValue(game, pieceKind) {
  return game.evaluation?.materialWeights?.[pieceKind]
    ?? game.pieceKinds[pieceKind]?.evaluation?.value
    ?? 1;
}

function evaluateMaterial(game, state, rootPlayerId) {
  let score = 0;
  for (const piece of state.pieces) {
    const value = pieceValue(game, piece.kind);
    score += piece.owner === rootPlayerId ? value : -value;
  }
  return score;
}

function evaluateMobility(game, state, rootPlayerId) {
  const rootActions = generateLegalActions(game, { ...state, currentPlayer: rootPlayerId }, rootPlayerId).length;
  const opponent = game.players.find((player) => player.id !== rootPlayerId)?.id;
  const opponentActions = opponent
    ? generateLegalActions(game, { ...state, currentPlayer: opponent }, opponent).length
    : 0;
  return rootActions - opponentActions;
}

function centerDistanceScore(game, x, y) {
  const centerX = (game.board.width - 1) / 2;
  const centerY = (game.board.height - 1) / 2;
  const distance = Math.abs(centerX - x) + Math.abs(centerY - y);
  const maxDistance = centerX + centerY || 1;
  return 1 - distance / maxDistance;
}

function evaluateCenterControl(game, state, rootPlayerId) {
  let score = 0;
  for (const piece of state.pieces) {
    const value = centerDistanceScore(game, piece.x, piece.y) * pieceValue(game, piece.kind);
    score += piece.owner === rootPlayerId ? value : -value;
  }
  return score;
}

function evaluateAdvancement(game, state, rootPlayerId) {
  let score = 0;
  const maxY = Math.max(game.board.height - 1, 1);
  for (const piece of state.pieces) {
    const player = getPlayer(game, piece.owner);
    const progress = player?.forward === 1 ? piece.y / maxY : (maxY - piece.y) / maxY;
    const value = progress * pieceValue(game, piece.kind);
    score += piece.owner === rootPlayerId ? value : -value;
  }
  return score;
}

function evaluateLineWindows(game, state, rootPlayerId) {
  const boardIndex = buildBoardIndex(state);
  let score = 0;

  for (const condition of game.termination.winConditions ?? []) {
    if (condition.type !== 'line') {
      continue;
    }

    const directions = directionVectors(condition.directions);
    const length = condition.length;
    const pieceKind = condition.pieceKind;

    for (let y = 0; y < game.board.height; y += 1) {
      for (let x = 0; x < game.board.width; x += 1) {
        for (const [dx, dy] of directions) {
          const cells = [];
          let validWindow = true;
          for (let step = 0; step < length; step += 1) {
            const targetX = x + dx * step;
            const targetY = y + dy * step;
            if (!inBounds(game.board, targetX, targetY)) {
              validWindow = false;
              break;
            }
            cells.push(boardIndex.get(`${targetX},${targetY}`) ?? null);
          }

          if (!validWindow) {
            continue;
          }

          const rootPieces = cells.filter((piece) => piece && piece.owner === rootPlayerId && piece.kind === pieceKind).length;
          const opponentPieces = cells.filter((piece) => piece && piece.owner !== rootPlayerId && piece.kind === pieceKind).length;
          const blockedByOtherKinds = cells.some((piece) => piece && piece.kind !== pieceKind);
          if (blockedByOtherKinds) {
            continue;
          }

          if (rootPieces > 0 && opponentPieces === 0) {
            score += rootPieces * rootPieces;
          }
          if (opponentPieces > 0 && rootPieces === 0) {
            score -= opponentPieces * opponentPieces;
          }
        }
      }
    }
  }

  return score;
}

export function evaluateState(game, state, rootPlayerId) {
  const status = getGameStatus(game, state);
  const terminalScore = game.evaluation?.terminalScore ?? 100000;
  if (status.isTerminal) {
    if (status.outcome === 'draw') {
      return 0;
    }
    return status.winner === rootPlayerId ? terminalScore : -terminalScore;
  }

  const weights = {
    material: 1,
    mobility: 0.08,
    centerControl: 0.06,
    advancement: 0.12,
    linePotential: 1.3,
    ...(game.evaluation?.weights ?? {}),
  };

  return (
    evaluateMaterial(game, state, rootPlayerId) * weights.material
    + evaluateMobility(game, state, rootPlayerId) * weights.mobility
    + evaluateCenterControl(game, state, rootPlayerId) * weights.centerControl
    + evaluateAdvancement(game, state, rootPlayerId) * weights.advancement
    + evaluateLineWindows(game, state, rootPlayerId) * weights.linePotential
  );
}
