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

test('zone placement constraint only allows named cells', () => {
  const game = loadGameDefinition({
    id: 'zone-placement-check',
    name: 'Zone Placement Check',
    description: 'zone constraint test',
    board: {
      width: 3,
      height: 3,
      zones: {
        shrine: {
          label: 'Shrine',
          cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
        },
      },
    },
    players: [
      { id: 'P1', name: '先手', forward: 1 },
      { id: 'P2', name: '後手', forward: -1 },
    ],
    turnOrder: ['P1', 'P2'],
    pieceKinds: {
      stone: {
        label: 'Stone',
        symbolByPlayer: { P1: '●', P2: '○' },
        evaluation: { value: 1 },
      },
    },
    actionCatalog: [
      {
        type: 'place',
        pieceKind: 'stone',
        constraints: [{ type: 'empty' }, { type: 'zone', zone: 'shrine' }],
      },
    ],
    initialState: { pieces: [] },
    termination: {
      winConditions: [
        { type: 'line', pieceKind: 'stone', length: 2, directions: 'orthogonal' },
      ],
      drawConditions: [{ type: 'board-full' }],
    },
  });

  const actions = generateLegalActions(game, createInitialState(game));
  assert.deepEqual(actions.map((action) => action.to).sort((a, b) => (a.x - b.x) || (a.y - b.y)), [{ x: 1, y: 1 }, { x: 2, y: 1 }]);
});

test('board-full draw uses playable cells count on masked board', () => {
  const game = loadGameDefinition({
    id: 'masked-fill-check',
    name: 'Masked Fill Check',
    description: 'board full on active cells',
    board: {
      width: 2,
      height: 2,
      disabledCells: [{ x: 1, y: 1 }],
    },
    players: [
      { id: 'P1', name: '先手', forward: 1 },
      { id: 'P2', name: '後手', forward: -1 },
    ],
    turnOrder: ['P1', 'P2'],
    pieceKinds: {
      mark: {
        label: 'Mark',
        symbolByPlayer: { P1: 'X', P2: 'O' },
        evaluation: { value: 1 },
      },
    },
    actionCatalog: [
      { type: 'place', pieceKind: 'mark', constraints: [{ type: 'empty' }] },
    ],
    initialState: { pieces: [] },
    termination: {
      winConditions: [
        { type: 'line', pieceKind: 'mark', length: 3, directions: 'orthogonal+diagonal' },
      ],
      drawConditions: [{ type: 'board-full' }],
    },
  });

  let state = createInitialState(game);
  const sequence = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];

  sequence.forEach((target) => {
    const action = generateLegalActions(game, state).find((candidate) => candidate.to.x === target.x && candidate.to.y === target.y);
    state = applyAction(game, state, action);
  });

  const status = getGameStatus(game, state);
  assert.equal(status.isTerminal, true);
  assert.equal(status.outcome, 'draw');
});

test('bridge-link detects connected path across assigned zones', () => {
  const game = loadFixture('bridge-link.json');
  const state = {
    pieces: [
      { id: 'p1-1', kind: 'link', owner: 'P1', x: 0, y: 3 },
      { id: 'p1-2', kind: 'link', owner: 'P1', x: 1, y: 3 },
      { id: 'p1-3', kind: 'link', owner: 'P1', x: 2, y: 3 },
      { id: 'p1-4', kind: 'link', owner: 'P1', x: 3, y: 3 },
      { id: 'p1-5', kind: 'link', owner: 'P1', x: 4, y: 3 },
      { id: 'p1-6', kind: 'link', owner: 'P1', x: 5, y: 3 },
      { id: 'p1-7', kind: 'link', owner: 'P1', x: 6, y: 3 },
      { id: 'p2-1', kind: 'link', owner: 'P2', x: 1, y: 0 },
    ],
    currentPlayer: 'P2',
    history: [{ playerId: 'P1', text: 'dummy', action: { type: 'place' } }],
    nextPieceSerial: 9,
    lastAction: { type: 'place', to: { x: 6, y: 3 } },
    positionHistory: [],
  };

  const status = getGameStatus(game, state);
  assert.equal(status.isTerminal, true);
  assert.equal(status.winner, 'P1');
  assert.match(status.reason, /接続/);
});

