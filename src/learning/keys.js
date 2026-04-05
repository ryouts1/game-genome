import { serializeState } from '../core/state.js';

export function createStateKey(state) {
  return serializeState(state);
}

export function createActionKey(action) {
  if (!action) {
    return 'none';
  }

  if (action.type === 'place') {
    return [
      'place',
      action.playerId,
      action.pieceKind,
      `${action.to.x},${action.to.y}`,
    ].join('|');
  }

  if (action.type === 'move-piece') {
    return [
      'move-piece',
      action.playerId,
      action.pieceKind,
      `${action.from.x},${action.from.y}`,
      `${action.to.x},${action.to.y}`,
      action.capture ? `${action.capture.owner}:${action.capture.pieceKind}` : '-',
    ].join('|');
  }

  return JSON.stringify(action);
}
