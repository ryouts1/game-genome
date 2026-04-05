import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { playAutomatedMatch } from '../src/arena/simulator.js';
import { loadGameDefinition } from '../src/core/definition-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  const content = readFileSync(path.resolve(__dirname, `../games/${name}`), 'utf-8');
  return loadGameDefinition(JSON.parse(content));
}

test('arena can complete an automated random-vs-random match', () => {
  const game = loadFixture('tic-tac-toe.json');
  const result = playAutomatedMatch(game, {
    controllers: { P1: 'random', P2: 'random' },
    hardMoveLimit: 20,
    seed: 9,
  });

  assert.equal(result.isTerminal, true);
  assert.ok(result.moves <= 9);
  assert.ok(['draw', 'win'].includes(result.outcome));
});
