import { analyzeController, chooseControllerAction, controllerLabel } from '../ai/controller.js';
import { playAutomatedMatch } from '../arena/simulator.js';
import { collectDefinitionDiagnostics, loadGameDefinition } from '../core/definition-loader.js';
import { evaluateStateDetailed } from '../core/evaluator.js';
import { getLegalActions } from '../core/game-engine.js';
import { getPresentState, applySessionAction, canRedo, canUndo, createSession, jumpToTurn, redoTurn, undoTurn } from '../core/session.js';
import { getPieceAt } from '../core/state.js';
import { getGameStatus } from '../core/termination.js';
import { clamp, formatSignedNumber, safeJsonParse } from '../core/utils.js';
import { buildCustomManifestEntries, buildSharedManifestEntry, loadStoredGameDefinitions, removeStoredGameDefinition, upsertStoredGameDefinition } from '../studio/custom-games.js';
import { loadStudioDrafts, removeStudioDraft, saveStudioDraftSnapshot } from '../studio/drafts.js';
import { decodeDefinitionFromHash, encodeDefinitionToHash } from '../studio/share.js';
import { getStudioTemplate, listStudioTemplates } from '../studio/templates.js';
import { evaluateDefinitionHealth } from '../studio/quality.js';
import { prepareLearnedBook, summarizeLearnedBook } from '../learning/book.js';
import {
  describeBoardHint,
  describeStatus,
  describeTurnIndicator,
  findColumnGravityAction,
  renderAnalysisOverview,
  renderBadgeList,
  renderBoard,
  renderDataTable,
  renderDiagnostics,
  renderDraftList,
  renderFeatureList,
  renderLegend,
  renderMetricGrid,
  renderMoveLog,
  renderRuleSummary,
  renderTextList,
} from './presenters.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function summarizeDefinition(rawGame) {
  const board = rawGame?.board ? `${rawGame.board.width} x ${rawGame.board.height}` : '-';
  const players = Array.isArray(rawGame?.players)
    ? rawGame.players.map((player) => player.name || player.id).join(' / ')
    : '-';
  const pieceKinds = Object.keys(rawGame?.pieceKinds ?? {});
  const actions = Array.isArray(rawGame?.actionCatalog)
    ? rawGame.actionCatalog.map((action) => action.type).join(', ')
    : '-';

  return [
    `id: ${rawGame?.id ?? '-'}`,
    `name: ${rawGame?.name ?? '-'}`,
    `board: ${board}`,
    `players: ${players}`,
    `pieceKinds: ${pieceKinds.join(', ') || '-'}`,
    `actions: ${actions}`,
  ].join('\n');
}

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export class GameShell {
  constructor(dom) {
    this.dom = dom;
    this.baseManifest = [];
    this.learningManifest = [];
    this.learningIndex = new Map();
    this.catalog = [];
    this.catalogIndex = new Map();
    this.builtInCache = new Map();
    this.customDefinitions = new Map();
    this.sharedDefinition = null;
    this.loadedEntry = null;
    this.game = null;
    this.rawGame = null;
    this.session = null;
    this.selectedPieceId = null;
    this.aiBusy = false;
    this.aiSummary = 'まだ AI は手を選んでいません。';
    this.analysis = null;
    this.analysisBusy = false;
    this.editorDiagnostics = [];
    this.definitionHealth = null;
    this.definitionQualityNotes = [];
    this.studioStatus = '定義を編集して検証またはプレビュー適用できます。';
    this.arenaBusy = false;
    this.arenaRows = [];
    this.arenaSummary = null;
    this.draftSnapshots = [];
    this.templateCatalog = [];
    this.aiTimer = null;
  }

  get state() {
    return this.session ? getPresentState(this.session) : null;
  }

  get controllers() {
    if (!this.game) {
      return {};
    }

    const firstPlayerId = this.game.players[0]?.id;
    const secondPlayerId = this.game.players[1]?.id;
    return {
      [firstPlayerId]: this.dom.playerOneController.value,
      [secondPlayerId]: this.dom.playerTwoController.value,
    };
  }

  get currentController() {
    if (!this.state) {
      return 'human';
    }
    return this.controllers[this.state.currentPlayer] ?? 'human';
  }

  get legalActions() {
    if (!this.game || !this.state) {
      return [];
    }
    return getLegalActions(this.game, this.state);
  }

  async initialize() {
    await this.loadBaseManifest();
    await this.loadLearningManifest();
    this.loadStoredDefinitions();
    this.loadSharedDefinitionFromHash();
    this.refreshDrafts();
    this.renderTemplateSelector();
    this.rebuildCatalog();
    this.bindEvents();

    const initialEntry = this.sharedDefinition
      ? `shared:${this.sharedDefinition.id}`
      : this.catalog[0]?.entryId;

    if (!initialEntry) {
      throw new Error('No game definitions available.');
    }

    await this.loadCatalogEntry(initialEntry);
  }

  async loadBaseManifest() {
    const response = await fetch('./games/manifest.json');
    this.baseManifest = await response.json();
  }

  async loadLearningManifest() {
    try {
      const response = await fetch('./artifacts/learning/manifest.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.learningManifest = await response.json();
      this.learningIndex = new Map(this.learningManifest.map((entry) => [entry.gameId, entry]));
    } catch (error) {
      this.learningManifest = [];
      this.learningIndex = new Map();
      this.learningStatus = '学習済みアセットはまだ見つかっていません。';
    }
  }

  async loadLearnedBook(gameId) {
    const entry = this.learningIndex.get(gameId);
    if (!entry) {
      this.learnedBook = null;
      this.learningStatus = 'このゲームには学習済みブックがありません。';
      return;
    }

    try {
      const response = await fetch(entry.path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const rawArtifact = await response.json();
      this.learnedBook = prepareLearnedBook(rawArtifact);
      this.learningStatus = `${summarizeLearnedBook(this.learnedBook)} / source ${entry.sourceLabel ?? 'bundle'}`;
    } catch (error) {
      this.learnedBook = null;
      this.learningStatus = `学習済みブックの読み込みに失敗しました: ${error.message}`;
    }
  }

  loadStoredDefinitions() {
    const stored = loadStoredGameDefinitions();
    this.customDefinitions = new Map(stored.map((definition) => [definition.id, definition]));
  }

  loadSharedDefinitionFromHash() {
    const shared = decodeDefinitionFromHash(window.location.hash);
    if (!shared) {
      return;
    }

    const diagnostics = collectDefinitionDiagnostics(shared);
    if (diagnostics.errors.length > 0) {
      this.studioStatus = '共有リンクの定義にエラーがあるため、既定カタログから起動しました。';
      return;
    }

    this.sharedDefinition = shared;
  }

  refreshDrafts() {
    this.draftSnapshots = loadStudioDrafts();
  }

  renderTemplateSelector() {
    this.templateCatalog = listStudioTemplates();
    this.dom.templateSelector.innerHTML = '';

    this.templateCatalog.forEach((template) => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = `${template.name} (${template.category})`;
      this.dom.templateSelector.append(option);
    });

    if (!this.dom.templateSelector.value && this.templateCatalog[0]) {
      this.dom.templateSelector.value = this.templateCatalog[0].id;
    }

    this.renderTemplateSummary();
  }

  renderTemplateSummary() {
    const template = this.templateCatalog.find((entry) => entry.id === this.dom.templateSelector.value);
    this.dom.templateSummary.textContent = template
      ? `${template.description} / focus: ${template.authoringFocus}`
      : '新しい派生ゲームの叩き台をすぐ editor に入れられます。';
  }

  matchesCatalogFilter(entry, query) {
    const haystack = [
      entry.id,
      entry.name,
      entry.summary,
      entry.authoringFocus,
      ...(entry.categories ?? []),
      ...(entry.engineHighlights ?? []),
      ...(entry.recommendedControllers ?? []),
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  }

  getFilteredCatalog() {
    const query = this.dom.catalogSearch.value.trim().toLowerCase();
    if (!query) {
      return this.catalog;
    }

    return this.catalog.filter((entry) => this.matchesCatalogFilter(entry, query));
  }

  rebuildCatalog() {
    const builtInEntries = this.baseManifest.map((entry) => ({
      ...entry,
      entryId: `builtin:${entry.id}`,
      source: 'builtin',
    }));

    const customEntries = buildCustomManifestEntries([...this.customDefinitions.values()]);
    const sharedEntry = buildSharedManifestEntry(this.sharedDefinition);

    this.catalog = [
      ...builtInEntries,
      ...customEntries,
      ...(sharedEntry ? [sharedEntry] : []),
    ];

    this.catalogIndex = new Map(this.catalog.map((entry) => [entry.entryId, entry]));
    this.renderCatalogSelector();
  }

  renderCatalogSelector() {
    const visibleEntries = this.getFilteredCatalog();
    const query = this.dom.catalogSearch.value.trim().toLowerCase();
    const groups = {
      current: [],
      builtin: [],
      custom: [],
      shared: [],
    };

    if (query && this.loadedEntry && !visibleEntries.some((entry) => entry.entryId === this.loadedEntry.entryId)) {
      groups.current.push(this.loadedEntry);
    }

    visibleEntries.forEach((entry) => {
      groups[entry.source]?.push(entry);
    });

    this.dom.gameSelector.innerHTML = '';

    const labels = {
      current: 'Current selection',
      builtin: 'Built-in',
      custom: 'Custom',
      shared: 'Shared preview',
    };

    const hasEntries = Object.values(groups).some((entries) => entries.length > 0);
    if (!hasEntries) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '一致するゲームがありません';
      option.disabled = true;
      option.selected = true;
      this.dom.gameSelector.append(option);
      return;
    }

    Object.entries(groups).forEach(([source, entries]) => {
      if (!entries.length) {
        return;
      }
      const optgroup = document.createElement('optgroup');
      optgroup.label = labels[source];
      entries.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.entryId;
        option.textContent = entry.name;
        optgroup.append(option);
      });
      this.dom.gameSelector.append(optgroup);
    });

    if (this.loadedEntry && this.catalogIndex.has(this.loadedEntry.entryId)) {
      this.dom.gameSelector.value = this.loadedEntry.entryId;
    }
  }

  bindEvents() {
    this.dom.catalogSearch.addEventListener('input', () => {
      this.renderCatalogSelector();
    });

    this.dom.templateSelector.addEventListener('change', () => {
      this.renderTemplateSummary();
    });

    this.dom.loadTemplateButton.addEventListener('click', () => {
      this.loadTemplateIntoEditor();
    });

    this.dom.gameSelector.addEventListener('change', async (event) => {
      if (!event.target.value) {
        return;
      }
      await this.loadCatalogEntry(event.target.value);
    });

    this.dom.restartButton.addEventListener('click', () => {
      this.resetSession();
    });

    this.dom.undoButton.addEventListener('click', () => {
      this.undo();
    });

    this.dom.redoButton.addEventListener('click', () => {
      this.redo();
    });

    this.dom.runAiButton.addEventListener('click', async () => {
      await this.runAiTurn(true);
    });

    this.dom.analyzeButton.addEventListener('click', async () => {
      await this.analyzeCurrentPosition();
    });

    this.dom.timelineSlider.addEventListener('input', (event) => {
      const turnIndex = Number(event.target.value);
      this.session = jumpToTurn(this.session, turnIndex);
      this.selectedPieceId = null;
      window.clearTimeout(this.aiTimer);
      this.render();
      this.scheduleAiTurn();
    });

    for (const control of [
      this.dom.playerOneController,
      this.dom.playerTwoController,
      this.dom.minimaxDepth,
      this.dom.mctsIterations,
    ]) {
      control.addEventListener('change', () => {
        this.render();
        this.scheduleAiTurn();
      });
    }

    this.dom.definitionEditor.addEventListener('input', () => {
      this.studioStatus = '編集中です。必要なら検証してからプレビュー適用してください。';
      this.dom.studioStatus.textContent = this.studioStatus;
    });

    this.dom.validateDefinitionButton.addEventListener('click', () => {
      this.validateEditorDefinition();
    });

    this.dom.formatDefinitionButton.addEventListener('click', () => {
      this.formatEditorDefinition();
    });

    this.dom.applyDefinitionButton.addEventListener('click', async () => {
      await this.applyEditorDefinition();
    });

    this.dom.saveDefinitionButton.addEventListener('click', async () => {
      await this.saveEditorDefinition();
    });

    this.dom.snapshotDefinitionButton.addEventListener('click', () => {
      this.snapshotEditorDefinition();
    });

    this.dom.resetEditorButton.addEventListener('click', () => {
      this.resetEditorToCurrentGame();
    });

    this.dom.deleteCustomButton.addEventListener('click', async () => {
      await this.deleteCurrentCustomDefinition();
    });

    this.dom.copyShareButton.addEventListener('click', async () => {
      await this.copyShareLink();
    });

    this.dom.exportJsonButton.addEventListener('click', () => {
      this.exportEditorDefinition();
    });

    this.dom.importJsonButton.addEventListener('click', () => {
      this.dom.importJsonInput.click();
    });

    this.dom.importJsonInput.addEventListener('change', async (event) => {
      const [file] = event.target.files ?? [];
      if (file) {
        await this.importDefinitionFile(file);
      }
      event.target.value = '';
    });

    this.dom.arenaRunButton.addEventListener('click', async () => {
      await this.runArenaBatch();
    });

    this.dom.arenaExportButton.addEventListener('click', () => {
      this.exportArenaCsv();
    });
  }

  async resolveRawGame(entry) {
    if (entry.rawGame) {
      return structuredClone(entry.rawGame);
    }

    if (this.builtInCache.has(entry.id)) {
      return structuredClone(this.builtInCache.get(entry.id));
    }

    const response = await fetch(entry.path);
    const rawGame = await response.json();
    this.builtInCache.set(entry.id, rawGame);
    return structuredClone(rawGame);
  }

  updateEditorPanels(rawGame, diagnostics) {
    this.definitionHealth = evaluateDefinitionHealth(rawGame, diagnostics);
    this.definitionQualityNotes = this.definitionHealth.notes;
    this.dom.definitionPreview.textContent = summarizeDefinition(rawGame);
  }

  async loadCatalogEntry(entryId, options = {}) {
    const entry = this.catalogIndex.get(entryId);
    if (!entry) {
      throw new Error(`Unknown catalog entry: ${entryId}`);
    }

    const rawGame = await this.resolveRawGame(entry);
    this.rawGame = structuredClone(rawGame);
    this.game = loadGameDefinition(rawGame);
    this.loadedEntry = entry;
    await this.loadLearnedBook(this.game.id);
    this.renderCatalogSelector();
    this.resetSession(false);

    if (options.syncEditor !== false) {
      this.dom.definitionEditor.value = prettyJson(this.rawGame);
      const diagnostics = collectDefinitionDiagnostics(this.rawGame);
      this.editorDiagnostics = diagnostics.all;
      this.updateEditorPanels(this.rawGame, diagnostics);
      this.studioStatus = '定義を編集して検証またはプレビュー適用できます。';
    }

    this.render();
    this.scheduleAiTurn();
  }

  resetSession(renderNow = true) {
    window.clearTimeout(this.aiTimer);
    this.session = createSession(this.game);
    this.selectedPieceId = null;
    this.aiBusy = false;
    this.aiSummary = 'まだ AI は手を選んでいません。';
    this.analysis = null;
    this.analysisBusy = false;
    if (renderNow) {
      this.render();
      this.scheduleAiTurn();
    }
  }

  undo() {
    if (!canUndo(this.session)) {
      return;
    }
    window.clearTimeout(this.aiTimer);
    this.session = undoTurn(this.session);
    this.selectedPieceId = null;
    this.analysis = null;
    this.render();
    this.scheduleAiTurn();
  }

  redo() {
    if (!canRedo(this.session)) {
      return;
    }
    window.clearTimeout(this.aiTimer);
    this.session = redoTurn(this.session);
    this.selectedPieceId = null;
    this.analysis = null;
    this.render();
    this.scheduleAiTurn();
  }

  handleHumanClick(x, y) {
    const status = getGameStatus(this.game, this.state);
    if (status.isTerminal || this.currentController !== 'human' || this.aiBusy) {
      return;
    }

    const legalActions = this.legalActions;
    const piece = getPieceAt(this.state, x, y);

    if (this.selectedPieceId) {
      const selectedAction = legalActions.find(
        (action) => action.type === 'move-piece' && action.pieceId === this.selectedPieceId && action.to.x === x && action.to.y === y,
      );

      if (selectedAction) {
        this.commitAction(selectedAction, 'human');
        return;
      }

      if (piece?.owner === this.state.currentPlayer) {
        const hasMoves = legalActions.some((action) => action.type === 'move-piece' && action.pieceId === piece.id);
        this.selectedPieceId = hasMoves ? piece.id : null;
        this.render();
        return;
      }

      this.selectedPieceId = null;
      this.render();
      return;
    }

    const directPlacement = legalActions.find(
      (action) => action.type === 'place' && action.to.x === x && action.to.y === y,
    );
    if (directPlacement) {
      this.commitAction(directPlacement, 'human');
      return;
    }

    const hasGravityPlacement = this.game.actionCatalog.some(
      (actionDef) => actionDef.type === 'place' && (actionDef.constraints ?? []).some((constraint) => constraint.type === 'gravity'),
    );
    const gravityPlacement = hasGravityPlacement ? findColumnGravityAction(legalActions, x) : null;
    if (gravityPlacement) {
      this.commitAction(gravityPlacement, 'human');
      return;
    }

    if (piece?.owner === this.state.currentPlayer) {
      const hasMoves = legalActions.some((action) => action.type === 'move-piece' && action.pieceId === piece.id);
      this.selectedPieceId = hasMoves ? piece.id : null;
      this.render();
    }
  }

  commitAction(action, actor) {
    this.session = applySessionAction(this.game, this.session, action);
    this.selectedPieceId = null;
    this.analysis = null;
    if (actor === 'ai') {
      this.aiSummary = `${this.aiSummary} / 選択: ${action.text}`;
    }
    this.render();
    this.scheduleAiTurn();
  }

  async runAiTurn(force = false) {
    const status = getGameStatus(this.game, this.state);
    if (status.isTerminal || this.aiBusy) {
      return;
    }

    const controller = force && this.currentController === 'human' ? 'minimax' : this.currentController;
    if (controller === 'human') {
      return;
    }

    this.aiBusy = true;
    this.render();
    await wait(30);

    const decision = chooseControllerAction(this.game, this.state, controller, {
      depth: Number(this.dom.minimaxDepth.value),
      iterations: Number(this.dom.mctsIterations.value),
      seed: this.state.history.length + 17,
      learnedBook: this.learnedBook,
    });

    this.aiSummary = `${controllerLabel(controller)}: ${decision.summary}`;
    this.aiBusy = false;
    if (decision.action) {
      this.commitAction(decision.action, 'ai');
    } else {
      this.render();
    }
  }

  scheduleAiTurn() {
    const status = getGameStatus(this.game, this.state);
    if (status.isTerminal || this.aiBusy || this.currentController === 'human') {
      return;
    }

    window.clearTimeout(this.aiTimer);
    this.aiTimer = window.setTimeout(() => {
      this.runAiTurn();
    }, 180);
  }

  async analyzeCurrentPosition() {
    if (this.analysisBusy || !this.game || !this.state) {
      return;
    }

    this.analysisBusy = true;
    this.dom.analysisStatus.textContent = '分析中...';
    this.render();
    await wait(30);

    const evaluation = evaluateStateDetailed(this.game, this.state, this.state.currentPlayer);
    const minimax = analyzeController(this.game, this.state, 'minimax', {
      depth: Number(this.dom.minimaxDepth.value),
      candidateLimit: 5,
      pvLimit: 5,
    });
    const mcts = analyzeController(this.game, this.state, 'mcts', {
      iterations: Number(this.dom.mctsIterations.value),
      candidateLimit: 5,
      seed: this.state.history.length + 101,
    });
    const genome = analyzeController(this.game, this.state, 'genome', {
      learnedBook: this.learnedBook,
      candidateLimit: 5,
      depth: Number(this.dom.minimaxDepth.value),
      iterations: Number(this.dom.mctsIterations.value),
      seed: this.state.history.length + 101,
      fallbackAnalysis: mcts,
    });

    this.analysis = {
      evaluation,
      minimax,
      mcts,
      genome,
    };
    this.analysisBusy = false;
    this.render();
  }

  parseEditorDefinition() {
    const parsed = safeJsonParse(this.dom.definitionEditor.value);
    if (!parsed.ok) {
      this.editorDiagnostics = [
        {
          level: 'error',
          path: 'JSON',
          message: parsed.error.message,
        },
      ];
      this.definitionHealth = null;
      this.definitionQualityNotes = ['JSON の構文が壊れているため、health check を計算できません。'];
      this.studioStatus = 'JSON の構文エラーがあります。';
      this.dom.definitionPreview.textContent = 'JSON を解釈できませんでした。';
      this.render();
      return null;
    }

    this.dom.definitionPreview.textContent = summarizeDefinition(parsed.value);
    return parsed.value;
  }

  validateEditorDefinition() {
    const rawGame = this.parseEditorDefinition();
    if (!rawGame) {
      return false;
    }

    const diagnostics = collectDefinitionDiagnostics(rawGame);
    this.editorDiagnostics = diagnostics.all;
    this.updateEditorPanels(rawGame, diagnostics);
    this.studioStatus = diagnostics.errors.length > 0
      ? `エラー ${diagnostics.errors.length} 件 / 警告 ${diagnostics.warnings.length} 件`
      : `エラーなし / 警告 ${diagnostics.warnings.length} 件`;

    this.render();
    return diagnostics.errors.length === 0;
  }

  formatEditorDefinition() {
    const rawGame = this.parseEditorDefinition();
    if (!rawGame) {
      return;
    }

    const diagnostics = collectDefinitionDiagnostics(rawGame);
    this.dom.definitionEditor.value = prettyJson(rawGame);
    this.editorDiagnostics = diagnostics.all;
    this.updateEditorPanels(rawGame, diagnostics);
    this.studioStatus = 'JSON を整形しました。';
    this.render();
  }

  loadTemplateIntoEditor() {
    const template = getStudioTemplate(this.dom.templateSelector.value);
    if (!template) {
      return;
    }

    const rawGame = template.rawGame;
    const diagnostics = collectDefinitionDiagnostics(rawGame);
    this.dom.definitionEditor.value = prettyJson(rawGame);
    this.editorDiagnostics = diagnostics.all;
    this.updateEditorPanels(rawGame, diagnostics);
    this.studioStatus = `テンプレートを読み込みました: ${template.name}`;
    this.render();
  }

  saveDraftSnapshot(rawGame, source, note) {
    this.draftSnapshots = saveStudioDraftSnapshot(rawGame, { source, note });
  }

  async applyEditorDefinition() {
    const rawGame = this.parseEditorDefinition();
    if (!rawGame) {
      return;
    }

    const diagnostics = collectDefinitionDiagnostics(rawGame);
    this.editorDiagnostics = diagnostics.all;
    this.updateEditorPanels(rawGame, diagnostics);
    if (diagnostics.errors.length > 0) {
      this.studioStatus = `適用できません。エラー ${diagnostics.errors.length} 件があります。`;
      this.render();
      return;
    }

    this.sharedDefinition = structuredClone(rawGame);
    this.rebuildCatalog();
    this.saveDraftSnapshot(rawGame, 'preview', 'preview applied');
    this.studioStatus = `プレビューに適用しました: ${rawGame.id}`;
    await this.loadCatalogEntry(`shared:${rawGame.id}`, { syncEditor: false });
  }

  async saveEditorDefinition() {
    const rawGame = this.parseEditorDefinition();
    if (!rawGame) {
      return;
    }

    const diagnostics = collectDefinitionDiagnostics(rawGame);
    this.editorDiagnostics = diagnostics.all;
    this.updateEditorPanels(rawGame, diagnostics);
    if (diagnostics.errors.length > 0) {
      this.studioStatus = `保存できません。エラー ${diagnostics.errors.length} 件があります。`;
      this.render();
      return;
    }

    upsertStoredGameDefinition(rawGame);
    this.loadStoredDefinitions();
    this.rebuildCatalog();
    this.saveDraftSnapshot(rawGame, 'save', 'custom saved');
    this.studioStatus = `ローカル保存しました: ${rawGame.id}`;
    await this.loadCatalogEntry(`custom:${rawGame.id}`, { syncEditor: false });
  }

  snapshotEditorDefinition() {
    const rawGame = this.parseEditorDefinition();
    if (!rawGame) {
      return;
    }

    const diagnostics = collectDefinitionDiagnostics(rawGame);
    this.editorDiagnostics = diagnostics.all;
    this.updateEditorPanels(rawGame, diagnostics);
    this.saveDraftSnapshot(
      rawGame,
      'snapshot',
      diagnostics.errors.length > 0 ? 'with validation errors' : 'manual snapshot',
    );
    this.studioStatus = diagnostics.errors.length > 0
      ? `スナップショット保存: ${rawGame.id} (検証エラーあり)`
      : `スナップショット保存: ${rawGame.id}`;
    this.render();
  }

  restoreDraftSnapshot(snapshotId) {
    const snapshot = this.draftSnapshots.find((entry) => entry.snapshotId === snapshotId);
    if (!snapshot) {
      return;
    }

    const diagnostics = collectDefinitionDiagnostics(snapshot.rawGame);
    this.dom.definitionEditor.value = prettyJson(snapshot.rawGame);
    this.editorDiagnostics = diagnostics.all;
    this.updateEditorPanels(snapshot.rawGame, diagnostics);
    this.studioStatus = `スナップショットを復元しました: ${snapshot.gameName}`;
    this.render();
  }

  deleteDraftSnapshot(snapshotId) {
    this.draftSnapshots = removeStudioDraft(snapshotId);
    this.studioStatus = 'スナップショットを削除しました。';
    this.render();
  }

  resetEditorToCurrentGame() {
    if (!this.rawGame) {
      return;
    }
    const diagnostics = collectDefinitionDiagnostics(this.rawGame);
    this.dom.definitionEditor.value = prettyJson(this.rawGame);
    this.editorDiagnostics = diagnostics.all;
    this.updateEditorPanels(this.rawGame, diagnostics);
    this.studioStatus = '現在のゲーム定義に戻しました。';
    this.render();
  }

  async deleteCurrentCustomDefinition() {
    if (this.loadedEntry?.source !== 'custom') {
      this.studioStatus = '削除できるのは Custom 定義だけです。';
      this.render();
      return;
    }

    removeStoredGameDefinition(this.game.id);
    this.loadStoredDefinitions();
    this.rebuildCatalog();
    this.studioStatus = `削除しました: ${this.game.id}`;
    const fallback = this.catalog.find((entry) => entry.source === 'builtin')?.entryId;
    if (fallback) {
      await this.loadCatalogEntry(fallback);
    }
  }

  async copyShareLink() {
    const rawGame = this.parseEditorDefinition();
    if (!rawGame) {
      return;
    }

    const diagnostics = collectDefinitionDiagnostics(rawGame);
    this.editorDiagnostics = diagnostics.all;
    this.updateEditorPanels(rawGame, diagnostics);
    if (diagnostics.errors.length > 0) {
      this.studioStatus = `共有リンクを作れません。エラー ${diagnostics.errors.length} 件があります。`;
      this.render();
      return;
    }

    const url = new URL(window.location.href);
    url.hash = encodeDefinitionToHash(rawGame);

    try {
      await navigator.clipboard.writeText(url.toString());
      this.studioStatus = '共有リンクをコピーしました。';
    } catch (error) {
      window.prompt('このリンクをコピーしてください', url.toString());
      this.studioStatus = '共有リンクを表示しました。';
    }

    this.render();
  }

  exportEditorDefinition() {
    const parsed = safeJsonParse(this.dom.definitionEditor.value);
    const filename = parsed.ok && parsed.value?.id
      ? `${parsed.value.id}.json`
      : `${this.game?.id ?? 'game-definition'}.json`;

    downloadTextFile(filename, this.dom.definitionEditor.value, 'application/json;charset=utf-8');
    this.studioStatus = `JSON を保存しました: ${filename}`;
    this.render();
  }

  async importDefinitionFile(file) {
    const text = await file.text();
    this.dom.definitionEditor.value = text.endsWith('\n') ? text : `${text}\n`;
    this.studioStatus = `JSON を読み込みました: ${file.name}`;
    this.validateEditorDefinition();
  }

  buildArenaSummary(rows) {
    if (!rows.length) {
      return null;
    }

    const winsA = rows.filter((row) => row.winner === 'A').length;
    const winsB = rows.filter((row) => row.winner === 'B').length;
    const draws = rows.filter((row) => row.winner === 'Draw').length;
    const avgMoves = rows.reduce((sum, row) => sum + row.moves, 0) / rows.length;
    const avgDuration = rows.reduce((sum, row) => sum + row.durationMs, 0) / rows.length;
    const decisiveRate = ((winsA + winsB) / rows.length) * 100;
    const firstPlayerWins = rows.filter((row) => row.firstPlayerWon).length;
    const firstPlayerRate = (firstPlayerWins / rows.length) * 100;

    return [
      { label: 'A 勝利', value: String(winsA), subtle: this.dom.arenaControllerA.value },
      { label: 'B 勝利', value: String(winsB), subtle: this.dom.arenaControllerB.value },
      { label: '引き分け', value: String(draws), subtle: '終局内訳' },
      { label: '平均手数', value: avgMoves.toFixed(1), subtle: '1 局あたり' },
      { label: '決着率', value: `${decisiveRate.toFixed(1)}%`, subtle: '引き分け以外' },
      { label: '先手勝率', value: `${firstPlayerRate.toFixed(1)}%`, subtle: '先手有利の確認' },
      { label: '平均時間', value: `${avgDuration.toFixed(1)} ms`, subtle: 'ブラウザ内実行' },
    ];
  }

  exportArenaCsv() {
    if (!this.arenaRows.length) {
      this.dom.arenaStatus.textContent = 'CSV に書き出せる対局結果がまだありません。';
      return;
    }

    const headers = ['index', 'seats', 'winner', 'outcome', 'moves', 'reason', 'durationMs', 'firstPlayerWon'];
    const lines = [headers.join(',')];
    this.arenaRows.forEach((row) => {
      lines.push(headers.map((header) => escapeCsvCell(row[header])).join(','));
    });

    downloadTextFile(`${this.game?.id ?? 'game'}-arena.csv`, `${lines.join('\n')}\n`, 'text/csv;charset=utf-8');
    this.dom.arenaStatus.textContent = 'Arena 結果を CSV で保存しました。';
  }

  async runArenaBatch() {
    if (this.arenaBusy || !this.game) {
      return;
    }

    this.arenaBusy = true;
    this.arenaRows = [];
    this.arenaSummary = null;
    this.render();

    const controllerA = this.dom.arenaControllerA.value;
    const controllerB = this.dom.arenaControllerB.value;
    const matchCount = clamp(Number(this.dom.arenaMatchCount.value), 1, 200);
    const hardMoveLimit = clamp(Number(this.dom.arenaHardLimit.value), 10, 400);
    const baseSeed = Number(this.dom.arenaSeed.value);
    const swapSides = this.dom.arenaSwapSides.checked;
    const firstPlayerId = this.game.players[0].id;
    const secondPlayerId = this.game.players[1].id;

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const swapped = swapSides && matchIndex % 2 === 1;
      const sideForPlayer = swapped
        ? { [firstPlayerId]: 'B', [secondPlayerId]: 'A' }
        : { [firstPlayerId]: 'A', [secondPlayerId]: 'B' };

      const controllers = {
        [firstPlayerId]: sideForPlayer[firstPlayerId] === 'A' ? controllerA : controllerB,
        [secondPlayerId]: sideForPlayer[secondPlayerId] === 'A' ? controllerA : controllerB,
      };

      const match = playAutomatedMatch(this.game, {
        controllers,
        depth: Number(this.dom.minimaxDepth.value),
        iterations: Number(this.dom.mctsIterations.value),
        hardMoveLimit,
        seed: Number.isFinite(baseSeed) ? baseSeed + matchIndex * 997 : undefined,
        learnedBook: this.learnedBook,
      });

      const winner = match.winner ? sideForPlayer[match.winner] : 'Draw';
      const row = {
        index: matchIndex + 1,
        seats: `P1=${controllers[firstPlayerId]} / P2=${controllers[secondPlayerId]}`,
        winner,
        outcome: match.outcome === 'draw' ? 'Draw' : `${winner} win`,
        moves: match.moves,
        reason: match.reason,
        durationMs: match.durationMs,
        firstPlayerWon: match.winner === firstPlayerId,
      };

      this.arenaRows.push(row);
      this.arenaSummary = this.buildArenaSummary(this.arenaRows);
      this.dom.arenaStatus.textContent = `${matchIndex + 1} / ${matchCount} 局を完了`;
      this.renderArenaPanels();

      if (matchIndex % 2 === 1) {
        await wait(0);
      }
    }

    this.arenaBusy = false;
    this.dom.arenaStatus.textContent = `${matchCount} 局の集計が完了しました。`;
    this.render();
  }

  renderArenaPanels() {
    renderMetricGrid(this.dom.arenaSummary, this.arenaSummary ?? []);
    renderDataTable(
      this.dom.arenaResults,
      [
        { header: '#', key: 'index' },
        { header: 'Seat', key: 'seats' },
        { header: 'Winner', key: 'winner' },
        { header: 'Moves', key: 'moves' },
        { header: 'Reason', key: 'reason' },
        { header: 'ms', key: 'durationMs' },
      ],
      this.arenaRows,
      'まだ対局結果はありません。',
    );
  }

  buildAnalysisNotes() {
    if (!this.analysis) {
      return [];
    }

    const notes = [];
    if (this.analysis.minimax?.principalVariation?.length) {
      notes.push(`Minimax PV: ${this.analysis.minimax.principalVariation.join(' -> ')}`);
    }

    if (this.analysis.mcts?.action) {
      notes.push(
        `MCTS best: ${this.analysis.mcts.action.text} / coverage ${(this.analysis.mcts.rootCoverage * 100).toFixed(1)}% / gap ${(this.analysis.mcts.confidenceGap * 100).toFixed(1)}pt`,
      );
    }

    if (this.analysis.genome?.book?.available) {
      if (this.analysis.genome.book.hit) {
        notes.push(
          `Learned book: hit / samples ${this.analysis.genome.book.entry.visits} / coverage ${(this.analysis.genome.book.coverage * 100).toFixed(1)}%`,
        );
      } else {
        notes.push('Learned book: miss。まだ自己対戦で十分に触れていない局面です。');
      }
    }

    if (this.analysis.genome?.source === 'book' && this.analysis.genome.book?.recommendedAction) {
      notes.push(`Genome AI は学習済み候補 ${this.analysis.genome.book.recommendedAction.text} をそのまま採用できます。`);
    }

    if (this.analysis.minimax?.action && this.analysis.mcts?.action && this.analysis.minimax.action.text !== this.analysis.mcts.action.text) {
      notes.push('Minimax と MCTS の推奨手が分かれています。評価関数と探索量の差を見比べる局面です。');
    }

    return notes;
  }

  renderAnalysisTables() {
    const minimaxRows = this.analysis?.minimax?.candidates?.map((candidate, index) => ({
      index: index + 1,
      action: candidate.action.text,
      score: candidate.score.toFixed(2),
      pv: candidate.principalVariation?.join(' / ') ?? '-',
    })) ?? [];

    const mctsRows = this.analysis?.mcts?.candidates?.map((candidate, index) => ({
      index: index + 1,
      action: candidate.action.text,
      visits: String(candidate.visits),
      winRate: `${(candidate.winRate * 100).toFixed(1)}%`,
    })) ?? [];

    const learnedRows = this.analysis?.genome?.book?.candidates?.map((candidate, index) => ({
      index: index + 1,
      action: candidate.action.text,
      samples: String(candidate.visits),
      value: candidate.seen ? formatSignedNumber(candidate.meanScore, 3) : 'n/a',
    })) ?? [];

    renderDataTable(
      this.dom.minimaxCandidates,
      [
        { header: '#', key: 'index' },
        { header: 'Action', key: 'action' },
        { header: 'Eval', key: 'score' },
        { header: 'PV', key: 'pv' },
      ],
      minimaxRows,
      'まだ Minimax 分析はありません。',
    );

    renderDataTable(
      this.dom.mctsCandidates,
      [
        { header: '#', key: 'index' },
        { header: 'Action', key: 'action' },
        { header: 'Visits', key: 'visits' },
        { header: 'Win rate', key: 'winRate' },
      ],
      mctsRows,
      'まだ MCTS 分析はありません。',
    );

    renderDataTable(
      this.dom.learnedCandidates,
      [
        { header: '#', key: 'index' },
        { header: 'Action', key: 'action' },
        { header: 'Samples', key: 'samples' },
        { header: 'Value', key: 'value' },
      ],
      learnedRows,
      'まだ Learned 候補はありません。',
    );

    renderTextList(this.dom.analysisNotes, this.buildAnalysisNotes(), 'まだ分析はありません。');
  }

  render() {
    if (!this.game || !this.state) {
      return;
    }

    const status = getGameStatus(this.game, this.state);
    const legalActions = this.legalActions;
    const entry = this.loadedEntry ?? {};
    const currentEvaluation = evaluateStateDetailed(this.game, this.state, this.state.currentPlayer);

    this.dom.gameSelector.value = entry.entryId ?? '';
    this.dom.gameSummary.textContent = entry.summary ?? this.game.description ?? '';
    this.dom.gameIdBadge.textContent = this.game.id;
    this.dom.gameSourceBadge.textContent = entry.source ?? '-';
    this.dom.gameComplexityBadge.textContent = entry.complexity ?? '-';
    renderBadgeList(this.dom.gameTags, (entry.categories ?? []).map((category) => `#${category}`), 'no tags');
    this.dom.gameMetaText.textContent = [
      entry.authoringFocus ? `focus: ${entry.authoringFocus}` : null,
      entry.recommendedControllers?.length ? `recommended: ${entry.recommendedControllers.join(' / ')}` : null,
    ].filter(Boolean).join(' / ');

    this.dom.boardTitle.textContent = this.game.name;
    this.dom.turnIndicator.textContent = describeTurnIndicator(this.game, this.state);
    this.dom.statusText.textContent = describeStatus(this.game, this.state, status, this.controllers, this.aiBusy);
    this.dom.boardHint.textContent = describeBoardHint(this.game, this.state, legalActions, this.selectedPieceId);
    this.dom.aiSummary.textContent = this.aiSummary;
    this.dom.learningStatus.textContent = this.learningStatus;

    renderMetricGrid(this.dom.boardStats, [
      {
        label: '現在手数',
        value: `${this.state.history.length}`,
        subtle: `timeline ${this.session.index}/${this.session.timeline.length - 1}`,
      },
      {
        label: '合法手',
        value: `${legalActions.length}`,
        subtle: status.isTerminal ? '終局' : '次の一手候補',
      },
      {
        label: '盤上の駒',
        value: `${this.state.pieces.length}`,
        subtle: `${this.game.board.width * this.game.board.height} マス`,
      },
      {
        label: '現局面評価',
        value: formatSignedNumber(currentEvaluation.total),
        subtle: `手番側 ${this.state.currentPlayer}`,
      },
      {
        label: 'Learned states',
        value: this.learnedBook ? `${this.learnedBook.states.length}` : '-',
        subtle: this.learnedBook ? `${this.learnedBook.meta?.episodes ?? 0} self-play` : 'asset unavailable',
      },
    ]);

    renderBoard({
      container: this.dom.boardContainer,
      game: this.game,
      state: this.state,
      legalActions,
      selectedPieceId: this.selectedPieceId,
      onCellClick: (x, y) => this.handleHumanClick(x, y),
    });

    renderLegend(this.dom.legend, this.game);
    renderRuleSummary(this.dom.ruleSummary, this.game);
    renderMoveLog(this.dom.moveLog, this.game, this.state.history);
    renderFeatureList(this.dom.featureList, entry.engineHighlights ?? []);

    this.dom.timelineSlider.max = String(this.session.timeline.length - 1);
    this.dom.timelineSlider.value = String(this.session.index);
    this.dom.timelineLabel.textContent = `${this.session.index} 手目 / 記録 ${this.session.timeline.length - 1} 手`;
    this.dom.undoButton.disabled = !canUndo(this.session) || this.aiBusy;
    this.dom.redoButton.disabled = !canRedo(this.session) || this.aiBusy;
    this.dom.runAiButton.disabled = this.aiBusy || status.isTerminal;
    this.dom.analyzeButton.disabled = this.analysisBusy;
    this.dom.deleteCustomButton.disabled = this.loadedEntry?.source !== 'custom';

    this.dom.analysisStatus.textContent = this.analysisBusy
      ? '分析中...'
      : (this.analysis
        ? `Minimax depth ${this.analysis.minimax.depth} / MCTS ${this.analysis.mcts.iterations} 回 / Genome ${this.analysis.genome?.source ?? '-'}`
        : '未実行');

    renderAnalysisOverview(this.dom.analysisOverview, this.analysis?.evaluation ?? currentEvaluation);
    this.renderAnalysisTables();

    renderDiagnostics(this.dom.definitionDiagnostics, this.editorDiagnostics);
    renderMetricGrid(this.dom.definitionHealth, this.definitionHealth?.metrics ?? []);
    renderTextList(this.dom.definitionQualityNotes, this.definitionQualityNotes, 'health note はまだありません。');
    renderDraftList(this.dom.draftList, this.draftSnapshots, {
      onRestore: (snapshotId) => this.restoreDraftSnapshot(snapshotId),
      onDelete: (snapshotId) => this.deleteDraftSnapshot(snapshotId),
    });
    this.dom.studioStatus.textContent = this.studioStatus;
    if (!this.dom.definitionPreview.textContent) {
      this.dom.definitionPreview.textContent = summarizeDefinition(this.rawGame);
    }

    if (!this.arenaBusy && !this.arenaSummary) {
      renderMetricGrid(this.dom.arenaSummary, []);
    }
    if (!this.arenaBusy && this.arenaRows.length === 0) {
      renderDataTable(this.dom.arenaResults, [], [], 'まだ対局結果はありません。');
    } else {
      this.renderArenaPanels();
    }

    this.dom.arenaRunButton.disabled = this.arenaBusy;
    this.dom.arenaExportButton.disabled = this.arenaRows.length === 0;
  }
}
