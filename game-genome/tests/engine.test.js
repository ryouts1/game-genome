import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGameDefinition } from '../src/core/definition-loader.js';
import { applyAction } from '../src/core/game-engine.js';
import { generateLegalActions } from '../src/core/move-generator.js';
import { createInitialState } from '../src/core/state.js';
import { getGameStatus } from '../src/core/termination.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  const content = readFileSync(path.resolve(__dirname, `../games/${name}`), 'utf-8');
  return loadGameDefinition(JSON.parse(content));
}

test('tic-tac-toe starts with 9 legal placement actions', () => {
  const game = loadFixture('tic-tac-toe.json');
  const state = createInitialState(game);
  const actions = generateLegalActions(game, state);
  assert.equal(actions.length, 9);
});

test('connect-four only allows lowest empty cell in each column', () => {
  const game = loadFixture('connect-four.json');
  let state = createInitialState(game);
  let actions = generateLegalActions(game, state);
  assert.equal(actions.length, 7);
  assert.ok(actions.every((action) => action.to.y === 5));

  const columnThreeMove = actions.find((action) => action.to.x === 3);
  state = applyAction(game, state, columnThreeMove);
  actions = generateLegalActions(game, state);

  const stackedMove = actions.find((action) => action.to.x === 3);
  assert.equal(stackedMove.to.y, 4);
});

test('lane-breakthrough uses forward direction for both players', () => {
  const game = loadFixture('lane-breakthrough.json');
  let state = createInitialState(game);
  let actions = generateLegalActions(game, state);

  const p1ForwardMove = actions.find((action) => action.type === 'move-piece' && action.from.x === 0 && action.from.y === 0);
  assert.deepEqual(p1ForwardMove.to, { x: 0, y: 1 });

  state.currentPlayer = 'P2';
  actions = generateLegalActions(game, state);
  const p2ForwardMove = actions.find((action) => action.type === 'move-piece' && action.from.x === 0 && action.from.y === 4);
  assert.deepEqual(p2ForwardMove.to, { x: 0, y: 3 });
});

test('line condition produces a win before board-full draw', () => {
  const game = loadFixture('tic-tac-toe.json');
  let state = createInitialState(game);
  const sequence = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 0 },
  ];

  for (const move of sequence) {
    const action = generateLegalActions(game, state).find((candidate) => candidate.to.x === move.x && candidate.to.y === move.y);
    state = applyAction(game, state, action);
  }

  const status = getGameStatus(game, state);
  assert.equal(status.isTerminal, true);
  assert.equal(status.winner, 'P1');
});

test('reach-row condition wins lane-breakthrough', () => {
  const game = loadFixture('lane-breakthrough.json');
  const state = {
    pieces: [
      { id: 'piece-1', kind: 'soldier', owner: 'P1', x: 2, y: 4 },
      { id: 'piece-2', kind: 'soldier', owner: 'P2', x: 2, y: 0 },
    ],
    currentPlayer: 'P2',
    history: [{ playerId: 'P1', text: 'dummy', action: { type: 'move-piece' } }],
    nextPieceSerial: 3,
    lastAction: null,
  };

  const status = getGameStatus(game, state);
  assert.equal(status.isTerminal, true);
  assert.equal(status.winner, 'P1');
});
