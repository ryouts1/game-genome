import test from 'node:test';
import assert from 'node:assert/strict';

import { loadStudioDrafts, removeStudioDraft, saveStudioDraftSnapshot } from '../src/studio/drafts.js';

function createStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

test('studio drafts can save, load, and remove snapshots', () => {
  const storage = createStorageMock();
  const rawGame = {
    id: 'draft-game',
    name: 'Draft Game',
  };

  const saved = saveStudioDraftSnapshot(rawGame, { source: 'test' }, storage);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].gameId, 'draft-game');

  const loaded = loadStudioDrafts(storage);
  assert.equal(loaded.length, 1);

  const afterRemove = removeStudioDraft(loaded[0].snapshotId, storage);
  assert.equal(afterRemove.length, 0);
});
