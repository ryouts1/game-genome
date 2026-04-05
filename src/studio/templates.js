function buildPlacementTemplate() {
  return {
    id: 'starter-placement-grid',
    name: 'Starter Placement Grid',
    description: '最小の配置ゲーム。line 勝利と board-full 引き分けだけで動きます。',
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
        centerControl: 0.22,
        advancement: 0,
        linePotential: 3.4,
      },
    },
  };
}

function buildGravityTemplate() {
  return {
    id: 'starter-gravity-stack',
    name: 'Starter Gravity Stack',
    description: 'gravity 制約付きの 4-in-a-row テンプレートです。列クリックだけで成立します。',
    board: { width: 7, height: 6 },
    players: [
      { id: 'P1', name: '先手', forward: 1 },
      { id: 'P2', name: '後手', forward: -1 },
    ],
    turnOrder: ['P1', 'P2'],
    pieceKinds: {
      disc: {
        label: 'Disc',
        shortLabel: 'Disc',
        symbolByPlayer: { P1: '●', P2: '○' },
        evaluation: { value: 1 },
      },
    },
    actionCatalog: [
      {
        type: 'place',
        pieceKind: 'disc',
        constraints: [{ type: 'empty' }, { type: 'gravity' }],
      },
    ],
    initialState: { pieces: [] },
    termination: {
      winConditions: [
        {
          type: 'line',
          label: '同じ色を 4 つ並べる',
          pieceKind: 'disc',
          length: 4,
          directions: 'orthogonal+diagonal',
        },
      ],
      drawConditions: [{ type: 'board-full', label: '盤面が埋まる' }],
    },
    evaluation: {
      weights: {
        material: 0,
        mobility: 0.01,
        centerControl: 0.16,
        advancement: 0,
        linePotential: 3.8,
      },
    },
  };
}

function buildMovementTemplate() {
  return {
    id: 'starter-lane-race',
    name: 'Starter Lane Race',
    description: 'forward 付き step movement から始める突破ゲームです。',
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

function buildDuelTemplate() {
  return {
    id: 'starter-micro-duel',
    name: 'Starter Micro Duel',
    description: 'step と ray を混ぜた小型対局テンプレートです。',
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

export const STUDIO_TEMPLATES = [
  {
    id: 'placement',
    name: 'Placement starter',
    category: 'foundation',
    description: '最小構成から line 勝利を試せる 3x3 テンプレート。',
    authoringFocus: 'place / line',
    rawGame: buildPlacementTemplate(),
  },
  {
    id: 'gravity',
    name: 'Gravity starter',
    category: 'connection',
    description: 'gravity 制約付きの配置ゲーム。Connect Four 系の派生向け。',
    authoringFocus: 'place / gravity / line',
    rawGame: buildGravityTemplate(),
  },
  {
    id: 'movement',
    name: 'Movement starter',
    category: 'race',
    description: '前進・捕獲・到達勝利を持つ突破ゲームの土台。',
    authoringFocus: 'move-piece / reach-row',
    rawGame: buildMovementTemplate(),
  },
  {
    id: 'duel',
    name: 'Duel starter',
    category: 'tactics',
    description: 'step と ray を混ぜた小型対局。チェス系派生の出発点。',
    authoringFocus: 'ray / capture-all',
    rawGame: buildDuelTemplate(),
  },
];

export function listStudioTemplates() {
  return STUDIO_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    category: template.category,
    description: template.description,
    authoringFocus: template.authoringFocus,
  }));
}

export function getStudioTemplate(templateId) {
  const template = STUDIO_TEMPLATES.find((entry) => entry.id === templateId);
  return template ? structuredClone(template) : null;
}
