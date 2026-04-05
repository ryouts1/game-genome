import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEARNING_BUNDLE_CONFIG } from './learning-bundle.config.js';
import { loadGameDefinition } from '../src/core/definition-loader.js';
import { trainSelfPlayBook } from '../src/learning/trainer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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
  const gamePath = path.resolve(projectRoot, `games/${gameId}.json`);
  const raw = JSON.parse(readFileSync(gamePath, 'utf-8'));
  return loadGameDefinition(raw);
}

function numericOption(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const args = parseArgs(process.argv.slice(2));
const gameId = args.game;
if (!gameId) {
  console.error('Usage: node scripts/train-self-play.js --game <game-id> [--episodes N]');
  process.exit(1);
}

const baseConfig = LEARNING_BUNDLE_CONFIG.find((entry) => entry.gameId === gameId) ?? {
  gameId,
  outputFilename: `${gameId}.book.json`,
  sourceLabel: 'manual run',
  teacherController: 'mcts',
  teacherOptions: { iterations: 180, candidateLimit: 5 },
  episodes: 300,
  epsilon: 0.15,
  hardMoveLimit: 80,
  seed: 1,
  minimumVisits: 4,
  minimumConfidence: 0.12,
  minStateVisits: 2,
  minActionVisits: 2,
};

const config = {
  ...baseConfig,
  teacherController: args.teacher ?? baseConfig.teacherController,
  episodes: numericOption(args.episodes, baseConfig.episodes),
  epsilon: numericOption(args.epsilon, baseConfig.epsilon),
  hardMoveLimit: numericOption(args['hard-move-limit'], baseConfig.hardMoveLimit),
  seed: numericOption(args.seed, baseConfig.seed),
};

const game = loadGame(config.gameId);
const artifact = trainSelfPlayBook(game, config);
const artifactDir = path.resolve(projectRoot, 'artifacts/learning');
const outputPath = path.resolve(artifactDir, config.outputFilename);
mkdirSync(artifactDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(`Wrote ${path.relative(projectRoot, outputPath)}`);
console.log(`episodes=${artifact.meta.episodes} states=${artifact.meta.stateCount} decisions=${artifact.meta.decisionSamples}`);
