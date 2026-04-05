import { buildBoardIndex, countPiecesByOwnerAndKind, getPieceAt } from './state.js';
import { coordinateLabel, getPlayer, inBounds, numericOrFallback } from './utils.js';

function transformVector(vector, player) {
  const [dx, dy] = vector;
  const forward = player?.forward ?? 1;
  return [dx, dy * forward];
}

function placementInventoryAllows(game, state, playerId, actionDef) {
  const inventory = actionDef.inventory;
  if (!inventory || inventory === 'unbounded') {
    return true;
  }

  const byPlayer = inventory.byPlayer ?? {};
  const limit = byPlayer[playerId];
  if (!Number.isFinite(limit)) {
    return true;
  }

  return countPiecesByOwnerAndKind(state, playerId, actionDef.pieceKind) < limit;
}

function matchesWhitelist(x, y, whitelist) {
  return (whitelist ?? []).some((cell) => cell.x === x && cell.y === y);
}

function isPlacementLegal(game, state, playerId, actionDef, x, y, boardIndex) {
  for (const constraint of actionDef.constraints ?? []) {
    switch (constraint.type) {
      case 'empty': {
        if (getPieceAt(state, x, y, boardIndex)) {
          return false;
        }
        break;
      }
      case 'gravity': {
        const pieceBelow = getPieceAt(state, x, y + 1, boardIndex);
        const onBottomRow = y === game.board.height - 1;
        if (!onBottomRow && !pieceBelow) {
          return false;
        }
        break;
      }
      case 'row-zone': {
        const allowedRows = constraint.rowsByPlayer?.[playerId] ?? constraint.rows ?? [];
        if (!allowedRows.includes(y)) {
          return false;
        }
        break;
      }
      case 'column-zone': {
        const allowedColumns = constraint.columnsByPlayer?.[playerId] ?? constraint.columns ?? [];
        if (!allowedColumns.includes(x)) {
          return false;
        }
        break;
      }
      case 'cell-whitelist': {
        if (!matchesWhitelist(x, y, constraint.cellsByPlayer?.[playerId] ?? constraint.cells)) {
          return false;
        }
        break;
      }
      default:
        break;
    }
  }

  return true;
}

function createPlacementAction(actionDef, playerId, x, y) {
  return {
    type: 'place',
    pieceKind: actionDef.pieceKind,
    playerId,
    to: { x, y },
    text: `${actionDef.pieceKind} -> ${coordinateLabel(x, y)}`,
  };
}

function generatePlaceActions(game, state, playerId, actionDef, boardIndex) {
  if (!placementInventoryAllows(game, state, playerId, actionDef)) {
    return [];
  }

  const actions = [];
  for (let y = 0; y < game.board.height; y += 1) {
    for (let x = 0; x < game.board.width; x += 1) {
      if (!isPlacementLegal(game, state, playerId, actionDef, x, y, boardIndex)) {
        continue;
      }
      actions.push(createPlacementAction(actionDef, playerId, x, y));
    }
  }
  return actions;
}

function matchesMoveMode(mode, occupant, owner) {
  if (!occupant) {
    return mode === 'move' || mode === 'move-or-capture';
  }

  if (occupant.owner === owner) {
    return false;
  }

  return mode === 'capture' || mode === 'move-or-capture';
}

function createMoveAction(piece, targetX, targetY, capturedPiece = null) {
  return {
    type: 'move-piece',
    pieceId: piece.id,
    pieceKind: piece.kind,
    playerId: piece.owner,
    from: { x: piece.x, y: piece.y },
    to: { x: targetX, y: targetY },
    capture: capturedPiece
      ? {
          pieceId: capturedPiece.id,
          pieceKind: capturedPiece.kind,
          owner: capturedPiece.owner,
        }
      : null,
    text: `${coordinateLabel(piece.x, piece.y)} -> ${coordinateLabel(targetX, targetY)}${capturedPiece ? ` x ${capturedPiece.kind}` : ''}`,
  };
}

function dedupeActions(actions) {
  const seen = new Set();
  return actions.filter((action) => {
    const key = [action.type, action.pieceId ?? action.pieceKind, action.from?.x ?? '-', action.from?.y ?? '-', action.to.x, action.to.y].join('|');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function generatePieceMoves(game, state, piece, player, boardIndex) {
  const pieceDef = game.pieceKinds[piece.kind];
  const actions = [];

  for (const pattern of pieceDef.movement ?? []) {
    const mode = pattern.mode ?? 'move-or-capture';
    const maxDistance = numericOrFallback(pattern.maxDistance, Infinity);

    for (const rawVector of pattern.vectors ?? []) {
      const [dx, dy] = pattern.orientation === 'forward' ? transformVector(rawVector, player) : rawVector;

      if (pattern.type === 'step') {
        const targetX = piece.x + dx;
        const targetY = piece.y + dy;
        if (!inBounds(game.board, targetX, targetY)) {
          continue;
        }
        const occupant = getPieceAt(state, targetX, targetY, boardIndex);
        if (!matchesMoveMode(mode, occupant, piece.owner)) {
          continue;
        }
        actions.push(createMoveAction(piece, targetX, targetY, occupant));
        continue;
      }

      if (pattern.type === 'ray') {
        for (let distance = 1; distance <= maxDistance; distance += 1) {
          const targetX = piece.x + dx * distance;
          const targetY = piece.y + dy * distance;
          if (!inBounds(game.board, targetX, targetY)) {
            break;
          }

          const occupant = getPieceAt(state, targetX, targetY, boardIndex);
          if (!occupant) {
            if (mode === 'move' || mode === 'move-or-capture') {
              actions.push(createMoveAction(piece, targetX, targetY, null));
            }
            continue;
          }

          if (occupant.owner === piece.owner) {
            break;
          }

          if (mode === 'capture' || mode === 'move-or-capture') {
            actions.push(createMoveAction(piece, targetX, targetY, occupant));
          }
          break;
        }
      }
    }
  }

  return dedupeActions(actions);
}

function generateMoveActions(game, state, playerId, actionDef, boardIndex) {
  const allowedPieceKinds = new Set(actionDef.pieceKinds ?? Object.keys(game.pieceKinds));
  const player = getPlayer(game, playerId);

  const candidatePieces = state.pieces.filter(
    (piece) => piece.owner === playerId && allowedPieceKinds.has(piece.kind),
  );

  return candidatePieces.flatMap((piece) => generatePieceMoves(game, state, piece, player, boardIndex));
}

export function generateLegalActions(game, state, playerId = state.currentPlayer) {
  const boardIndex = buildBoardIndex(state);
  const actions = [];

  for (const actionDef of game.actionCatalog) {
    if (actionDef.type === 'place') {
      actions.push(...generatePlaceActions(game, state, playerId, actionDef, boardIndex));
    }

    if (actionDef.type === 'move-piece') {
      actions.push(...generateMoveActions(game, state, playerId, actionDef, boardIndex));
    }
  }

  return actions;
}
