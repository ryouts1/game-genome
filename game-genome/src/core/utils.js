export function coordKey(x, y) {
  return `${x},${y}`;
}

export function inBounds(board, x, y) {
  return x >= 0 && x < board.width && y >= 0 && y < board.height;
}

export function nextPlayerId(game, currentPlayerId) {
  const order = game.turnOrder;
  const currentIndex = order.indexOf(currentPlayerId);
  const nextIndex = (currentIndex + 1) % order.length;
  return order[nextIndex];
}

export function previousPlayerId(game, currentPlayerId) {
  const order = game.turnOrder;
  const currentIndex = order.indexOf(currentPlayerId);
  const previousIndex = (currentIndex - 1 + order.length) % order.length;
  return order[previousIndex];
}

export function getPlayer(game, playerId) {
  return game.players.find((player) => player.id === playerId);
}

export function clone(value) {
  return structuredClone(value);
}

export function columnLabel(index) {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

export function coordinateLabel(x, y) {
  return `${columnLabel(x)}${y + 1}`;
}

export function summarizeArray(items) {
  return items.filter(Boolean).join(', ');
}

export function normalizeVectors(vectors) {
  return Array.isArray(vectors) ? vectors : [];
}

export function directionVectors(directionSet) {
  if (Array.isArray(directionSet)) {
    return directionSet;
  }

  switch (directionSet) {
    case 'orthogonal':
      return [[1, 0], [0, 1]];
    case 'diagonal':
      return [[1, 1], [1, -1]];
    case 'orthogonal+diagonal':
    case 'all':
    default:
      return [[1, 0], [0, 1], [1, 1], [1, -1]];
  }
}

export function numericOrFallback(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
