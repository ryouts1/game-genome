import { generateLegalActions } from '../core/move-generator.js';
import { createActionKey, createStateKey } from './keys.js';

function compareCandidates(left, right) {
  if (right.meanScore !== left.meanScore) {
    return right.meanScore - left.meanScore;
  }

  if (right.visits !== left.visits) {
    return right.visits - left.visits;
  }

  return left.action.text.localeCompare(right.action.text, 'ja');
}

export function prepareLearnedBook(rawArtifact) {
  if (!rawArtifact) {
    return null;
  }

  const rawMeta = rawArtifact.meta ?? {};
  const indexedStates = (rawArtifact.states ?? []).map((entry) => {
    const actions = [...(entry.actions ?? [])].sort((left, right) => {
      if (right.meanScore !== left.meanScore) {
        return right.meanScore - left.meanScore;
      }
      return right.visits - left.visits;
    });

    return {
      ...entry,
      actionMap: new Map(actions.map((action) => [action.key, action])),
      actions,
    };
  });

  return {
    ...rawArtifact,
    meta: {
      ...rawMeta,
      recommendation: {
        minimumVisits: rawMeta.recommendation?.minimumVisits ?? 4,
        minimumConfidence: rawMeta.recommendation?.minimumConfidence ?? 0.15,
        fallbackController: rawMeta.recommendation?.fallbackController ?? 'mcts',
      },
    },
    states: indexedStates,
    stateMap: new Map(indexedStates.map((entry) => [entry.stateKey, entry])),
  };
}

export function lookupBookEntry(learnedBook, state) {
  if (!learnedBook) {
    return null;
  }

  return learnedBook.stateMap.get(createStateKey(state)) ?? null;
}

export function mergeBookCandidates(game, learnedBook, state, legalActions = null) {
  const actions = legalActions ?? generateLegalActions(game, state, state.currentPlayer);
  const entry = lookupBookEntry(learnedBook, state);

  return actions
    .map((action) => {
      const key = createActionKey(action);
      const stats = entry?.actionMap.get(key) ?? null;
      return {
        action,
        key,
        seen: Boolean(stats),
        visits: stats?.visits ?? 0,
        meanScore: Number(stats?.meanScore ?? 0),
        wins: stats?.wins ?? 0,
        draws: stats?.draws ?? 0,
        losses: stats?.losses ?? 0,
      };
    })
    .sort(compareCandidates);
}

export function analyzeBookChoice(game, state, options = {}) {
  const learnedBook = options.learnedBook ?? null;
  const legalActions = options.legalActions ?? generateLegalActions(game, state, state.currentPlayer);

  if (!learnedBook) {
    return {
      available: false,
      hit: false,
      action: null,
      recommendedAction: null,
      entry: null,
      candidates: [],
      coverage: 0,
      seenCount: 0,
      confidenceGap: 0,
      summary: '学習済みブックは読み込まれていません。',
    };
  }

  const entry = lookupBookEntry(learnedBook, state);
  if (!entry) {
    return {
      available: true,
      hit: false,
      action: null,
      recommendedAction: null,
      entry: null,
      candidates: [],
      coverage: 0,
      seenCount: 0,
      confidenceGap: 0,
      summary: `book miss / states ${learnedBook.states.length}`,
    };
  }

  const candidates = mergeBookCandidates(game, learnedBook, state, legalActions);
  const seenCount = candidates.filter((candidate) => candidate.seen).length;
  const coverage = legalActions.length > 0 ? seenCount / legalActions.length : 0;
  const best = candidates[0] ?? null;
  const secondSeen = candidates.find((candidate, index) => index > 0 && candidate.seen) ?? null;
  const confidenceGap = best ? best.meanScore - (secondSeen?.meanScore ?? -1) : 0;
  const minimumVisits = options.minimumVisits ?? learnedBook.meta.recommendation.minimumVisits;
  const minimumConfidence = options.minimumConfidence ?? learnedBook.meta.recommendation.minimumConfidence;
  const recommended = Boolean(
    best
      && best.seen
      && best.visits >= minimumVisits
      && confidenceGap >= minimumConfidence,
  );

  return {
    available: true,
    hit: true,
    action: recommended ? best.action : null,
    recommendedAction: best?.action ?? null,
    recommended,
    entry,
    candidates: candidates.slice(0, options.candidateLimit ?? 5),
    coverage,
    seenCount,
    confidenceGap,
    summary: `book hit / samples ${entry.visits} / coverage ${(coverage * 100).toFixed(1)}%`,
  };
}

export function summarizeLearnedBook(learnedBook) {
  if (!learnedBook) {
    return '学習済みアセットなし';
  }

  const episodes = learnedBook.meta?.episodes ?? 0;
  const states = learnedBook.states.length;
  const teacher = learnedBook.meta?.teacherController ?? 'unknown';
  return `${episodes} self-play / ${states} states / teacher ${teacher}`;
}
