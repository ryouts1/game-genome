import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGameDefinition } from '../src/core/definition-loader.js';
import { generateLegalActions } from '../src/core/move-generator.js';
import { applySessionAction, canRedo, canUndo, createSession, jumpToTurn, redoTurn, undoTurn } from '../src/core/session.js';
import { getPresentState } from '../src/core/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  const content = readFileSync(path.resolve(__dirname, `../games/${name}`), 'utf-8');
  return loadGameDefinition(JSON.parse(content));
}

test('session tracks timeline and supports undo / redo', () => {
  const game = loadFixture('tic-tac-toe.json');
  let session = createSession(game);
  let actions = generateLegalActions(game, getPresentState(session));
  const firstMove = actions.find((action) => action.to.x === 0 && action.to.y === 0);

  session = applySessionAction(game, session, firstMove);
  assert.equal(session.timeline.length, 2);
  assert.equal(session.index, 1);
  assert.equal(canUndo(session), true);
  assert.equal(canRedo(session), false);

  session = undoTurn(session);
  assert.equal(session.index, 0);
  assert.equal(canRedo(session), true);

  session = redoTurn(session);
  assert.equal(session.index, 1);

  session = jumpToTurn(session, 0);
  assert.equal(session.index, 0);
});
