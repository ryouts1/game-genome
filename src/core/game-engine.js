import { cloneState, createPiece } from './state.js';
import { generateLegalActions } from './move-generator.js';
import { getGameStatus } from './termination.js';
import { nextPlayerId } from './utils.js';

function removeCapturedPiece(state, capturedPieceId) {
  const index = state.pieces.findIndex((piece) => piece.id === capturedPieceId);
  if (index >= 0) {
    state.pieces.splice(index, 1);
  }
}

function applyPlacementAction(state, action) {
  createPiece(state, action.pieceKind, action.playerId, action.to.x, action.to.y);
}

function applyMoveAction(state, action) {
  const piece = state.pieces.find((candidate) => candidate.id === action.pieceId);
  if (!piece) {
    throw new Error(`Unknown piece id: ${action.pieceId}`);
  }

  if (action.capture?.pieceId) {
    removeCapturedPiece(state, action.capture.pieceId);
  }

  piece.x = action.to.x;
  piece.y = action.to.y;
}

export function applyAction(game, state, action) {
  const nextState = cloneState(state);

  if (action.type === 'place') {
    applyPlacementAction(nextState, action);
  } else if (action.type === 'move-piece') {
    applyMoveAction(nextState, action);
  } else {
    throw new Error(`Unsupported action type: ${action.type}`);
  }

  nextState.history.push({
    playerId: action.playerId,
    action,
    text: action.text,
  });
  nextState.lastAction = action;
  nextState.currentPlayer = nextPlayerId(game, state.currentPlayer);

  return nextState;
}

export function getLegalActions(game, state) {
  return generateLegalActions(game, state, state.currentPlayer);
}

export function describeState(game, state) {
  return getGameStatus(game, state);
}
