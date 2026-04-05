import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chooseGenomeAction } from '../src/ai/genome.js';
import { loadGameDefinition } from '../src/core/definition-loader.js';
import { generateLegalActions } from '../src/core/move-generator.js';
import { createInitialState } from '../src/core/state.js';
import { prepareLearnedBook } from '../src/learning/book.js';
import { createActionKey, createStateKey } from '../src/learning/keys.js';
import { trainSelfPlayBook } from '../src/learning/trainer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  const content = readFileSync(path.resolve(__dirname, `../games/${name}`), 'utf-8');
  return loadGameDefinition(JSON.parse(content));
}

test('createActionKey ignores volatile piece ids', () => {
  const left = createActionKey({
    type: 'move-piece',
    pieceId: 'piece-1',
    pieceKind: 'rook',
    playerId: 'P1',
    from: { x: 0, y: 0 },
    to: { x: 0, y: 2 },
    capture: { pieceId: 'piece-9', pieceKind: 'king', owner: 'P2' },
  });

  const right = createActionKey({
    type: 'move-piece',
    pieceId: 'piece-999',
    pieceKind: 'rook',
    playerId: 'P1',
    from: { x: 0, y: 0 },
    to: { x: 0, y: 2 },
    capture: { pieceId: 'piece-3', pieceKind: 'king', owner: 'P2' },
  });

  assert.equal(left, right);
});

test('genome chooses learned book action when confidence is high', () => {
  const game = loadFixture('tic-tac-toe.json');
  const state = createInitialState(game);
  const legalActions = generateLegalActions(game, state, state.currentPlayer);
  const center = legalActions.find((action) => action.to.x === 1 && action.to.y === 1);
  assert.ok(center);

  const artifact = prepareLearnedBook({
    formatVersion: 1,
    gameId: game.id,
    meta: {
      episodes: 12,
      teacherController: 'minimax',
      recommendation: {
        minimumVisits: 4,
        minimumConfidence: 0.2,
        fallbackController: 'mcts',
      },
    },
    states: [
      {
        stateKey: createStateKey(state),
        playerId: state.currentPlayer,
        visits: 10,
        averageValue: 0.7,
        actions: [
          {
            key: createActionKey(center),
            text: center.text,
            visits: 8,
            meanScore: 0.8,
            wins: 8,
            draws: 0,
            losses: 0,
          },
        ],
      },
    ],
  });

  const decision = chooseGenomeAction(game, state, {
    learnedBook: artifact,
    iterations: 60,
  });

  assert.equal(decision.source, 'book');
  assert.deepEqual(decision.action.to, { x: 1, y: 1 });
});

test('trainSelfPlayBook produces retained states and decision samples', () => {
  const game = loadFixture('tic-tac-toe.json');
  const artifact = trainSelfPlayBook(game, {
    teacherController: 'minimax',
    teacherOptions: { depth: 4 },
    episodes: 40,
    epsilon: 0.2,
    hardMoveLimit: 12,
    seed: 5,
    minimumVisits: 3,
    minimumConfidence: 0.1,
    minStateVisits: 2,
    minActionVisits: 2,
  });

  assert.ok(artifact.meta.stateCount > 0);
  assert.ok(artifact.meta.decisionSamples > 0);
  assert.equal(artifact.gameId, 'tic-tac-toe');
});
