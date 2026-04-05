const ALLOWED_ACTION_TYPES = new Set(['place', 'move-piece']);
const ALLOWED_MOVEMENT_TYPES = new Set(['step', 'ray']);
const ALLOWED_MOVEMENT_MODES = new Set(['move', 'capture', 'move-or-capture']);
const ALLOWED_PLACEMENT_CONSTRAINTS = new Set(['empty', 'gravity', 'row-zone', 'column-zone', 'cell-whitelist']);
const ALLOWED_WIN_CONDITIONS = new Set(['line', 'capture-all', 'reach-row', 'opponent-has-no-legal-moves']);
const ALLOWED_DRAW_CONDITIONS = new Set(['board-full', 'move-limit', 'no-legal-moves']);

export function validateGameDefinition(rawGame) {
  const errors = [];

  if (!rawGame || typeof rawGame !== 'object') {
    return ['Game definition must be an object.'];
  }

  if (!rawGame.id) {
    errors.push('Game definition requires an id.');
  }

  if (!rawGame.name) {
    errors.push('Game definition requires a name.');
  }

  if (!rawGame.board || !Number.isInteger(rawGame.board.width) || !Number.isInteger(rawGame.board.height)) {
    errors.push('Board width and height must be integers.');
  }

  if (!Array.isArray(rawGame.players) || rawGame.players.length !== 2) {
    errors.push('Exactly two players are required in the current engine scope.');
  }

  if (!rawGame.pieceKinds || typeof rawGame.pieceKinds !== 'object') {
    errors.push('pieceKinds must be an object.');
  }

  if (!Array.isArray(rawGame.actionCatalog) || rawGame.actionCatalog.length === 0) {
    errors.push('actionCatalog must define at least one action.');
  }

  const playerIds = new Set((rawGame.players ?? []).map((player) => player.id));
  const pieceKindIds = new Set(Object.keys(rawGame.pieceKinds ?? {}));

  if (Array.isArray(rawGame.players)) {
    for (const player of rawGame.players) {
      if (!player.id) {
        errors.push('Each player requires an id.');
      }
      if (![1, -1].includes(player.forward)) {
        errors.push(`Player ${player.id ?? '(unknown)'} requires forward = 1 or -1.`);
      }
    }
  }

  rawGame.turnOrder = rawGame.turnOrder ?? (rawGame.players ?? []).map((player) => player.id);
  if (!Array.isArray(rawGame.turnOrder) || rawGame.turnOrder.length !== (rawGame.players ?? []).length) {
    errors.push('turnOrder must list each player exactly once.');
  } else {
    const turnOrderSet = new Set(rawGame.turnOrder);
    if (turnOrderSet.size !== rawGame.turnOrder.length) {
      errors.push('turnOrder must not contain duplicates.');
    }
    for (const playerId of rawGame.turnOrder) {
      if (!playerIds.has(playerId)) {
        errors.push(`turnOrder references unknown player: ${playerId}`);
      }
    }
  }

  for (const action of rawGame.actionCatalog ?? []) {
    if (!ALLOWED_ACTION_TYPES.has(action.type)) {
      errors.push(`Unsupported action type: ${action.type}`);
      continue;
    }

    if (action.type === 'place') {
      if (!pieceKindIds.has(action.pieceKind)) {
        errors.push(`Place action references unknown piece kind: ${action.pieceKind}`);
      }

      for (const constraint of action.constraints ?? []) {
        if (!ALLOWED_PLACEMENT_CONSTRAINTS.has(constraint.type)) {
          errors.push(`Unsupported placement constraint: ${constraint.type}`);
        }
      }
    }

    if (action.type === 'move-piece') {
      const targetKinds = action.pieceKinds ?? Object.keys(rawGame.pieceKinds ?? {});
      for (const pieceKind of targetKinds) {
        if (!pieceKindIds.has(pieceKind)) {
          errors.push(`Move action references unknown piece kind: ${pieceKind}`);
        }
      }
    }
  }

  for (const [pieceKindId, pieceKind] of Object.entries(rawGame.pieceKinds ?? {})) {
    for (const pattern of pieceKind.movement ?? []) {
      if (!ALLOWED_MOVEMENT_TYPES.has(pattern.type)) {
        errors.push(`Piece ${pieceKindId} uses unsupported movement type: ${pattern.type}`);
      }
      if (!ALLOWED_MOVEMENT_MODES.has(pattern.mode ?? 'move-or-capture')) {
        errors.push(`Piece ${pieceKindId} uses unsupported movement mode: ${pattern.mode}`);
      }
      if (!Array.isArray(pattern.vectors) || pattern.vectors.length === 0) {
        errors.push(`Piece ${pieceKindId} movement requires at least one vector.`);
      }
    }
  }

  for (const piece of rawGame.initialState?.pieces ?? []) {
    if (!playerIds.has(piece.owner)) {
      errors.push(`Initial state piece references unknown owner: ${piece.owner}`);
    }
    if (!pieceKindIds.has(piece.kind)) {
      errors.push(`Initial state piece references unknown kind: ${piece.kind}`);
    }
    if (!Number.isInteger(piece.x) || !Number.isInteger(piece.y)) {
      errors.push(`Initial state piece uses non-integer coordinates: ${piece.kind}`);
    } else if (rawGame.board && (piece.x < 0 || piece.x >= rawGame.board.width || piece.y < 0 || piece.y >= rawGame.board.height)) {
      errors.push(`Initial state piece is out of bounds: ${piece.kind} at ${piece.x},${piece.y}`);
    }
  }

  const occupancy = new Set();
  for (const piece of rawGame.initialState?.pieces ?? []) {
    const key = `${piece.x},${piece.y}`;
    if (occupancy.has(key)) {
      errors.push(`Initial state has overlapping pieces at ${key}.`);
    }
    occupancy.add(key);
  }

  if (!rawGame.termination || !Array.isArray(rawGame.termination.winConditions)) {
    errors.push('termination.winConditions must be defined.');
  }

  for (const condition of rawGame.termination?.winConditions ?? []) {
    if (!ALLOWED_WIN_CONDITIONS.has(condition.type)) {
      errors.push(`Unsupported win condition: ${condition.type}`);
    }
  }

  for (const condition of rawGame.termination?.drawConditions ?? []) {
    if (!ALLOWED_DRAW_CONDITIONS.has(condition.type)) {
      errors.push(`Unsupported draw condition: ${condition.type}`);
    }
  }

  return errors;
}

export function normalizeGameDefinition(rawGame) {
  const game = structuredClone(rawGame);
  game.turnOrder = game.turnOrder ?? game.players.map((player) => player.id);
  game.evaluation = game.evaluation ?? {};
  game.evaluation.weights = game.evaluation.weights ?? {};
  return game;
}

export function loadGameDefinition(rawGame) {
  const errors = validateGameDefinition(rawGame);
  if (errors.length > 0) {
    const message = errors.map((error, index) => `${index + 1}. ${error}`).join('\n');
    throw new Error(`Invalid game definition:\n${message}`);
  }
  return normalizeGameDefinition(rawGame);
}
