import test from 'node:test';
import assert from 'node:assert/strict';

import { collectDefinitionDiagnostics } from '../src/core/definition-loader.js';

test('definition diagnostics report missing fields', () => {
  const diagnostics = collectDefinitionDiagnostics({
    id: '',
    name: '',
    board: { width: 0, height: 0 },
    players: [{ id: 'P1', name: 'A', forward: 1 }],
    pieceKinds: {},
    actionCatalog: [],
    initialState: { pieces: [] },
    termination: { winConditions: [] },
  });

  assert.ok(diagnostics.errors.length > 0);
});