test('sanctum-duel reaches zone when king enters sanctum', () => {
  const game = loadFixture('sanctum-duel.json');
  const state = {
    pieces: [
      { id: 'k1', kind: 'king', owner: 'P1', x: 2, y: 2 },
      { id: 'g1', kind: 'guard', owner: 'P1', x: 1, y: 1 },
      { id: 'k2', kind: 'king', owner: 'P2', x: 2, y: 4 },
      { id: 'g2', kind: 'guard', owner: 'P2', x: 3, y: 3 },
    ],
    currentPlayer: 'P2',
    history: [{ playerId: 'P1', text: 'dummy', action: { type: 'move-piece' } }],
    nextPieceSerial: 5,
    lastAction: { type: 'move-piece', to: { x: 2, y: 2 } },
    positionHistory: [],
  };

  const status = getGameStatus(game, state);
  assert.equal(status.isTerminal, true);
  assert.equal(status.winner, 'P1');
  assert.match(status.reason, /sanctum/i);
});

test('ring-control detects zone occupancy win', () => {
  const game = loadFixture('ring-control.json');
  const state = {
    pieces: [
      { id: 'a', kind: 'guard', owner: 'P1', x: 2, y: 1 },
      { id: 'b', kind: 'guard', owner: 'P1', x: 1, y: 2 },
      { id: 'c', kind: 'guard', owner: 'P1', x: 0, y: 0 },
      { id: 'd', kind: 'guard', owner: 'P2', x: 2, y: 4 },
    ],
    currentPlayer: 'P2',
    history: [{ playerId: 'P1', text: 'dummy', action: { type: 'move-piece' } }],
    nextPieceSerial: 5,
    lastAction: { type: 'move-piece', to: { x: 1, y: 2 } },
    positionHistory: [],
  };

  const status = getGameStatus(game, state);
  assert.equal(status.isTerminal, true);
  assert.equal(status.winner, 'P1');
  assert.match(status.reason, /占有/);
});

test('repetition draw counts repeated serialized states', () => {
  const game = loadGameDefinition({
    id: 'repetition-cycle',
    name: 'Repetition Cycle',
    description: 'repetition draw test',
    board: { width: 4, height: 1 },
    players: [
      { id: 'P1', name: '先手', forward: 1 },
      { id: 'P2', name: '後手', forward: -1 },
    ],
    turnOrder: ['P1', 'P2'],
    pieceKinds: {
      token: {
        label: 'Token',
        symbolByPlayer: { P1: 'A', P2: 'B' },
        movement: [{ type: 'step', mode: 'move', vectors: [[1, 0], [-1, 0]] }],
        evaluation: { value: 1 },
      },
    },
    actionCatalog: [{ type: 'move-piece', pieceKinds: ['token'] }],
    initialState: {
      pieces: [
        { kind: 'token', owner: 'P1', x: 0, y: 0 },
        { kind: 'token', owner: 'P2', x: 3, y: 0 },
      ],
    },
    termination: {
      winConditions: [{ type: 'line', pieceKind: 'token', length: 5, directions: 'orthogonal' }],
      drawConditions: [{ type: 'repetition', count: 3 }],
    },
  });

  let state = createInitialState(game);
  const sequence = [
    { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
    { from: { x: 3, y: 0 }, to: { x: 2, y: 0 } },
    { from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
    { from: { x: 2, y: 0 }, to: { x: 3, y: 0 } },
    { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
    { from: { x: 3, y: 0 }, to: { x: 2, y: 0 } },
    { from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
    { from: { x: 2, y: 0 }, to: { x: 3, y: 0 } },
  ];

  sequence.forEach((expected) => {
    const action = generateLegalActions(game, state).find((candidate) => (
      candidate.from?.x === expected.from.x
      && candidate.from?.y === expected.from.y
      && candidate.to.x === expected.to.x
      && candidate.to.y === expected.to.y
    ));
    state = applyAction(game, state, action);
  });

  const status = getGameStatus(game, state);
  assert.equal(status.isTerminal, true);
  assert.equal(status.outcome, 'draw');
  assert.match(status.reason, /同一局面/);
});
