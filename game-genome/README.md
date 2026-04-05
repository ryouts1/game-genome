# game-genome

JSON で盤面ゲームを定義すると、共通 UI・共通ルールエンジン・Minimax / MCTS AI でそのまま遊べるフレームワークです。

就活ポートフォリオの文脈では、単体のゲーム実装を 1 本ずつ作るのではなく、**「ゲーム定義を差し替えて派生 repo を増やせる設計」**を見せるための土台として置いています。量子将棋のような派生作品を別 repo として切り出す前に、このリポジトリを共通基盤として見せる想定です。

## 何を見てほしいか

- JSON 定義から UI / ルール / AI を起動するため、**ゲーム固有ロジックとフレームワーク層を分離**していること
- `place`, `move-piece`, `line`, `gravity`, `reach-row`, `capture-all` など、**よく使う盤面ゲーム要素を宣言的に表現**していること
- 同じ盤面エンジン上で **Tic Tac Toe / Connect Four / 突破ゲーム / 王駒捕獲ゲーム**を動かし、派生のしやすさを示していること
- AI を minimax / MCTS の 2 系統で用意し、**ゲームの分岐数や性質に応じて選べる**こと

## 現在のスコープ

このフレームワークは、次のようなゲームを対象にしています。

- 2 人対戦
- 完全情報・決定論的ターン制
- 長方形グリッド盤面
- 交互着手
- 盤上の駒移動、または空きマスへの配置

量子将棋 repo をこの上に作る場合は、盤面 UI・履歴・AI 差し替え・ゲーム定義管理の基盤を再利用しつつ、量子重ね合わせや測定ルールなどを追加実装する想定です。

## ディレクトリ構成

```text
game-genome/
├── assets/
│   └── styles.css
├── docs/
│   ├── ai-notes.md
│   ├── architecture.md
│   ├── design-decisions.md
│   └── game-definition.md
├── games/
│   ├── manifest.json
│   ├── connect-four.json
│   ├── lane-breakthrough.json
│   ├── royal-duel.json
│   └── tic-tac-toe.json
├── schema/
│   └── game-definition.schema.json
├── scripts/
│   └── dev-server.js
├── src/
│   ├── ai/
│   │   ├── mcts.js
│   │   ├── minimax.js
│   │   └── random.js
│   ├── core/
│   │   ├── definition-loader.js
│   │   ├── evaluator.js
│   │   ├── game-engine.js
│   │   ├── move-generator.js
│   │   ├── state.js
│   │   ├── termination.js
│   │   └── utils.js
│   ├── ui/
│   │   ├── game-shell.js
│   │   └── presenters.js
│   └── app.js
├── tests/
│   ├── ai.test.js
│   └── engine.test.js
├── index.html
├── package.json
└── README.md
```

## 同梱しているサンプルゲーム

### 1. Tic Tac Toe
最小の配置ゲームです。`place` と `line` のみで完結するため、JSON 定義の入り口として使えます。

### 2. Connect Four
`gravity` 制約を追加しただけで、同じ UI でも列落下型ゲームに切り替わります。Minimax と MCTS の比較もしやすい題材です。

### 3. Lane Breakthrough
前進・斜め捕獲・到達勝利を持つ小型駒ゲームです。将棋やチェス系派生 repo に繋げやすいサンプルです。

### 4. Royal Duel
`King / Rook / Bishop` の最小対戦です。`step` と `ray` を同居させ、`capture-all(king)` で王駒捕獲型の終局を表現しています。

## 実行方法

### 1. ローカル起動

```bash
npm install
npm start
```

起動後、`http://localhost:4173` をブラウザで開いてください。

### 2. テスト

```bash
npm test
```

依存は Node 標準機能だけに絞っているため、`npm install` の実質的な役割は lockfile なしでもコマンドを統一して使うことです。

## JSON 定義の基本形

```json
{
  "id": "tic-tac-toe",
  "name": "Tic Tac Toe",
  "board": { "width": 3, "height": 3 },
  "players": [
    { "id": "P1", "name": "先手", "forward": 1 },
    { "id": "P2", "name": "後手", "forward": -1 }
  ],
  "pieceKinds": {
    "mark": {
      "label": "Mark",
      "symbolByPlayer": { "P1": "X", "P2": "O" }
    }
  },
  "actionCatalog": [
    {
      "type": "place",
      "pieceKind": "mark",
      "constraints": [{ "type": "empty" }]
    }
  ],
  "initialState": { "pieces": [] },
  "termination": {
    "winConditions": [
      {
        "type": "line",
        "pieceKind": "mark",
        "length": 3,
        "directions": "orthogonal+diagonal"
      }
    ],
    "drawConditions": [{ "type": "board-full" }]
  }
}
```

より詳しい仕様は `docs/game-definition.md` を参照してください。

## 実装上の工夫

### ルールエンジン

- 駒移動は `step` / `ray` の 2 種類に整理
- 向き依存ルールは `orientation: "forward"` とプレイヤーの `forward` で吸収
- 配置ルールは `empty`, `gravity`, `row-zone`, `column-zone`, `cell-whitelist` を組み合わせ可能
- 終局判定は `line`, `capture-all`, `reach-row`, `opponent-has-no-legal-moves`, `board-full`, `move-limit` を共通化

### AI

- **Minimax**: alpha-beta pruning と簡易 move ordering を実装
- **MCTS**: UCT ベースで展開し、ロールアウトは軽いヒューリスティック付きランダムにしている
- 評価関数は `material`, `mobility`, `centerControl`, `advancement`, `linePotential` をゲームごとに重み調整できる

### UI

- 盤面はゲーム JSON を差し替えても同じ画面で動作
- 人間 vs AI / AI vs AI を切り替え可能
- 重力付き配置ゲームでは、列のどこを押しても合法な着地点に吸着
- 手順ログを残し、局面の追跡がしやすい

## テスト方針

- ルール生成の正しさ
- 勝敗判定の正しさ
- 重力付き配置の合法手
- 前進 / 斜め捕獲の向き処理
- Minimax が即勝ち手を選べるか
- MCTS が少なくとも合法手を返すか

詳細は `docs/ai-notes.md` と `tests/` を参照してください。

## 今後の発展案

- 盤外の持ち駒、ドロップ、昇格
- 反復局面や千日手の扱い
- JSON Schema の厳密化
- Web Worker 化による AI 思考の非同期分離
- 量子将棋向けの「重ね合わせ状態」「測定」「確率付き評価」の追加
- 派生 repo 用のテンプレート生成 CLI

## 既知の制約

- 現在は 2 人ゼロ和ゲーム向け
- 完全情報・決定論的ルールを前提としている
- UI は軽量優先で、アニメーションや音は未実装
- 大きいゲームでは Minimax の深さを上げすぎると重くなる

## 派生 repo の作り方

1. `games/` に新しい JSON を追加する
2. `games/manifest.json` に登録する
3. 必要なら評価重みを調整する
4. README に、そのゲームで何を見せる repo なのかを書く

この流れにすると、単発の CRUD ではなく、**共通基盤を持ったゲーム設計ポートフォリオ**として GitHub 全体を組み立てやすくなります。
