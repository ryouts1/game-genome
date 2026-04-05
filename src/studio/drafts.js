const STORAGE_KEY = 'game-genome-studio-drafts-v1';
const MAX_DRAFTS = 8;

function getStorage(explicitStorage = null) {
  if (explicitStorage) {
    return explicitStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

export function loadStudioDrafts(storage = null) {
  const localStorage = getStorage(storage);
  if (!localStorage) {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry && typeof entry === 'object')
      .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());
  } catch (error) {
    console.warn('Failed to load studio drafts', error);
    return [];
  }
}

function persistDrafts(drafts, storage = null) {
  const localStorage = getStorage(storage);
  if (!localStorage) {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch (error) {
    console.warn('Failed to persist studio drafts', error);
    return false;
  }
}

export function saveStudioDraftSnapshot(rawGame, options = {}, storage = null) {
  const current = loadStudioDrafts(storage);
  const timestamp = new Date().toISOString();
  const snapshot = {
    snapshotId: `${rawGame?.id ?? 'untitled'}-${Date.now()}`,
    gameId: rawGame?.id ?? 'untitled',
    gameName: rawGame?.name ?? 'Untitled draft',
    source: options.source ?? 'manual',
    note: options.note ?? '',
    savedAt: timestamp,
    rawGame: structuredClone(rawGame),
  };

  const next = [snapshot, ...current].slice(0, options.maxEntries ?? MAX_DRAFTS);
  persistDrafts(next, storage);
  return next;
}

export function removeStudioDraft(snapshotId, storage = null) {
  const current = loadStudioDrafts(storage);
  const next = current.filter((entry) => entry.snapshotId !== snapshotId);
  persistDrafts(next, storage);
  return next;
}
