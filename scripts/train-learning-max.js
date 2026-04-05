import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGameDefinition } from '../src/core/definition-loader.js';
import { trainSelfPlayBook } from '../src/learning/trainer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.resolve(projectRoot, 'artifacts/learning');
const manifestPath = path.resolve(outputDir, 'manifest.json');

const MAX_BUNDLE_CONFIG = [
  {
    gameId: 'tic-tac-toe',
    outputFilename: 'tic-tac-toe.book.json',
    episodesPerShard: 600,
    seeds: [101, 211, 307],
    teacherOptions: { depth: 4, candidateLimit: 5 },
    epsilon: 0.12,
    hardMoveLimit: 12,
    minimumVisits: 8,
    minimumConfidence: 0.18,
    retainMinStateVisits: 2,
    retainMinActionVisits: 2,
  },
  {
    gameId: 'connect-four',
    outputFilename: 'connect-four.book.json',
    episodesPerShard: 25,
    seeds: [113, 223, 331],
    teacherOptions: { depth: 4, candidateLimit: 5 },
    epsilon: 0.28,
    hardMoveLimit: 52,
    minimumVisits: 4,
    minimumConfidence: 0.08,
    retainMinStateVisits: 1,
    retainMinActionVisits: 1,
  },
  {
    gameId: 'lane-breakthrough',
    outputFilename: 'lane-breakthrough.book.json',
    episodesPerShard: 400,
    seeds: [127, 239, 347],
    teacherOptions: { depth: 3, candidateLimit: 5 },
    epsilon: 0.14,
    hardMoveLimit: 60,
    minimumVisits: 6,
    minimumConfidence: 0.12,
    retainMinStateVisits: 2,
    retainMinActionVisits: 2,
  },
  {
    gameId: 'knight-skirmish',
    outputFilename: 'knight-skirmish.book.json',
    episodesPerShard: 120,
    seeds: [131, 241, 353],
    teacherOptions: { depth: 3, candidateLimit: 5 },
    epsilon: 0.16,
    hardMoveLimit: 70,
    minimumVisits: 4,
    minimumConfidence: 0.1,
    retainMinStateVisits: 2,
    retainMinActionVisits: 2,
  },
  {
    gameId: 'royal-duel',
    outputFilename: 'royal-duel.book.json',
    episodesPerShard: 250,
    seeds: [149, 257, 359],
    teacherOptions: { depth: 3, candidateLimit: 5 },
    epsilon: 0.16,
    hardMoveLimit: 80,
    minimumVisits: 4,
    minimumConfidence: 0.1,
    retainMinStateVisits: 1,
    retainMinActionVisits: 1,
  },
  {
    gameId: 'relay-outpost',
    outputFilename: 'relay-outpost.book.json',
    episodesPerShard: 100,
    seeds: [157, 263, 367],
    teacherOptions: { depth: 3, candidateLimit: 5 },
    epsilon: 0.22,
    hardMoveLimit: 80,
    minimumVisits: 3,
    minimumConfidence: 0.08,
    retainMinStateVisits: 1,
    retainMinActionVisits: 1,
  },
];


