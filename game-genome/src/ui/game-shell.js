import { chooseMctsAction } from '../ai/mcts.js';
import { chooseMinimaxAction } from '../ai/minimax.js';
import { applyAction, getLegalActions } from '../core/game-engine.js';
import { loadGameDefinition } from '../core/definition-loader.js';
import { createInitialState, getPieceAt } from '../core/state.js';
import { getGameStatus } from '../core/termination.js';
import {
  describeBoardHint,
  describeStatus,
  describeTurnIndicator,
  findColumnGravityAction,
  renderBoard,
  renderFeatureList,
  renderLegend,
  renderMoveLog,
  renderRuleSummary,
} from './presenters.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GameShell {
  constructor(dom) {
    this.dom = dom;
    this.manifest = [];
    this.manifestIndex = new Map();
    this.game = null;
    this.state = null;
    this.selectedPieceId = null;
    this.aiBusy = false;
    this.aiSummary = 'まだ AI は手を選んでいません。';
  }

  async initialize() {
    await this.loadManifest();
    this.bindEvents();
    const first = this.manifest[0];
    await this.loadGame(first.id);
  }

  async loadManifest() {
    const response = await fetch('./games/manifest.json');
    this.manifest = await response.json();
    this.manifestIndex = new Map(this.manifest.map((entry) => [entry.id, entry]));

    this.dom.gameSelector.innerHTML = '';
    for (const entry of this.manifest) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.name;
      this.dom.gameSelector.append(option);
    }
  }

  bindEvents() {
    this.dom.gameSelector.addEventListener('change', async (event) => {
      await this.loadGame(event.target.value);
    });

    this.dom.restartButton.addEventListener('click', () => {
      this.resetState();
    });

    this.dom.runAiButton.addEventListener('click', async () => {
      await this.runAiTurn(true);
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
  }

  async loadGame(gameId) {
    const entry = this.manifestIndex.get(gameId);
    const response = await fetch(entry.path);
    const rawGame = await response.json();
    this.game = loadGameDefinition(rawGame);
    this.dom.gameSelector.value = gameId;
    this.dom.gameSummary.textContent = entry.summary;
    this.resetState();
  }

  resetState() {
    window.clearTimeout(this.aiTimer);
    this.state = createInitialState(this.game);
    this.selectedPieceId = null;
    this.aiBusy = false;
    this.aiSummary = 'まだ AI は手を選んでいません。';
    this.render();
    this.scheduleAiTurn();
  }

  get controllers() {
    const firstPlayerId = this.game.players[0]?.id;
    const secondPlayerId = this.game.players[1]?.id;
    return {
      [firstPlayerId]: this.dom.playerOneController.value,
      [secondPlayerId]: this.dom.playerTwoController.value,
    };
  }

  get currentController() {
    return this.controllers[this.state.currentPlayer] ?? 'human';
  }

  get legalActions() {
    return getLegalActions(this.game, this.state);
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
    this.state = applyAction(this.game, this.state, action);
    this.selectedPieceId = null;
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
    await wait(60);

    const legalActions = this.legalActions;
    if (legalActions.length === 0) {
      this.aiBusy = false;
      this.render();
      return;
    }

    let decision = null;
    if (controller === 'minimax') {
      decision = chooseMinimaxAction(this.game, this.state, {
        depth: Number(this.dom.minimaxDepth.value),
      });
    } else {
      decision = chooseMctsAction(this.game, this.state, {
        iterations: Number(this.dom.mctsIterations.value),
      });
    }

    this.aiSummary = `${controller.toUpperCase()}: ${decision.summary}`;
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

  render() {
    const status = getGameStatus(this.game, this.state);
    const legalActions = this.legalActions;
    const entry = this.manifestIndex.get(this.game.id);

    this.dom.boardTitle.textContent = this.game.name;
    this.dom.turnIndicator.textContent = describeTurnIndicator(this.game, this.state);
    this.dom.statusText.textContent = describeStatus(this.game, this.state, status, this.controllers, this.aiBusy);
    this.dom.boardHint.textContent = describeBoardHint(this.game, this.state, legalActions, this.selectedPieceId);
    this.dom.aiSummary.textContent = this.aiSummary;

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
  }
}
