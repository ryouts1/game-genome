import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.resolve(projectRoot, 'artifacts/learning/manifest.json');

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!existsSync(manifestPath)) {
  fail('Missing artifacts/learning/manifest.json');
  process.exit();
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const manifestIds = new Set();

for (const entry of manifest) {
  if (manifestIds.has(entry.gameId)) {
    fail(`Duplicate manifest entry for ${entry.gameId}`);
    continue;
  }
  manifestIds.add(entry.gameId);

  const artifactPath = path.resolve(projectRoot, entry.path.replace('./', ''));
  if (!existsSync(artifactPath)) {
    fail(`Missing artifact: ${entry.path}`);
    continue;
  }

  const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
  if (artifact.gameId !== entry.gameId) {
    fail(`Artifact gameId mismatch: ${entry.gameId}`);
  }
  if (artifact.formatVersion !== 1) {
    fail(`Unsupported formatVersion in ${entry.gameId}`);
  }

  const stateKeys = new Set();
  for (const stateEntry of artifact.states ?? []) {
    if (stateKeys.has(stateEntry.stateKey)) {
      fail(`Duplicate state key in ${entry.gameId}: ${stateEntry.stateKey}`);
      continue;
    }
    stateKeys.add(stateEntry.stateKey);

    if (!Number.isInteger(stateEntry.visits) || stateEntry.visits <= 0) {
      fail(`Invalid visits for state ${stateEntry.stateKey} in ${entry.gameId}`);
    }

    const actionKeys = new Set();
    let actionVisitSum = 0;
    for (const actionEntry of stateEntry.actions ?? []) {
      if (actionKeys.has(actionEntry.key)) {
        fail(`Duplicate action key in ${entry.gameId}: ${actionEntry.key}`);
        continue;
      }
      actionKeys.add(actionEntry.key);
      actionVisitSum += actionEntry.visits;

      if (!Number.isInteger(actionEntry.visits) || actionEntry.visits <= 0) {
        fail(`Invalid action visits in ${entry.gameId}: ${actionEntry.key}`);
      }
      if (!Number.isFinite(actionEntry.meanScore)) {
        fail(`Invalid meanScore in ${entry.gameId}: ${actionEntry.key}`);
      }
    }

    if (actionVisitSum <= 0 || actionVisitSum > stateEntry.visits) {
      fail(`State visit mismatch in ${entry.gameId}: ${stateEntry.stateKey}`);
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`Validated ${manifest.length} learning artifact(s)`);
