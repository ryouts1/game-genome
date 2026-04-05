import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEARNING_BUNDLE_CONFIG } from './learning-bundle.config.js';
import { loadGameDefinition } from '../src/core/definition-loader.js';
import { trainSelfPlayBook } from '../src/learning/trainer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.resolve(projectRoot, 'artifacts/learning');
const manifestPath = path.resolve(outputDir, 'manifest.json');

function loadGame(gameId) {
  const raw = JSON.parse(readFileSync(path.resolve(projectRoot, `games/${gameId}.json`), 'utf-8'));
  return loadGameDefinition(raw);
}

mkdirSync(outputDir, { recursive: true });

const manifest = [];
for (const config of LEARNING_BUNDLE_CONFIG) {
  const game = loadGame(config.gameId);
  const artifact = trainSelfPlayBook(game, config);
  const outputPath = path.resolve(outputDir, config.outputFilename);
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);

  manifest.push({
    gameId: config.gameId,
    path: `./artifacts/learning/${config.outputFilename}`,
    sourceLabel: config.sourceLabel,
    teacherController: artifact.meta.teacherController,
    episodes: artifact.meta.episodes,
    states: artifact.meta.stateCount,
    decisionSamples: artifact.meta.decisionSamples,
    generatedAt: artifact.generatedAt,
  });

  console.log(`trained ${config.gameId}: states=${artifact.meta.stateCount} decisions=${artifact.meta.decisionSamples}`);
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${path.relative(projectRoot, manifestPath)}`);
