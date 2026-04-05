import { generateLegalActions } from './move-generator.js';
import { buildBoardIndex } from './state.js';
import { directionVectors, getPlayer, inBounds, previousPlayerId } from './utils.js';

function countPieces(state, owner, pieceKinds) {
  const pieceKindSet = new Set(Array.isArray(pieceKinds) ? pieceKinds : [pieceKinds]);
  return state.pieces.filter((piece) => piece.owner === owner && pieceKindSet.has(piece.kind)).length;
}

function findLineWinner(game, state, condition) {
  const boardIndex = buildBoardIndex(state);
  const pieceKind = condition.pieceKind;
  const length = condition.length;
  const directions = directionVectors(condition.directions);

  for (const piece of state.pieces) {
    if (piece.kind !== pieceKind) {
      continue;
    }

    for (const [dx, dy] of directions) {
      let matches = 1;
      for (let step = 1; step < length; step += 1) {
        const targetX = piece.x + dx * step;
        const targetY = piece.y + dy * step;
        if (!inBounds(game.board, targetX, targetY)) {
          break;
        }
        const occupant = boardIndex.get(`${targetX},${targetY}`);
        if (!occupant || occupant.owner !== piece.owner || occupant.kind !== pieceKind) {
          break;
        }
        matches += 1;
      }

      if (matches === length) {
        return {
          outcome: 'win',
          winner: piece.owner,
          reason: `${pieceKind} が ${length} 連続で並んだため`,
        };
      }
    }
  }

  return null;
}

function findCaptureAllWinner(game, state, condition) {
  const watchedKinds = condition.pieceKinds ?? [condition.pieceKind];
  for (const player of game.players) {
    const remaining = countPieces(state, player.id, watchedKinds);
    if (remaining === 0) {
      const winner = game.players.find((candidate) => candidate.id !== player.id)?.id ?? null;
      if (winner) {
        return {
          outcome: 'win',
          winner,
          reason: `${player.name} の ${watchedKinds.join('/')} が盤上からなくなったため`,
        };
      }
    }
  }
  return null;
}

function findReachRowWinner(game, state, condition) {
  for (const piece of state.pieces) {
    if (piece.kind !== condition.pieceKind) {
      continue;
    }
    const targetRow = condition.targetRowByPlayer?.[piece.owner];
    if (Number.isInteger(targetRow) && piece.y === targetRow) {
      return {
        outcome: 'win',
        winner: piece.owner,
        reason: `${condition.pieceKind} が目標行に到達したため`,
      };
    }
  }
  return null;
}

function findNoLegalMoveWinner(game, state) {
  if (state.history.length === 0) {
    return null;
  }

  const actions = generateLegalActions(game, state, state.currentPlayer);
  if (actions.length > 0) {
    return null;
  }

  const winner = previousPlayerId(game, state.currentPlayer);
  return {
    outcome: 'win',
    winner,
    reason: `${getPlayer(game, state.currentPlayer)?.name ?? state.currentPlayer} に合法手がないため`,
  };
}

function findBoardFullDraw(game, state) {
  if (state.pieces.length === game.board.width * game.board.height) {
    return {
      outcome: 'draw',
      winner: null,
      reason: '盤面が埋まったため',
    };
  }
  return null;
}

function findMoveLimitDraw(state, condition) {
  if (state.history.length >= condition.maxMoves) {
    return {
      outcome: 'draw',
      winner: null,
      reason: `手数上限 ${condition.maxMoves} に達したため`,
    };
  }
  return null;
}

function findNoLegalMoveDraw(game, state) {
  const actions = generateLegalActions(game, state, state.currentPlayer);
  if (actions.length === 0) {
    return {
      outcome: 'draw',
      winner: null,
      reason: `${getPlayer(game, state.currentPlayer)?.name ?? state.currentPlayer} に合法手がないため`,
    };
  }
  return null;
}

export function getGameStatus(game, state) {
  for (const condition of game.termination.winConditions ?? []) {
    let result = null;

    switch (condition.type) {
      case 'line':
        result = findLineWinner(game, state, condition);
        break;
      case 'capture-all':
        result = findCaptureAllWinner(game, state, condition);
        break;
      case 'reach-row':
        result = findReachRowWinner(game, state, condition);
        break;
      case 'opponent-has-no-legal-moves':
        result = findNoLegalMoveWinner(game, state);
        break;
      default:
        result = null;
        break;
    }

    if (result) {
      return { isTerminal: true, ...result };
    }
  }

  for (const condition of game.termination.drawConditions ?? []) {
    let result = null;

    switch (condition.type) {
      case 'board-full':
        result = findBoardFullDraw(game, state);
        break;
      case 'move-limit':
        result = findMoveLimitDraw(state, condition);
        break;
      case 'no-legal-moves':
        result = findNoLegalMoveDraw(game, state);
        break;
      default:
        result = null;
        break;
    }

    if (result) {
      return { isTerminal: true, ...result };
    }
  }

  return {
    isTerminal: false,
    outcome: 'ongoing',
    winner: null,
    reason: null,
  };
}
