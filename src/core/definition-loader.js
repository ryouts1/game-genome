const ALLOWED_ACTION_TYPES = new Set(['place', 'move-piece']);
const ALLOWED_MOVEMENT_TYPES = new Set(['step', 'ray']);
const ALLOWED_MOVEMENT_MODES = new Set(['move', 'capture', 'move-or-capture']);
const ALLOWED_PLACEMENT_CONSTRAINTS = new Set(['empty', 'gravity', 'row-zone', 'column-zone', 'cell-whitelist']);
const ALLOWED_WIN_CONDITIONS = new Set(['line', 'capture-all', 'reach-row', 'opponent-has-no-legal-moves']);
const ALLOWED_DRAW_CONDITIONS = new Set(['board-full', 'move-limit', 'no-legal-moves']);

function createDiagnostic(level, path, message) {
  return {
    level,
    path,
    message,
  };
}

function pushError(errors, path, message) {
  errors.push(createDiagnostic('error', path, message));
}

function pushWarning(warnings, path, message) {
  warnings.push(createDiagnostic('warning', path, message));
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function formatPath(path) {
  return path || '(root)';
}

export function formatDiagnostic(diagnostic) {
  return `${diagnostic.level.toUpperCase()} ${formatPath(diagnostic.path)}: ${diagnostic.message}`;
}

export function collectDefinitionDiagnostics(rawGame) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(rawGame)) {
    pushError(errors, '', 'ゲーム定義は object である必要があります。');
    return { errors, warnings, all: [...errors, ...warnings] };
  }

  if (typeof rawGame.id !== 'string' || rawGame.id.trim() === '') {
    pushError(errors, 'id', 'id は空でない文字列が必要です。');
  }

  if (typeof rawGame.name !== 'string' || rawGame.name.trim() === '') {
    pushError(errors, 'name', 'name は空でない文字列が必要です。');
  }

  if (typeof rawGame.description !== 'string' || rawGame.description.trim() === '') {
    pushWarning(warnings, 'description', 'description が空です。カタログ表示や README での説明が弱くなります。');
  }

  if (!isPlainObject(rawGame.board)) {
    pushError(errors, 'board', 'board は width / height を持つ object が必要です。');
  } else {
    if (!Number.isInteger(rawGame.board.width) || rawGame.board.width < 1) {
      pushError(errors, 'board.width', 'board.width は 1 以上の整数が必要です。');
    }
    if (!Number.isInteger(rawGame.board.height) || rawGame.board.height < 1) {
      pushError(errors, 'board.height', 'board.height は 1 以上の整数が必要です。');
    }
    if (Number.isInteger(rawGame.board.width) && Number.isInteger(rawGame.board.height) && rawGame.board.width * rawGame.board.height > 100) {
      pushWarning(warnings, 'board', '盤面が大きいため、ブラウザ上の Minimax は重くなりやすいです。');
    }
  }

  if (!Array.isArray(rawGame.players) || rawGame.players.length !== 2) {
    pushError(errors, 'players', '現在の engine scope では 2 人対戦のみ対応しています。');
  }

  const players = Array.isArray(rawGame.players) ? rawGame.players : [];
  const playerIds = new Set();

  players.forEach((player, index) => {
    const path = `players[${index}]`;
    if (!isPlainObject(player)) {
      pushError(errors, path, 'player は object が必要です。');
      return;
    }
    if (typeof player.id !== 'string' || player.id.trim() === '') {
      pushError(errors, `${path}.id`, 'player.id は空でない文字列が必要です。');
    } else if (playerIds.has(player.id)) {
      pushError(errors, `${path}.id`, `player.id "${player.id}" が重複しています。`);
    } else {
      playerIds.add(player.id);
    }

    if (typeof player.name !== 'string' || player.name.trim() === '') {
      pushWarning(warnings, `${path}.name`, 'player.name が空です。UI では id を代用します。');
    }

    if (![1, -1].includes(player.forward)) {
      pushError(errors, `${path}.forward`, 'forward は 1 または -1 が必要です。');
    }
  });

  const normalizedTurnOrder = Array.isArray(rawGame.turnOrder)
    ? rawGame.turnOrder
    : players.map((player) => player.id).filter(Boolean);

  if (!Array.isArray(normalizedTurnOrder) || normalizedTurnOrder.length !== players.length) {
    pushError(errors, 'turnOrder', 'turnOrder は各 player を一度ずつ並べた配列である必要があります。');
  } else {
    const turnOrderSeen = new Set();
    normalizedTurnOrder.forEach((playerId, index) => {
      if (turnOrderSeen.has(playerId)) {
        pushError(errors, `turnOrder[${index}]`, `turnOrder に重複した player id "${playerId}" があります。`);
      }
      turnOrderSeen.add(playerId);

      if (!playerIds.has(playerId)) {
        pushError(errors, `turnOrder[${index}]`, `turnOrder が未知の player id "${playerId}" を参照しています。`);
      }
    });
  }

  if (!isPlainObject(rawGame.pieceKinds) || Object.keys(rawGame.pieceKinds).length === 0) {
    pushError(errors, 'pieceKinds', 'pieceKinds は 1 つ以上の駒種を持つ object が必要です。');
  }

  const pieceKindIds = new Set(Object.keys(isPlainObject(rawGame.pieceKinds) ? rawGame.pieceKinds : {}));

  Object.entries(isPlainObject(rawGame.pieceKinds) ? rawGame.pieceKinds : {}).forEach(([pieceKindId, pieceKind]) => {
    const path = `pieceKinds.${pieceKindId}`;
    if (!isPlainObject(pieceKind)) {
      pushError(errors, path, 'piece kind は object が必要です。');
      return;
    }

    if (!pieceKind.label) {
      pushWarning(warnings, `${path}.label`, 'label がないため、UI は piece kind id を表示します。');
    }

    if (!pieceKind.defaultSymbol && !pieceKind.symbolByPlayer) {
      pushWarning(warnings, `${path}.symbolByPlayer`, '記号が未設定のため、UI では piece kind 名の先頭文字を使います。');
    }

    const movement = pieceKind.movement ?? [];
    if (!Array.isArray(movement)) {
      pushError(errors, `${path}.movement`, 'movement は配列である必要があります。');
      return;
    }

    movement.forEach((pattern, patternIndex) => {
      const patternPath = `${path}.movement[${patternIndex}]`;
      if (!ALLOWED_MOVEMENT_TYPES.has(pattern.type)) {
        pushError(errors, `${patternPath}.type`, `未対応の movement type "${pattern.type}" です。`);
      }
      if (!ALLOWED_MOVEMENT_MODES.has(pattern.mode ?? 'move-or-capture')) {
        pushError(errors, `${patternPath}.mode`, `未対応の movement mode "${pattern.mode}" です。`);
      }
      if (!Array.isArray(pattern.vectors) || pattern.vectors.length === 0) {
        pushError(errors, `${patternPath}.vectors`, 'vectors は 1 つ以上必要です。');
      } else {
        pattern.vectors.forEach((vector, vectorIndex) => {
          if (!Array.isArray(vector) || vector.length !== 2 || !vector.every(Number.isInteger)) {
            pushError(errors, `${patternPath}.vectors[${vectorIndex}]`, 'vector は [dx, dy] の整数配列が必要です。');
          }
        });
      }
      if (pattern.maxDistance !== undefined && (!Number.isInteger(pattern.maxDistance) || pattern.maxDistance < 1)) {
        pushError(errors, `${patternPath}.maxDistance`, 'maxDistance は 1 以上の整数が必要です。');
      }
    });

    if (!isPlainObject(pieceKind.evaluation)) {
      pushWarning(warnings, `${path}.evaluation`, 'evaluation.value が未設定です。AI は既定値 1 を使います。');
    }
  });

  if (!Array.isArray(rawGame.actionCatalog) || rawGame.actionCatalog.length === 0) {
    pushError(errors, 'actionCatalog', 'actionCatalog は 1 つ以上の action definition が必要です。');
  }

  (rawGame.actionCatalog ?? []).forEach((action, index) => {
    const path = `actionCatalog[${index}]`;
    if (!ALLOWED_ACTION_TYPES.has(action.type)) {
      pushError(errors, `${path}.type`, `未対応の action type "${action.type}" です。`);
      return;
    }

    if (action.type === 'place') {
      if (!pieceKindIds.has(action.pieceKind)) {
        pushError(errors, `${path}.pieceKind`, `未知の piece kind "${action.pieceKind}" を参照しています。`);
      }

      (action.constraints ?? []).forEach((constraint, constraintIndex) => {
        const constraintPath = `${path}.constraints[${constraintIndex}]`;
        if (!ALLOWED_PLACEMENT_CONSTRAINTS.has(constraint.type)) {
          pushError(errors, `${constraintPath}.type`, `未対応の placement constraint "${constraint.type}" です。`);
        }
      });

      const inventoryByPlayer = action.inventory?.byPlayer ?? {};
      Object.entries(inventoryByPlayer).forEach(([playerId, count]) => {
        if (!playerIds.has(playerId)) {
          pushError(errors, `${path}.inventory.byPlayer.${playerId}`, `未知の player id "${playerId}" です。`);
        }
        if (!Number.isInteger(count) || count < 0) {
          pushError(errors, `${path}.inventory.byPlayer.${playerId}`, 'inventory は 0 以上の整数が必要です。');
        }
      });
    }

    if (action.type === 'move-piece') {
      const targetKinds = action.pieceKinds ?? Object.keys(rawGame.pieceKinds ?? {});
      targetKinds.forEach((pieceKind, pieceIndex) => {
        if (!pieceKindIds.has(pieceKind)) {
          pushError(errors, `${path}.pieceKinds[${pieceIndex}]`, `未知の piece kind "${pieceKind}" を参照しています。`);
        }
      });
      if (targetKinds.length === 0) {
        pushWarning(warnings, path, 'pieceKinds が空です。実質的に動かせる駒がなくなります。');
      }
    }
  });

  const occupancy = new Set();
  (rawGame.initialState?.pieces ?? []).forEach((piece, index) => {
    const path = `initialState.pieces[${index}]`;
    if (!playerIds.has(piece.owner)) {
      pushError(errors, `${path}.owner`, `未知の player id "${piece.owner}" です。`);
    }
    if (!pieceKindIds.has(piece.kind)) {
      pushError(errors, `${path}.kind`, `未知の piece kind "${piece.kind}" です。`);
    }
    if (!Number.isInteger(piece.x) || !Number.isInteger(piece.y)) {
      pushError(errors, path, 'x / y は整数が必要です。');
    } else if (
      rawGame.board
      && (piece.x < 0 || piece.x >= rawGame.board.width || piece.y < 0 || piece.y >= rawGame.board.height)
    ) {
      pushError(errors, path, `初期配置が盤外です (${piece.x}, ${piece.y})。`);
    }

    const key = `${piece.x},${piece.y}`;
    if (occupancy.has(key)) {
      pushError(errors, path, `初期配置が重複しています (${key})。`);
    }
    occupancy.add(key);
  });

  if (!isPlainObject(rawGame.termination) || !Array.isArray(rawGame.termination.winConditions) || rawGame.termination.winConditions.length === 0) {
    pushError(errors, 'termination.winConditions', 'winConditions は 1 つ以上必要です。');
  }

  (rawGame.termination?.winConditions ?? []).forEach((condition, index) => {
    const path = `termination.winConditions[${index}]`;
    if (!ALLOWED_WIN_CONDITIONS.has(condition.type)) {
      pushError(errors, `${path}.type`, `未対応の win condition "${condition.type}" です。`);
      return;
    }

    if (condition.type === 'line') {
      if (!pieceKindIds.has(condition.pieceKind)) {
        pushError(errors, `${path}.pieceKind`, `未知の piece kind "${condition.pieceKind}" です。`);
      }
      if (!Number.isInteger(condition.length) || condition.length < 2) {
        pushError(errors, `${path}.length`, 'line condition の length は 2 以上の整数が必要です。');
      } else if (rawGame.board && condition.length > Math.max(rawGame.board.width, rawGame.board.height)) {
        pushWarning(warnings, `${path}.length`, '盤面より長い line 条件です。勝利が発生しない可能性があります。');
      }
    }

    if (condition.type === 'capture-all') {
      const watchedKinds = condition.pieceKinds ?? [condition.pieceKind];
      watchedKinds.forEach((pieceKind, watchedIndex) => {
        if (!pieceKindIds.has(pieceKind)) {
          pushError(errors, `${path}.pieceKinds[${watchedIndex}]`, `未知の piece kind "${pieceKind}" です。`);
        }
      });
    }

    if (condition.type === 'reach-row') {
      if (!pieceKindIds.has(condition.pieceKind)) {
        pushError(errors, `${path}.pieceKind`, `未知の piece kind "${condition.pieceKind}" です。`);
      }
      Object.entries(condition.targetRowByPlayer ?? {}).forEach(([playerId, row]) => {
        if (!playerIds.has(playerId)) {
          pushError(errors, `${path}.targetRowByPlayer.${playerId}`, `未知の player id "${playerId}" です。`);
        }
        if (!Number.isInteger(row)) {
          pushError(errors, `${path}.targetRowByPlayer.${playerId}`, 'target row は整数が必要です。');
        }
      });
    }
  });

  (rawGame.termination?.drawConditions ?? []).forEach((condition, index) => {
    const path = `termination.drawConditions[${index}]`;
    if (!ALLOWED_DRAW_CONDITIONS.has(condition.type)) {
      pushError(errors, `${path}.type`, `未対応の draw condition "${condition.type}" です。`);
    }

    if (condition.type === 'move-limit' && (!Number.isInteger(condition.maxMoves) || condition.maxMoves < 1)) {
      pushError(errors, `${path}.maxMoves`, 'move-limit の maxMoves は 1 以上の整数が必要です。');
    }
  });

  if ((rawGame.termination?.drawConditions ?? []).length === 0) {
    pushWarning(warnings, 'termination.drawConditions', 'draw 条件がありません。長手数ゲームでは終局しない局面がありえます。');
  }

  if ((rawGame.actionCatalog ?? []).some((action) => action.type === 'move-piece')
    && !(rawGame.termination?.drawConditions ?? []).some((condition) => condition.type === 'move-limit')) {
    pushWarning(warnings, 'termination.drawConditions', '移動型ゲームに move-limit がないため、長い千日手が起きると扱いづらくなります。');
  }

  return {
    errors,
    warnings,
    all: [...errors, ...warnings],
  };
}

