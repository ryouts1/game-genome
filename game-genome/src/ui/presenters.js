import { getPieceAt } from '../core/state.js';
import { columnLabel, coordinateLabel, getPlayer } from '../core/utils.js';

function cellHasAction(actions, predicate) {
  return actions.some(predicate);
}

function visualSlot(game, playerId) {
  return game.players[0]?.id === playerId ? 'P1' : 'P2';
}

function pieceDisplay(game, piece) {
  const pieceDef = game.pieceKinds[piece.kind];
  return {
    symbol: pieceDef.symbolByPlayer?.[piece.owner] ?? pieceDef.defaultSymbol ?? piece.kind.slice(0, 1).toUpperCase(),
    label: pieceDef.shortLabel ?? pieceDef.label ?? piece.kind,
  };
}

export function renderBoard({ container, game, state, legalActions, selectedPieceId, onCellClick }) {
  container.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'board-grid';
  board.style.gridTemplateColumns = `repeat(${game.board.width}, minmax(64px, 1fr))`;

  for (let y = 0; y < game.board.height; y += 1) {
    for (let x = 0; x < game.board.width; x += 1) {
      const piece = getPieceAt(state, x, y);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'board-cell';

      const coordinate = document.createElement('span');
      coordinate.className = 'cell-coordinate';
      coordinate.textContent = `${columnLabel(x)}${y + 1}`;
      cell.append(coordinate);

      const matchingTargets = legalActions.filter((action) => action.to.x === x && action.to.y === y);
      const matchingMovesFromSelected = legalActions.filter(
        (action) => action.type === 'move-piece' && action.pieceId === selectedPieceId && action.to.x === x && action.to.y === y,
      );
      const hasGravityPlacement = game.actionCatalog.some(
        (action) => action.type === 'place' && (action.constraints ?? []).some((constraint) => constraint.type === 'gravity'),
      );
      const selectablePiece = piece && piece.owner === state.currentPlayer
        && cellHasAction(legalActions, (action) => action.type === 'move-piece' && action.pieceId === piece.id);
      const directPlacement = matchingTargets.some((action) => action.type === 'place');
      const gravityPlacementInColumn = hasGravityPlacement && legalActions.some((action) => action.type === 'place' && action.to.x === x);

      if (selectedPieceId && matchingMovesFromSelected.length > 0) {
        cell.classList.add('is-target', 'is-clickable');
      } else if (!selectedPieceId && (directPlacement || gravityPlacementInColumn || selectablePiece)) {
        cell.classList.add('is-clickable');
      }

      if (matchingMovesFromSelected.some((action) => action.capture)) {
        cell.classList.add('is-capture-target');
      }

      if (state.lastAction?.to.x === x && state.lastAction?.to.y === y) {
        cell.classList.add('is-last-move');
      }

      if (piece && piece.id === selectedPieceId) {
        cell.classList.add('is-selected');
      }

      if (piece) {
        const display = pieceDisplay(game, piece);
        cell.classList.add(`piece-owner-${visualSlot(game, piece.owner)}`);

        const symbol = document.createElement('span');
        symbol.className = 'piece-symbol';
        symbol.textContent = display.symbol;
        cell.append(symbol);

        const label = document.createElement('span');
        label.className = 'piece-label';
        label.textContent = display.label;
        cell.append(label);
      }

      cell.addEventListener('click', () => onCellClick(x, y));
      board.append(cell);
    }
  }

  container.append(board);
}

export function renderLegend(container, game) {
  container.innerHTML = '';
  for (const player of game.players) {
    for (const [pieceKindId, pieceKind] of Object.entries(game.pieceKinds)) {
      const row = document.createElement('div');
      row.className = 'legend-row';

      const chip = document.createElement('span');
      chip.className = 'legend-chip';
      chip.textContent = pieceKind.symbolByPlayer?.[player.id] ?? pieceKind.defaultSymbol ?? pieceKindId[0].toUpperCase();
      chip.style.color = visualSlot(game, player.id) === 'P1' ? 'var(--p1)' : 'var(--p2)';
      row.append(chip);

      const text = document.createElement('span');
      text.textContent = `${player.name} / ${pieceKind.label ?? pieceKindId}`;
      row.append(text);
      container.append(row);
    }
  }
}

export function renderFeatureList(container, items) {
  container.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    container.append(li);
  }
}

export function renderRuleSummary(container, game) {
  container.innerHTML = '';
  const blocks = [
    `盤面サイズ: ${game.board.width} x ${game.board.height}`,
    `行動: ${game.actionCatalog.map((action) => {
      if (action.type === 'place') {
        return `${action.pieceKind} を配置`;
      }
      return `${(action.pieceKinds ?? Object.keys(game.pieceKinds)).join('/')} を移動`;
    }).join(' / ')}`,
    `勝利条件: ${(game.termination.winConditions ?? []).map((condition) => condition.label ?? condition.type).join(' / ')}`,
    `引き分け: ${(game.termination.drawConditions ?? []).map((condition) => condition.label ?? condition.type).join(' / ') || 'なし'}`,
  ];

  for (const text of blocks) {
    const p = document.createElement('p');
    p.className = 'rule-item';
    p.textContent = text;
    container.append(p);
  }
}

export function renderMoveLog(container, game, history) {
  container.innerHTML = '';
  if (history.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'まだ手は記録されていません。';
    container.append(li);
    return;
  }

  history.forEach((entry, index) => {
    const li = document.createElement('li');
    const player = getPlayer(game, entry.playerId);
    li.innerHTML = `<strong>${index + 1}. ${player?.name ?? entry.playerId}</strong><br />${entry.text}`;
    container.append(li);
  });
}

export function describeBoardHint(game, state, legalActions, selectedPieceId) {
  if (selectedPieceId) {
    return '移動先のセルをクリックしてください。別の自駒を押すと選択し直せます。';
  }

  const hasPlacement = legalActions.some((action) => action.type === 'place');
  const hasMovement = legalActions.some((action) => action.type === 'move-piece');

  if (hasPlacement && hasMovement) {
    return '空きマスへの配置、または自駒の選択ができます。';
  }
  if (hasPlacement) {
    return '合法な配置先をクリックしてください。重力ルールがあるゲームでは列を押すだけで着地します。';
  }
  if (hasMovement) {
    return '自駒を選択してから移動先をクリックしてください。';
  }
  return '合法手がありません。';
}

export function describeStatus(game, state, status, controllers, aiBusy) {
  const currentPlayer = getPlayer(game, state.currentPlayer);
  if (status.isTerminal) {
    if (status.outcome === 'draw') {
      return `引き分け: ${status.reason}`;
    }
    const winner = getPlayer(game, status.winner);
    return `${winner?.name ?? status.winner} の勝ち: ${status.reason}`;
  }

  const controller = controllers[state.currentPlayer];
  const controllerLabel = controller === 'human' ? 'Human' : controller.toUpperCase();
  const suffix = aiBusy ? ' / AI 思考中' : '';
  return `${currentPlayer?.name ?? state.currentPlayer} の手番 (${controllerLabel})${suffix}`;
}

export function describeTurnIndicator(game, state) {
  const player = getPlayer(game, state.currentPlayer);
  return `${player?.name ?? state.currentPlayer} to move`;
}

export function findColumnGravityAction(actions, x) {
  return actions.find((action) => action.type === 'place' && action.to.x === x);
}
