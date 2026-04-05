import { applyAction } from '../core/game-engine.js';
import { createInitialState } from '../core/state.js';
import { getGameStatus } from '../core/termination.js';
import { chooseControllerAction } from '../ai/controller.js';

export function playAutomatedMatch(game, options = {}) {
  const controllers = options.controllers ?? {};
  const depth = options.depth ?? 3;
  const iterations = options.iterations ?? 400;
  const hardMoveLimit = options.hardMoveLimit ?? 120;
  const baseSeed = Number.isInteger(options.seed) ? options.seed : 1;

  let state = options.initialState ? structuredClone(options.initialState) : createInitialState(game);
  const startedAt = Date.now();
  const log = [];

  for (let ply = 0; ply < hardMoveLimit; ply += 1) {
    const status = getGameStatus(game, state);
    if (status.isTerminal) {
      return {
        ...status,
        state,
        moves: state.history.length,
        log,
        durationMs: Date.now() - startedAt,
        hardLimitReached: false,
      };
    }

    const controller = controllers[state.currentPlayer] ?? 'random';
    const decision = chooseControllerAction(game, state, controller, {
      depth,
      iterations,
      seed: baseSeed + ply + (state.currentPlayer === game.players[0].id ? 0 : 100000),
      learnedBook: options.learnedBook,
    });

    if (!decision.action) {
      const resolvedStatus = getGameStatus(game, state);
      return {
        ...resolvedStatus,
        state,
        moves: state.history.length,
        log,
        durationMs: Date.now() - startedAt,
        hardLimitReached: false,
      };
    }

    log.push({
      ply: ply + 1,
      playerId: state.currentPlayer,
      controller,
      text: decision.action.text,
    });

    state = applyAction(game, state, decision.action);
  }

  return {
    isTerminal: true,
    outcome: 'draw',
    winner: null,
    reason: `安全手数上限 ${hardMoveLimit} に到達したため`,
    state,
    moves: state.history.length,
    log,
    durationMs: Date.now() - startedAt,
    hardLimitReached: true,
  };
}
