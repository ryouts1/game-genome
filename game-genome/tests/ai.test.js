import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chooseMctsAction } from '../src/ai/mcts.js';
import { chooseMinimaxAction } from '../src/ai/minimax.js';
import { loadGameDefinition } from '../src/core/definition-loader.js';
import { applyAction } from '../src/core/game-engine.js';
import { generateLegalActions } from '../src/core/move-generator.js';
import { createInitialState } from '../src/core/state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  const content = readFileSync(path.resolve(__dirname, `../games/${name}`), 'utf-8');
  return loadGameDefinition(JSON.parse(content));
}

test('minimax chooses the immediate winning tic-tac-toe move', () => {
  const game = loadFixture('tic-tac-toe.json');
  let state = createInitialState(game);

  const sequence = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ];

  for (const move of sequence) {
    const action = generateLegalActions(game, state).find((candidate) => candidate.to.x === move.x && candidate.to.y === move.y);
    state = applyAction(game, state, action);
  }

  const decision = chooseMinimaxAction(game, state, { depth: 3 });
  assert.ok(decision.action);
  assert.deepEqual(decision.action.to, { x: 2, y: 0 });
});

test('mcts returns a legal move from the initial connect-four state', () => {
  const game = loadFixture('connect-four.json');
  const state = createInitialState(game);
  const legalActions = generateLegalActions(game, state);
  const decision = chooseMctsAction(game, state, { iterations: 120, seed: 7 });

  assert.ok(decision.action);
  assert.ok(legalActions.some((action) => action.to.x === decision.action.to.x && action.to.y === decision.action.to.y));
});
