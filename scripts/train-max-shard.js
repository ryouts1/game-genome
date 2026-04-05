import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGameDefinition } from '../src/core/definition-loader.js';
import { trainSelfPlayBook } from '../src/learning/trainer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
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

const args = parseArgs(process.argv.slice(2));
if (!args.game || !args.output) {
  console.error('Usage: node scripts/train-max-shard.js --game <id> --output <path> [--depth N --episodes N --epsilon X --hard-move-limit N --seed N]');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path.resolve(projectRoot, `games/${args.game}.json`), 'utf-8'));
const game = loadGameDefinition(raw);
const artifact = trainSelfPlayBook(game, {
  teacherController: 'minimax',
  teacherOptions: { depth: Number(args.depth ?? 3), candidateLimit: 5 },
  episodes: Number(args.episodes ?? 100),
  epsilon: Number(args.epsilon ?? 0.15),
  hardMoveLimit: Number(args['hard-move-limit'] ?? 80),
  seed: Number(args.seed ?? 1),
  minimumVisits: Number(args['minimum-visits'] ?? 4),
  minimumConfidence: Number(args['minimum-confidence'] ?? 0.1),
  fallbackController: 'mcts',
  minStateVisits: 1,
  minActionVisits: 1,
});
const outputPath = path.resolve(projectRoot, args.output);
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  gameId: args.game,
  output: args.output,
  episodes: artifact.meta.episodes,
  states: artifact.meta.stateCount,
  decisions: artifact.meta.decisionSamples,
}, null, 2));
