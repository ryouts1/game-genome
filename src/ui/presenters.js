import { getPieceAt } from '../core/state.js';
import { columnLabel, formatSignedNumber, getPlayer } from '../core/utils.js';

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

function formatDraftTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function renderBoard({ container, game, state, legalActions, selectedPieceId, onCellClick }) {
  container.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'board-grid';
  board.style.gridTemplateColumns = `repeat(${game.board.width}, minmax(68px, 1fr))`;

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

export function renderBadgeList(container, items, emptyText = '情報なし') {
  container.innerHTML = '';
  if (!items.length) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = emptyText;
    container.append(badge);
    return;
  }

  items.forEach((item) => {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = item;
    container.append(badge);
  });
}

export function renderFeatureList(container, items) {
  container.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    container.append(li);
  }

  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = 'この定義には追加説明がありません。';
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

    const heading = document.createElement('strong');
    heading.textContent = `${index + 1}. ${player?.name ?? entry.playerId}`;
    li.append(heading);

    const text = document.createElement('div');
    text.textContent = entry.text;
    li.append(text);

    container.append(li);
  });
}

export function renderMetricGrid(container, metrics) {
  container.innerHTML = '';
  for (const metric of metrics) {
    const card = document.createElement('div');
    card.className = 'metric-card';

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = metric.label;
    card.append(label);

    const value = document.createElement('span');
    value.className = 'value';
    value.textContent = metric.value;
    card.append(value);

    if (metric.subtle) {
      const subtle = document.createElement('span');
      subtle.className = 'subtle';
      subtle.textContent = metric.subtle;
      card.append(subtle);
    }

    container.append(card);
  }

  if (!metrics.length) {
    const card = document.createElement('div');
    card.className = 'metric-card';

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = '情報';
    card.append(label);

    const value = document.createElement('span');
    value.className = 'value';
    value.textContent = '-';
    card.append(value);

    container.append(card);
  }
}

export function renderDiagnostics(container, diagnostics) {
  container.innerHTML = '';

  if (!diagnostics.length) {
    const li = document.createElement('li');
    li.className = 'diagnostic-item success';
    li.textContent = 'エラーは見つかりませんでした。';
    container.append(li);
    return;
  }

  diagnostics.forEach((diagnostic) => {
    const li = document.createElement('li');
    li.className = `diagnostic-item ${diagnostic.level}`;

    const path = document.createElement('span');
    path.className = 'diagnostic-path';
    path.textContent = diagnostic.path || '(root)';
    li.append(path);

    const text = document.createElement('span');
    text.textContent = diagnostic.message;
    li.append(text);

    container.append(li);
  });
}

export function renderTextList(container, items, emptyText = '情報はありません。') {
  container.innerHTML = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = emptyText;
    container.append(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    container.append(li);
  });
}

export function renderDraftList(container, drafts, handlers = {}) {
  container.innerHTML = '';

  if (!drafts.length) {
    const li = document.createElement('li');
    li.className = 'draft-item empty';
    li.textContent = 'まだスナップショットはありません。編集途中の版を残したいときに使えます。';
    container.append(li);
    return;
  }

  drafts.forEach((draft) => {
    const li = document.createElement('li');
    li.className = 'draft-item';

    const header = document.createElement('div');
    header.className = 'draft-header';

    const title = document.createElement('strong');
    title.textContent = draft.gameName;
    header.append(title);

    const source = document.createElement('span');
    source.className = 'draft-pill';
    source.textContent = draft.source;
    header.append(source);

    li.append(header);

    const meta = document.createElement('div');
    meta.className = 'draft-meta';
    meta.textContent = `${draft.gameId} / ${formatDraftTimestamp(draft.savedAt)}${draft.note ? ` / ${draft.note}` : ''}`;
    li.append(meta);

    const actions = document.createElement('div');
    actions.className = 'draft-actions';

    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'secondary-button inline-button';
    restoreButton.textContent = '復元';
    restoreButton.addEventListener('click', () => handlers.onRestore?.(draft.snapshotId));
    actions.append(restoreButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'danger-button inline-button';
    deleteButton.textContent = '削除';
    deleteButton.addEventListener('click', () => handlers.onDelete?.(draft.snapshotId));
    actions.append(deleteButton);

    li.append(actions);
    container.append(li);
  });
}

export function renderDataTable(container, columns, rows, emptyText = 'データがありません。') {
  container.innerHTML = '';

  if (!rows.length) {
    const fallback = document.createElement('div');
    fallback.className = 'rule-item';
    fallback.textContent = emptyText;
    container.append(fallback);
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column.header;
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((column) => {
      const td = document.createElement('td');
      const value = column.render ? column.render(row) : row[column.key];
      td.textContent = value ?? '';
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);

  container.append(table);
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

export function renderAnalysisOverview(container, detail) {
  if (!detail) {
    renderMetricGrid(container, []);
    return;
  }

  renderMetricGrid(container, [
    {
      label: '総合評価',
      value: formatSignedNumber(detail.total),
      subtle: `手番側 ${detail.rootPlayerId} から見た値`,
    },
    {
      label: 'Material',
      value: formatSignedNumber(detail.weighted.material),
      subtle: `raw ${formatSignedNumber(detail.raw.material)}`,
    },
    {
      label: 'Mobility',
      value: formatSignedNumber(detail.weighted.mobility),
      subtle: `raw ${formatSignedNumber(detail.raw.mobility)}`,
    },
    {
      label: 'Center',
      value: formatSignedNumber(detail.weighted.centerControl),
      subtle: `raw ${formatSignedNumber(detail.raw.centerControl)}`,
    },
    {
      label: 'Advance',
      value: formatSignedNumber(detail.weighted.advancement),
      subtle: `raw ${formatSignedNumber(detail.raw.advancement)}`,
    },
    {
      label: 'Line',
      value: formatSignedNumber(detail.weighted.linePotential),
      subtle: `raw ${formatSignedNumber(detail.raw.linePotential)}`,
    },
  ]);
}
