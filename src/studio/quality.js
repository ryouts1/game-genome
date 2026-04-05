function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeValidityScore(diagnostics) {
  const errorPenalty = diagnostics.errors.length * 28;
  const warningPenalty = diagnostics.warnings.length * 4;
  return clamp(100 - errorPenalty - warningPenalty, 0, 100);
}

function computeClarityScore(rawGame) {
  let score = 30;

  if (hasText(rawGame.description)) {
    score += 20;
  }

  const pieceKinds = Object.values(rawGame.pieceKinds ?? {});
  const withLabels = pieceKinds.filter((pieceKind) => hasText(pieceKind.label)).length;
  const withSymbols = pieceKinds.filter((pieceKind) => pieceKind.defaultSymbol || pieceKind.symbolByPlayer).length;
  const withEval = pieceKinds.filter((pieceKind) => pieceKind.evaluation && Number.isFinite(pieceKind.evaluation.value)).length;

  score += Math.min(withLabels * 10, 20);
  score += Math.min(withSymbols * 8, 16);
  score += Math.min(withEval * 7, 14);

  const winConditions = rawGame.termination?.winConditions ?? [];
  const labeledWinConditions = winConditions.filter((condition) => hasText(condition.label)).length;
  score += Math.min(labeledWinConditions * 10, 20);

  return clamp(score, 0, 100);
}

function computeAiScore(rawGame) {
  let score = 35;
  const weights = rawGame.evaluation?.weights ?? {};
  const weightedTerms = ['material', 'mobility', 'centerControl', 'advancement', 'linePotential']
    .filter((key) => Number.isFinite(weights[key])).length;
  score += weightedTerms * 9;

  const drawConditions = rawGame.termination?.drawConditions ?? [];
  if (drawConditions.length > 0) {
    score += 12;
  }

  const actionCount = (rawGame.actionCatalog ?? []).length;
  if (actionCount >= 2) {
    score += 10;
  }

  const boardArea = (rawGame.board?.width ?? 0) * (rawGame.board?.height ?? 0);
  if (boardArea > 0 && boardArea <= 49) {
    score += 8;
  }

  return clamp(score, 0, 100);
}

function computeReusabilityScore(rawGame) {
  let score = 25;

  if (hasText(rawGame.id)) {
    score += 15;
  }
  if (hasText(rawGame.name)) {
    score += 10;
  }
  if (Array.isArray(rawGame.players) && rawGame.players.length === 2) {
    score += 10;
  }
  if (Object.keys(rawGame.pieceKinds ?? {}).length >= 2) {
    score += 16;
  }
  if ((rawGame.actionCatalog ?? []).length >= 1) {
    score += 10;
  }
  if ((rawGame.termination?.winConditions ?? []).length >= 1) {
    score += 14;
  }

  const boardArea = (rawGame.board?.width ?? 0) * (rawGame.board?.height ?? 0);
  if (boardArea >= 9 && boardArea <= 64) {
    score += 10;
  }

  return clamp(score, 0, 100);
}

function scoreBand(score) {
  if (score >= 85) {
    return 'strong';
  }
  if (score >= 70) {
    return 'good';
  }
  if (score >= 50) {
    return 'fair';
  }
  return 'weak';
}

export function evaluateDefinitionHealth(rawGame, diagnostics) {
  const validity = computeValidityScore(diagnostics);
  const clarity = computeClarityScore(rawGame);
  const aiReadiness = computeAiScore(rawGame);
  const reusability = computeReusabilityScore(rawGame);
  const overall = Math.round((validity * 0.35) + (clarity * 0.22) + (aiReadiness * 0.23) + (reusability * 0.20));

  const notes = [];
  if (diagnostics.errors.length > 0) {
    notes.push('エラーが残っているため、プレビュー適用や保存の前に修正が必要です。');
  } else {
    notes.push('構文と必須項目は通っているため、Studio / Arena / 共有リンクに流し込みやすい状態です。');
  }

  if (!hasText(rawGame.description)) {
    notes.push('description があるとカタログ、README、共有時の説明文を流用しやすくなります。');
  }

  const pieceKinds = Object.values(rawGame.pieceKinds ?? {});
  if (pieceKinds.some((pieceKind) => !pieceKind.defaultSymbol && !pieceKind.symbolByPlayer)) {
    notes.push('記号未設定の駒があります。UI 上の見分けやすさを上げるなら symbolByPlayer を足すのが安全です。');
  }

  if (!(rawGame.termination?.drawConditions ?? []).length) {
    notes.push('引き分け条件がないため、探索や Arena 比較で長引くルールは念のため move-limit を置くと扱いやすくなります。');
  }

  const metrics = [
    { label: 'Overall', value: `${overall}`, subtle: scoreBand(overall) },
    { label: 'Validity', value: `${validity}`, subtle: `${diagnostics.errors.length} errors / ${diagnostics.warnings.length} warnings` },
    { label: 'Clarity', value: `${clarity}`, subtle: '名前・記号・説明の整い方' },
    { label: 'AI fit', value: `${aiReadiness}`, subtle: '探索と評価の扱いやすさ' },
    { label: 'Reuse', value: `${reusability}`, subtle: '派生定義へ転用しやすいか' },
  ];

  return {
    overall,
    validity,
    clarity,
    aiReadiness,
    reusability,
    metrics,
    notes,
  };
}
