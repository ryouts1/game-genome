import { applyAction } from '../core/game-engine.js';
import { generateLegalActions } from '../core/move-generator.js';
import { createInitialState } from '../core/state.js';
import { getGameStatus } from '../core/termination.js';
import { chooseControllerAction } from '../ai/controller.js';
import { createRandomNumberGenerator } from '../ai/random.js';
import { createActionKey, createStateKey } from './keys.js';

function createStateStats(playerId) {
  return {
    playerId,
    visits: 0,
    valueSum: 0,
    actions: new Map(),
  };
}

function createActionStats(text) {
  return {
    text,
    visits: 0,
    valueSum: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  };
}

function outcomeScore(status, playerId) {
  if (status.outcome === 'draw' || !status.winner) {
    return 0;
  }

  return status.winner === playerId ? 1 : -1;
}

function chooseTrainingAction(game, state, legalActions, config, random, episodeIndex, ply) {
  const teacherOptions = {
    ...config.teacherOptions,
    seed: (config.seed ?? 1) + episodeIndex * 7919 + ply * 131,
  };
  const teacherDecision = chooseControllerAction(game, state, config.teacherController, teacherOptions);
  const epsilon = config.epsilon ?? 0;
  const shouldExplore = epsilon > 0 && random() < epsilon;

  if (shouldExplore) {
    const index = Math.floor(random() * legalActions.length);
    return {
      action: legalActions[index],
      source: 'explore',
    };
  }

  if (teacherDecision.action) {
    return {
      action: teacherDecision.action,
      source: config.teacherController,
    };
  }

  return {
    action: legalActions[0] ?? null,
    source: 'fallback',
  };
}

function serializeArtifact(game, config, stateStats) {
  const minStateVisits = config.minStateVisits ?? 1;
  const minActionVisits = config.minActionVisits ?? 1;

  const states = [...stateStats.entries()]
    .map(([stateKey, entry]) => {
      const actions = [...entry.actions.entries()]
        .filter(([, action]) => action.visits >= minActionVisits)
        .map(([key, action]) => ({
          key,
          text: action.text,
          visits: action.visits,
          meanScore: Number((action.valueSum / action.visits).toFixed(4)),
          wins: action.wins,
          draws: action.draws,
          losses: action.losses,
        }))
        .sort((left, right) => {
          if (right.meanScore !== left.meanScore) {
            return right.meanScore - left.meanScore;
          }
          return right.visits - left.visits;
        });

      if (entry.visits < minStateVisits || actions.length === 0) {
        return null;
      }

      return {
        stateKey,
        playerId: entry.playerId,
        visits: entry.visits,
        averageValue: Number((entry.valueSum / entry.visits).toFixed(4)),
        actions,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.visits - left.visits);

  const decisionSamples = states.reduce((sum, entry) => sum + entry.visits, 0);

  return {
    formatVersion: 1,
    gameId: game.id,
    generatedAt: new Date().toISOString(),
    meta: {
      episodes: config.episodes,
      hardMoveLimit: config.hardMoveLimit,
      epsilon: config.epsilon,
      seed: config.seed,
      teacherController: config.teacherController,
      teacherOptions: config.teacherOptions,
      stateCount: states.length,
      decisionSamples,
      recommendation: {
        minimumVisits: config.minimumVisits ?? 4,
        minimumConfidence: config.minimumConfidence ?? 0.15,
        fallbackController: config.fallbackController ?? 'mcts',
      },
    },
    states,
  };
}

export function trainSelfPlayBook(game, options = {}) {
  const config = {
    teacherController: options.teacherController ?? 'mcts',
    teacherOptions: options.teacherOptions ?? {},
    episodes: options.episodes ?? 200,
    epsilon: options.epsilon ?? 0.1,
    hardMoveLimit: options.hardMoveLimit ?? 120,
    seed: options.seed ?? 1,
    minimumVisits: options.minimumVisits ?? 4,
    minimumConfidence: options.minimumConfidence ?? 0.15,
    fallbackController: options.fallbackController ?? 'mcts',
    minStateVisits: options.minStateVisits ?? 1,
    minActionVisits: options.minActionVisits ?? 1,
  };

  const random = createRandomNumberGenerator(config.seed);
  const stateStats = new Map();

  for (let episodeIndex = 0; episodeIndex < config.episodes; episodeIndex += 1) {
    let state = createInitialState(game);
    const trajectory = [];

    for (let ply = 0; ply < config.hardMoveLimit; ply += 1) {
      const status = getGameStatus(game, state);
      if (status.isTerminal) {
        break;
      }

      const legalActions = generateLegalActions(game, state, state.currentPlayer);
      if (legalActions.length === 0) {
        break;
      }

      const decision = chooseTrainingAction(game, state, legalActions, config, random, episodeIndex, ply);
      if (!decision.action) {
        break;
      }

      trajectory.push({
        playerId: state.currentPlayer,
        stateKey: createStateKey(state),
        actionKey: createActionKey(decision.action),
        actionText: decision.action.text,
        source: decision.source,
      });

      state = applyAction(game, state, decision.action);
    }

    const resolved = getGameStatus(game, state);
    trajectory.forEach((step) => {
      const score = outcomeScore(resolved, step.playerId);
      const stateEntry = stateStats.get(step.stateKey) ?? createStateStats(step.playerId);
      stateEntry.visits += 1;
      stateEntry.valueSum += score;

      const actionEntry = stateEntry.actions.get(step.actionKey) ?? createActionStats(step.actionText);
      actionEntry.visits += 1;
      actionEntry.valueSum += score;
      if (score > 0) {
        actionEntry.wins += 1;
      } else if (score < 0) {
        actionEntry.losses += 1;
      } else {
        actionEntry.draws += 1;
      }

      stateEntry.actions.set(step.actionKey, actionEntry);
      stateStats.set(step.stateKey, stateEntry);
    });
  }

  return serializeArtifact(game, config, stateStats);
}
