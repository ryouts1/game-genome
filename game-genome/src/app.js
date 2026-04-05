import { GameShell } from './ui/game-shell.js';

const dom = {
  gameSelector: document.querySelector('#game-selector'),
  gameSummary: document.querySelector('#game-summary'),
  playerOneController: document.querySelector('#player-one-controller'),
  playerTwoController: document.querySelector('#player-two-controller'),
  minimaxDepth: document.querySelector('#minimax-depth'),
  mctsIterations: document.querySelector('#mcts-iterations'),
  restartButton: document.querySelector('#restart-button'),
  runAiButton: document.querySelector('#run-ai-button'),
  statusText: document.querySelector('#status-text'),
  legend: document.querySelector('#legend'),
  featureList: document.querySelector('#feature-list'),
  boardTitle: document.querySelector('#board-title'),
  turnIndicator: document.querySelector('#turn-indicator'),
  boardContainer: document.querySelector('#board-container'),
  boardHint: document.querySelector('#board-hint'),
  ruleSummary: document.querySelector('#rule-summary'),
  aiSummary: document.querySelector('#ai-summary'),
  moveLog: document.querySelector('#move-log'),
};

const shell = new GameShell(dom);
shell.initialize().catch((error) => {
  console.error(error);
  dom.statusText.textContent = `初期化に失敗しました: ${error.message}`;
});
