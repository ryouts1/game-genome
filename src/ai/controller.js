import { generateLegalActions } from '../core/move-generator.js';
import { analyzeMcts, chooseMctsAction } from './mcts.js';
import { analyzeMinimax, chooseMinimaxAction } from './minimax.js';
import { analyzeGenome, chooseGenomeAction } from './genome.js';
import { createRandomNumberGenerator } from './random.js';

export const CONTROLLER_LABELS = {
  human: 'Human',
  minimax: 'Minimax',
  mcts: 'MCTS',
  genome: 'Genome AI',
  random: 'Random',
};

export function controllerLabel(controller) {
  return CONTROLLER_LABELS[controller] ?? controller;
}

export function chooseControllerAction(game, state, controller, options = {}) {
  switch (controller) {
    case 'human':
      return {
        action: null,
        summary: '人間操作です。',
      };
    case 'minimax':
      return chooseMinimaxAction(game, state, {
        depth: options.depth,
        candidateLimit: options.candidateLimit,
      });
    case 'mcts':
      return chooseMctsAction(game, state, {
        iterations: options.iterations,
        seed: options.seed,
        candidateLimit: options.candidateLimit,
      });
    case 'genome':
      return chooseGenomeAction(game, state, {
        learnedBook: options.learnedBook,
        fallbackController: options.fallbackController,
        minimumVisits: options.minimumVisits,
        minimumConfidence: options.minimumConfidence,
        depth: options.depth,
        iterations: options.iterations,
        seed: options.seed,
        candidateLimit: options.candidateLimit,
      });
    case 'random': {
      const legalActions = generateLegalActions(game, state, state.currentPlayer);
      if (legalActions.length === 0) {
        return {
          action: null,
          summary: '合法手がありません。',
        };
      }
      const random = createRandomNumberGenerator(options.seed ?? null);
      const action = legalActions[Math.floor(random() * legalActions.length)];
      return {
        action,
        summary: `legal ${legalActions.length} / random choice`,
      };
    }
    default:
      throw new Error(`Unknown controller: ${controller}`);
  }
}

export function analyzeController(game, state, controller, options = {}) {
  switch (controller) {
    case 'minimax':
      return analyzeMinimax(game, state, options);
    case 'mcts':
      return analyzeMcts(game, state, options);
    case 'genome':
      return analyzeGenome(game, state, options);
    default:
      return chooseControllerAction(game, state, controller, options);
  }
}
