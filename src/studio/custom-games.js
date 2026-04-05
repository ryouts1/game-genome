const STORAGE_KEY = 'game-genome-custom-games-v1';

function getStorage(explicitStorage = null) {
  if (explicitStorage) {
    return explicitStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function inferCategories(definition) {
  const categories = new Set();
  for (const action of definition.actionCatalog ?? []) {
    if (action.type === 'place') {
      categories.add('placement');
      if ((action.constraints ?? []).some((constraint) => constraint.type === 'gravity')) {
        categories.add('gravity');
      }
    }
    if (action.type === 'move-piece') {
      categories.add('movement');
    }
  }
  return [...categories];
}

function summarizeAuthoringFocus(definition) {
  const actionTypes = (definition.actionCatalog ?? []).map((action) => action.type).join(' / ');
  return actionTypes ? `Custom 定義: ${actionTypes}` : 'Custom 定義';
}

export function loadStoredGameDefinitions(storage = null) {
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
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to load stored games', error);
    return [];
  }
}

export function saveStoredGameDefinitions(definitions, storage = null) {
  const localStorage = getStorage(storage);
  if (!localStorage) {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(definitions));
    return true;
  } catch (error) {
    console.warn('Failed to save stored games', error);
    return false;
  }
}

export function upsertStoredGameDefinition(rawGame, storage = null) {
  const current = loadStoredGameDefinitions(storage);
  const next = current.filter((definition) => definition.id !== rawGame.id);
  next.push(structuredClone(rawGame));
  saveStoredGameDefinitions(next, storage);
  return next;
}

export function removeStoredGameDefinition(gameId, storage = null) {
  const current = loadStoredGameDefinitions(storage);
  const next = current.filter((definition) => definition.id !== gameId);
  saveStoredGameDefinitions(next, storage);
  return next;
}

export function buildCustomManifestEntries(definitions) {
  return definitions.map((definition) => ({
    entryId: `custom:${definition.id}`,
    id: definition.id,
    name: `${definition.name} [Custom]`,
    summary: definition.description || 'ローカル保存されたカスタムゲーム定義です。',
    source: 'custom',
    rawGame: structuredClone(definition),
    categories: inferCategories(definition),
    complexity: 'custom',
    authoringFocus: summarizeAuthoringFocus(definition),
    recommendedControllers: ['human', 'minimax'],
    engineHighlights: [
      'ブラウザ上で編集・検証して保存した定義',
      '共有リンクまたは JSON ファイルにそのまま書き出し可能',
      '既存 UI / AI / Arena をそのまま再利用',
    ],
  }));
}

export function buildSharedManifestEntry(definition) {
  if (!definition) {
    return null;
  }

  return {
    entryId: `shared:${definition.id}`,
    id: definition.id,
    name: `${definition.name} [Shared Preview]`,
    summary: definition.description || 'URL ハッシュから読み込んだ共有定義です。',
    source: 'shared',
    rawGame: structuredClone(definition),
    categories: inferCategories(definition),
    complexity: 'preview',
    authoringFocus: 'URL 共有から読み込んだ一時定義',
    recommendedControllers: ['human', 'minimax'],
    engineHighlights: [
      'URL ハッシュ経由で読み込まれた一時プレビュー',
      'ローカル保存すればカタログに残せる',
      'プレビュー適用で既存 UI / AI / Arena をそのまま利用可能',
    ],
  };
}
