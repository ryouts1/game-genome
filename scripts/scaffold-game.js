import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function titleCase(input) {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ');
}

function buildPlacementTemplate({ id, name }) {
  return {
    id,
    name,
    description: `${name} のスターター定義。place と line だけで始める構成です。`,
    board: { width: 3, height: 3 },
    players: [
      { id: 'P1', name: '先手', forward: 1 },
      { id: 'P2', name: '後手', forward: -1 },
    ],
    turnOrder: ['P1', 'P2'],
    pieceKinds: {
      mark: {
        label: 'Mark',
        shortLabel: 'Mark',
        symbolByPlayer: { P1: 'X', P2: 'O' },
        evaluation: { value: 1 },
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
          label: '同じ記号を 3 つ並べる',
          pieceKind: 'mark',
          length: 3,
          directions: 'orthogonal+diagonal',
        },
      ],
      drawConditions: [{ type: 'board-full', label: '盤面が埋まる' }],
    },
    evaluation: {
      weights: {
        material: 0,
        mobility: 0.03,
        centerControl: 0.2,
        advancement: 0,
        linePotential: 3.2,
      },
    },
  };
}

function buildMovementTemplate({ id, name }) {
  return {
    id,
    name,
    description: `${name} のスターター定義。forward 付き step movement から始める構成です。`,
    board: { width: 5, height: 5 },
    players: [
      { id: 'P1', name: '先手', forward: 1 },
      { id: 'P2', name: '後手', forward: -1 },
    ],
    turnOrder: ['P1', 'P2'],
    pieceKinds: {
      soldier: {
        label: 'Soldier',
        shortLabel: 'Soldier',
        symbolByPlayer: { P1: '▲', P2: '▼' },
        movement: [
          {
            type: 'step',
            orientation: 'forward',
            mode: 'move',
            vectors: [[0, 1]],
          },
          {
            type: 'step',
            orientation: 'forward',
            mode: 'capture',
            vectors: [[-1, 1], [1, 1]],
          },
        ],
        evaluation: { value: 2 },
      },
    },
    actionCatalog: [{ type: 'move-piece', pieceKinds: ['soldier'] }],
    initialState: {
      pieces: [
        { kind: 'soldier', owner: 'P1', x: 1, y: 0 },
        { kind: 'soldier', owner: 'P1', x: 3, y: 0 },
        { kind: 'soldier', owner: 'P2', x: 1, y: 4 },
        { kind: 'soldier', owner: 'P2', x: 3, y: 4 },
      ],
    },
    termination: {
      winConditions: [
        {
          type: 'reach-row',
          label: '相手陣の最終列に到達する',
          pieceKind: 'soldier',
          targetRowByPlayer: { P1: 4, P2: 0 },
        },
        {
          type: 'capture-all',
          label: '相手の兵を全て取る',
          pieceKind: 'soldier',
        },
      ],
      drawConditions: [{ type: 'move-limit', label: '60 手で打ち切り', maxMoves: 60 }],
    },
    evaluation: {
      weights: {
        material: 0.8,
        mobility: 0.12,
        centerControl: 0.04,
        advancement: 1.3,
        linePotential: 0,
      },
    },
  };
}

function buildDuelTemplate({ id, name }) {
  return {
    id,
    name,
    description: `${name} のスターター定義。step と ray を混ぜた小型対局です。`,
    board: { width: 5, height: 5 },
    players: [
      { id: 'P1', name: '先手', forward: 1 },
      { id: 'P2', name: '後手', forward: -1 },
    ],
    turnOrder: ['P1', 'P2'],
    pieceKinds: {
      king: {
        label: 'King',
        shortLabel: 'King',
        symbolByPlayer: { P1: '♔', P2: '♚' },
        movement: [
          {
            type: 'step',
            mode: 'move-or-capture',
            vectors: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
          },
        ],
        evaluation: { value: 100 },
      },
      rook: {
        label: 'Rook',
        shortLabel: 'Rook',
        symbolByPlayer: { P1: '♖', P2: '♜' },
        movement: [
          {
            type: 'ray',
            mode: 'move-or-capture',
            vectors: [[1, 0], [-1, 0], [0, 1], [0, -1]],
          },
        ],
        evaluation: { value: 8 },
      },
    },
    actionCatalog: [{ type: 'move-piece', pieceKinds: ['king', 'rook'] }],
    initialState: {
      pieces: [
        { kind: 'rook', owner: 'P1', x: 0, y: 0 },
        { kind: 'king', owner: 'P1', x: 2, y: 0 },
        { kind: 'rook', owner: 'P2', x: 4, y: 4 },
        { kind: 'king', owner: 'P2', x: 2, y: 4 },
      ],
    },
    termination: {
      winConditions: [{ type: 'capture-all', label: '相手の king を取る', pieceKind: 'king' }],
      drawConditions: [{ type: 'move-limit', label: '80 手で打ち切り', maxMoves: 80 }],
    },
    evaluation: {
      weights: {
        material: 1,
        mobility: 0.16,
        centerControl: 0.08,
        advancement: 0,
        linePotential: 0,
      },
    },
  };
}

function buildTemplate(template, config) {
  switch (template) {
    case 'movement':
      return buildMovementTemplate(config);
    case 'duel':
      return buildDuelTemplate(config);
    case 'placement':
    default:
      return buildPlacementTemplate(config);
  }
}

function registerInManifest(id, name, outputPath) {
  const manifestPath = path.resolve(projectRoot, 'games/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  if (manifest.some((entry) => entry.id === id)) {
    console.log(`manifest already has entry "${id}"`);
    return;
  }

  manifest.push({
    id,
    name,
    path: `./games/${path.basename(outputPath)}`,
    summary: `${name} のスターター定義。scaffold script から生成しました。`,
    engineHighlights: [
      'scripts/scaffold-game.js から生成された新規定義',
      'README と docs/game-definition.md を見ながら肉付けしやすい最小構成',
      'そのまま studio で編集してプレビュー可能'
    ],
  });

  manifest.sort((left, right) => left.name.localeCompare(right.name));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function usage() {
  console.log(`
Usage:
  node scripts/scaffold-game.js --id my-game --name "My Game" [--template placement|movement|duel] [--output games/my-game.json] [--register]

Examples:
  npm run scaffold:game -- --id knight-lab --name "Knight Lab" --template duel --register
`);
}

const args = parseArgs(process.argv.slice(2));
if (!args.id || !args.name) {
  usage();
  process.exitCode = 1;
} else {
  const id = String(args.id);
  const name = String(args.name || titleCase(id));
  const template = String(args.template || 'placement');
  const outputPath = path.resolve(projectRoot, args.output || `games/${id}.json`);

  if (existsSync(outputPath)) {
    console.error(`Refusing to overwrite existing file: ${path.relative(projectRoot, outputPath)}`);
    process.exitCode = 1;
  } else {
    const rawGame = buildTemplate(template, { id, name });
    writeFileSync(outputPath, `${JSON.stringify(rawGame, null, 2)}\n`);
    console.log(`Created ${path.relative(projectRoot, outputPath)}`);

    if (args.register) {
      registerInManifest(id, name, outputPath);
      console.log('Updated games/manifest.json');
    }
  }
}
