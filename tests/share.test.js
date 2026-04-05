import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeDefinitionFromHash, encodeDefinitionToHash } from '../src/studio/share.js';

test('definition share hash round-trips JSON safely', () => {
  const rawGame = {
    id: 'sample-game',
    name: 'Sample Game',
    description: 'shared',
    board: { width: 3, height: 3 },
    players: [
      { id: 'P1', name: '先手', forward: 1 },
      { id: 'P2', name: '後手', forward: -1 },
    ],
    pieceKinds: {
      mark: {
        label: 'Mark',
        symbolByPlayer: { P1: 'X', P2: 'O' },
      },
    },
    actionCatalog: [
      {
        type: 'place',
        pieceKind: 'mark',
        constraints: [{ type: 'empty' }],
      },
    ],
    initialState: { pieces: [] },
    termination: {
      winConditions: [
        {
          type: 'line',
          pieceKind: 'mark',
          length: 3,
          directions: 'orthogonal+diagonal',
        },
      ],
      drawConditions: [{ type: 'board-full' }],
    },
  };

  const hash = encodeDefinitionToHash(rawGame);
  const restored = decodeDefinitionFromHash(hash);

  assert.deepEqual(restored, rawGame);
});