function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const nextValue = argv[index + 1];
    if (nextValue && !nextValue.startsWith('--')) {
      result[key] = nextValue;
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

function loadGame(gameId) {
  const raw = JSON.parse(readFileSync(path.resolve(projectRoot, `games/${gameId}.json`), 'utf-8'));
  return loadGameDefinition(raw);
}

function createMergedState(playerId) {
  return {
    playerId,
    visits: 0,
    actions: new Map(),
  };
}

function createMergedAction(text) {
  return {
    text,
    visits: 0,
    valueSum: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  };
}

function accumulateArtifact(accumulator, artifact) {
  for (const stateEntry of artifact.states ?? []) {
    const mergedState = accumulator.get(stateEntry.stateKey) ?? createMergedState(stateEntry.playerId);

    for (const actionEntry of stateEntry.actions ?? []) {
      const mergedAction = mergedState.actions.get(actionEntry.key) ?? createMergedAction(actionEntry.text);
      mergedAction.visits += actionEntry.visits;
      mergedAction.wins += actionEntry.wins;
      mergedAction.draws += actionEntry.draws;
      mergedAction.losses += actionEntry.losses;
      mergedAction.valueSum += actionEntry.wins - actionEntry.losses;
      mergedState.actions.set(actionEntry.key, mergedAction);
    }

    mergedState.visits = [...mergedState.actions.values()].reduce((sum, action) => sum + action.visits, 0);
    accumulator.set(stateEntry.stateKey, mergedState);
  }
}

function finalizeArtifact(game, config, accumulator) {
  const states = [...accumulator.entries()]
    .map(([stateKey, stateEntry]) => {
      const actions = [...stateEntry.actions.entries()]
        .filter(([, actionEntry]) => actionEntry.visits >= config.retainMinActionVisits)
        .map(([key, actionEntry]) => ({
          key,
          text: actionEntry.text,
          visits: actionEntry.visits,
          meanScore: Number((actionEntry.valueSum / actionEntry.visits).toFixed(4)),
          wins: actionEntry.wins,
          draws: actionEntry.draws,
          losses: actionEntry.losses,
        }))
        .sort((left, right) => {
          if (right.meanScore !== left.meanScore) {
            return right.meanScore - left.meanScore;
          }
          return right.visits - left.visits;
        });

      const retainedVisitSum = actions.reduce((sum, action) => sum + action.visits, 0);
      const retainedValueSum = actions.reduce((sum, action) => sum + action.wins - action.losses, 0);
      if (retainedVisitSum < config.retainMinStateVisits || actions.length === 0) {
        return null;
      }

      return {
        stateKey,
        playerId: stateEntry.playerId,
        visits: retainedVisitSum,
        averageValue: Number((retainedValueSum / retainedVisitSum).toFixed(4)),
        actions,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.visits - left.visits);

  const decisionSamples = states.reduce((sum, entry) => sum + entry.visits, 0);
  const totalEpisodes = config.episodesPerShard * config.seeds.length;

  return {
    formatVersion: 1,
    gameId: game.id,
    generatedAt: new Date().toISOString(),
    meta: {
      episodes: totalEpisodes,
      hardMoveLimit: config.hardMoveLimit,
      epsilon: config.epsilon,
      seed: null,
      teacherController: 'minimax',
      teacherOptions: config.teacherOptions,
      stateCount: states.length,
      decisionSamples,
      recommendation: {
        minimumVisits: config.minimumVisits,
        minimumConfidence: config.minimumConfidence,
        fallbackController: 'mcts',
      },
      trainingPlan: {
        mode: 'multi-seed-self-play',
        shards: config.seeds.map((seed) => ({
          seed,
          episodes: config.episodesPerShard,
          teacherController: 'minimax',
          teacherOptions: config.teacherOptions,
          epsilon: config.epsilon,
          hardMoveLimit: config.hardMoveLimit,
        })),
      },
    },
    states,
  };
}

const args = parseArgs(process.argv.slice(2));
const targetGameId = args.game ?? null;
mkdirSync(outputDir, { recursive: true });

const manifest = [];
for (const config of MAX_BUNDLE_CONFIG) {
  if (targetGameId && config.gameId !== targetGameId) {
    continue;
  }
  const game = loadGame(config.gameId);
  const accumulator = new Map();

  for (const seed of config.seeds) {
    const shardArtifact = trainSelfPlayBook(game, {
      teacherController: 'minimax',
      teacherOptions: config.teacherOptions,
      episodes: config.episodesPerShard,
      epsilon: config.epsilon,
      hardMoveLimit: config.hardMoveLimit,
      seed,
      minimumVisits: config.minimumVisits,
      minimumConfidence: config.minimumConfidence,
      fallbackController: 'mcts',
      minStateVisits: 1,
      minActionVisits: 1,
    });
    accumulateArtifact(accumulator, shardArtifact);
    console.log(`trained shard ${config.gameId} / seed=${seed} / states=${shardArtifact.meta.stateCount} / decisions=${shardArtifact.meta.decisionSamples}`);
  }

  const mergedArtifact = finalizeArtifact(game, config, accumulator);
  const outputPath = path.resolve(outputDir, config.outputFilename);
  writeFileSync(outputPath, `${JSON.stringify(mergedArtifact, null, 2)}\n`);

  manifest.push({
    gameId: config.gameId,
    path: `./artifacts/learning/${config.outputFilename}`,
    sourceLabel: 'max multi-seed bundle',
    teacherController: mergedArtifact.meta.teacherController,
    episodes: mergedArtifact.meta.episodes,
    states: mergedArtifact.meta.stateCount,
    decisionSamples: mergedArtifact.meta.decisionSamples,
    generatedAt: mergedArtifact.generatedAt,
  });

  console.log(`merged ${config.gameId}: states=${mergedArtifact.meta.stateCount} decisions=${mergedArtifact.meta.decisionSamples}`);
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${path.relative(projectRoot, manifestPath)}`);
