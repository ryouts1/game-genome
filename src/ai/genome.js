import { analyzeMinimax } from './minimax.js';
import { analyzeMcts } from './mcts.js';
import { analyzeBookChoice } from '../learning/book.js';

function chooseFallback(game, state, options) {
  const fallbackController = options.fallbackController ?? options.learnedBook?.meta?.recommendation?.fallbackController ?? 'mcts';
  if (fallbackController === 'minimax') {
    return analyzeMinimax(game, state, {
      depth: options.depth,
      candidateLimit: options.candidateLimit,
      pvLimit: options.pvLimit,
    });
  }

  return analyzeMcts(game, state, {
    iterations: options.iterations,
    seed: options.seed,
    candidateLimit: options.candidateLimit,
    maxRolloutDepth: options.maxRolloutDepth,
  });
}

function summarizeDecision(source, book, fallback) {
  if (source === 'book' && book.recommendedAction) {
    return `book / ${book.recommendedAction.text} / samples ${book.entry.visits}`;
  }

  if (book.hit && fallback?.action) {
    return `${fallback.summary} / book hit ${book.entry.visits} samples`;
  }

  return fallback?.summary ?? book.summary;
}

export function analyzeGenome(game, state, options = {}) {
  const book = analyzeBookChoice(game, state, options);
  const fallback = options.fallbackAnalysis ?? chooseFallback(game, state, options);

  if (book.recommended && book.recommendedAction) {
    return {
      action: book.recommendedAction,
      source: 'book',
      book,
      fallback,
      summary: summarizeDecision('book', book, fallback),
    };
  }

  return {
    action: fallback?.action ?? book.recommendedAction ?? null,
    source: book.hit ? 'search-with-book-context' : 'search',
    book,
    fallback,
    summary: summarizeDecision('search', book, fallback),
  };
}

export function chooseGenomeAction(game, state, options = {}) {
  return analyzeGenome(game, state, options);
}
