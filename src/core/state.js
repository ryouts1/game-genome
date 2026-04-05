import { clone, coordKey } from './utils.js';

export function createInitialState(game) {
  const pieces = (game.initialState?.pieces ?? []).map((piece, index) => ({
    id: piece.id ?? `piece-${index + 1}`,
    kind: piece.kind,
    owner: piece.owner,
    x: piece.x,
    y: piece.y,
  }));

  return {
    pieces,
    currentPlayer: game.turnOrder[0],
    history: [],
    nextPieceSerial: pieces.length + 1,
    lastAction: null,
  };
}

export function cloneState(state) {
  return clone(state);
}

export function buildBoardIndex(state) {
  const index = new Map();
  for (const piece of state.pieces) {
    index.set(coordKey(piece.x, piece.y), piece);
  }
  return index;
}

export function getPieceAt(state, x, y, boardIndex = null) {
  const index = boardIndex ?? buildBoardIndex(state);
  return index.get(coordKey(x, y)) ?? null;
}

export function listPiecesByOwner(state, owner) {
  return state.pieces.filter((piece) => piece.owner === owner);
}

export function countPiecesByOwnerAndKind(state, owner, kind) {
  return state.pieces.filter((piece) => piece.owner === owner && piece.kind === kind).length;
}

export function createPiece(state, pieceKind, owner, x, y) {
  const piece = {
    id: `piece-${state.nextPieceSerial}`,
    kind: pieceKind,
    owner,
    x,
    y,
  };

  state.nextPieceSerial += 1;
  state.pieces.push(piece);
  return piece;
}

export function serializeState(state) {
  const orderedPieces = [...state.pieces]
    .sort((left, right) => {
      const leftKey = `${left.owner}|${left.kind}|${left.x}|${left.y}|${left.id}`;
      const rightKey = `${right.owner}|${right.kind}|${right.x}|${right.y}|${right.id}`;
      return leftKey.localeCompare(rightKey);
    })
    .map((piece) => `${piece.owner}:${piece.kind}@${piece.x},${piece.y}`)
    .join(';');

  return `${state.currentPlayer}|${orderedPieces}`;
}