export function validateGameDefinition(rawGame) {
  return collectDefinitionDiagnostics(rawGame).errors.map(formatDiagnostic);
}

export function normalizeGameDefinition(rawGame) {
  const game = structuredClone(rawGame);
  game.description = game.description ?? '';
  game.turnOrder = Array.isArray(game.turnOrder)
    ? game.turnOrder
    : (game.players ?? []).map((player) => player.id);

  game.evaluation = game.evaluation ?? {};
  game.evaluation.weights = {
    material: 1,
    mobility: 0.08,
    centerControl: 0.06,
    advancement: 0.12,
    linePotential: 1.3,
    ...(game.evaluation.weights ?? {}),
  };

  for (const [pieceKindId, pieceKind] of Object.entries(game.pieceKinds ?? {})) {
    pieceKind.label = pieceKind.label ?? pieceKindId;
    pieceKind.shortLabel = pieceKind.shortLabel ?? pieceKind.label;
    pieceKind.evaluation = pieceKind.evaluation ?? { value: 1 };
  }

  game.actionCatalog = (game.actionCatalog ?? []).map((action) => ({
    ...action,
    constraints: action.constraints ?? [],
  }));

  game.initialState = game.initialState ?? { pieces: [] };
  game.initialState.pieces = game.initialState.pieces ?? [];
  game.termination = game.termination ?? { winConditions: [], drawConditions: [] };
  game.termination.winConditions = game.termination.winConditions ?? [];
  game.termination.drawConditions = game.termination.drawConditions ?? [];

  return game;
}

export function loadGameDefinition(rawGame) {
  const diagnostics = collectDefinitionDiagnostics(rawGame);
  if (diagnostics.errors.length > 0) {
    const message = diagnostics.errors.map((diagnostic, index) => `${index + 1}. ${formatDiagnostic(diagnostic)}`).join('\n');
    throw new Error(`Invalid game definition:\n${message}`);
  }

  return normalizeGameDefinition(rawGame);
}
