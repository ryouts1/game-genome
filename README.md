# game-genome studio

JSON で盤面ゲームを定義すると、共通 UI、ルールエンジン、局面分析、Arena、そして `Minimax / MCTS / Genome AI` までそのまま立ち上がるフレームワークです。

今回の版では、単に「ルールを読んで対戦できる」だけでなく、**自己対戦で作った学習済みブックを同梱したハイブリッド AI 基盤**まで含めました。小規模なゲームエンジン集ではなく、**派生 repo を継続的に増やすための母体**として見せることを狙っています。

## この版で強くした点

- `Genome AI` を追加し、学習済みブックと探索を併用できるようにした
- `artifacts/learning/*.book.json` に自己対戦アセットを同梱した
- `scripts/train:self-play` / `scripts/train:bundle` で再学習できるようにした
- `scripts/validate-learning.js` と `docs/training-report.md` を追加した
- Insights パネルで Learned 候補と book hit / miss を見える化した
- Arena でも `Genome AI` を比較対象として回せるようにした

「学習済み」といっても、ニューラルネットを重く回す構成ではありません。**自己対戦で得た state-action 統計をブック化し、既知局面ではそれを優先し、未知局面では Minimax / MCTS に戻す**方針です。就活用ポートフォリオとしては、説明しやすさと再現性を優先しています。

## 何ができるか

### Play / Analyze
- JSON 定義を差し替えても共通の盤面 UI を使える
- Human / Minimax / MCTS / Genome AI / Random を切り替えられる
- タイムラインで過去局面へ戻り、Undo / Redo できる
- Minimax の候補手と principal variation を見られる
- MCTS の候補手、visit 数、coverage、confidence gap を見られる
- Learned 候補表で、学習済みブックがどの手を持っているか確認できる

### Studio
- JSON を直接編集できる
- 構文エラーと定義エラーを分けて表示できる
- Definition Health Check で完成度の弱点を確認できる
- プレビュー適用、ローカル保存、スナップショット保存 / 復元ができる
- JSON import / export、共有リンク作成ができる
- スターターテンプレートから派生ゲームを作り始められる

### Arena
- 現在の定義で AI 同士をまとめて対戦させられる
- 先後入れ替えを自動で回せる
- 勝敗、引き分け、平均手数、決着率、先手勝率、処理時間を集計できる
- 結果を CSV に書き出せる

### Learning bundle
- 自己対戦で生成した学習済みブックを同梱している
- `Genome AI` は book hit が十分強い局面ではブックを採用し、足りない局面では探索に戻る
- `scripts/train-self-play.js` で 1 ゲームだけ再生成できる
- `scripts/train-learning-bundle.js` で学習バンドル一式を再生成できる
- `docs/training-report.md` で生成条件を後追いできる

## 同梱している学習済みアセット

現在は次の 6 ゲームに自己対戦ブックを付けています。今回の版では single-seed の軽い学習ではなく、**multi-seed self-play** に切り替えて総学習量を大きく増やしました。

- `tic-tac-toe`: 1800 episodes / 259 states / 14931 decision samples
- `connect-four`: 75 episodes / 1537 states / 1954 decision samples
- `lane-breakthrough`: 1200 episodes / 1281 states / 19003 decision samples
- `knight-skirmish`: 360 episodes / 1260 states / 11043 decision samples
- `royal-duel`: 750 episodes / 2258 states / 9295 decision samples
- `relay-outpost`: 300 episodes / 2042 states / 5071 decision samples

合計では **4485 episodes / 8637 retained states / 61297 decision samples** です。生成条件の詳細は `docs/training-report.md` を見れば追えます。

## 同梱サンプルゲーム

### Tic Tac Toe
最小の配置ゲームです。`place` と `line` だけで成立する最小構成です。

### Connect Four
`gravity` 制約の例です。列クリックだけで着地するので、配置ゲーム系の派生を作るときの入口に向いています。

### Lane Breakthrough
前進、斜め捕獲、到達勝利を持つ突破ゲームです。将棋系やレース系の派生を考える前段として使えます。

### Knight Skirmish
ナイト移動だけで戦うジャンプ駒ゲームです。`step` だけで飛び越し系の動きを表せるサンプルです。

### Royal Duel
`King / Rook / Bishop` を持つ小型対局です。`step` と `ray` の混在例として入れています。

### Relay Outpost
配置と移動を毎手で選ぶ混成ルールです。`inventory`、`row-zone`、`line`、`reach-row`、`capture-all` を同時に確認できます。

## ディレクトリ構成

```text
game-genome/
├── .github/
├── artifacts/
│   └── learning/
├── assets/
├── docs/
├── games/
├── schema/
├── scripts/
├── src/
│   ├── ai/
│   ├── arena/
│   ├── core/
│   ├── learning/
│   ├── studio/
│   └── ui/
├── tests/
├── index.html
├── package.json
└── README.md
```

## セットアップ

### 起動

```bash
npm install
npm start
```

起動後に `http://localhost:4173` を開いてください。

### テスト

```bash
npm test
```

### 定義検証

```bash
npm run validate:games
```

### 学習済みアセット検証

```bash
npm run validate:learning
```

### 全体チェック

```bash
npm run check
```

### カタログレポート再生成

```bash
npm run catalog:report
```

### 学習レポート再生成

```bash
npm run training:report
```

### 単体再学習

```bash
npm run train:self-play -- --game lane-breakthrough
```

### 学習バンドル再生成

```bash
npm run train:bundle
npm run training:report
```

### 高学習量バンドル再生成

```bash
npm run train:bundle:max
npm run training:report
```

### 新規ゲームのひな形作成

```bash
npm run scaffold:game -- --id my-game --name "My Game" --template movement --register
```

テンプレートは `placement`, `movement`, `duel` の 3 種類です。

## Studio の使い方

1. 既存ゲームを選ぶ
2. 必要ならスターターテンプレートを読み込む
3. JSON を編集する
4. `検証` でエラーと警告を見る
5. Health Check で弱い箇所を確認する
6. `プレビュー適用` で盤面と AI に反映する
7. 必要なら `局面分析` で Minimax / MCTS / Learned 候補を見比べる
8. 良ければ `ローカル保存` する
9. 編集途中は `スナップショット保存` で残す

## 技術的な見どころ

### 1. JSON から UI / Engine / AI を一貫して再利用
ゲーム固有ロジックを `games/*.json` に寄せ、UI、ログ、探索、Arena、学習アセットの読み込みを共通化しています。

### 2. 学習済みブックと探索のハイブリッド
`Genome AI` は book hit が十分強い局面では学習済み手を使い、そうでない局面は Minimax / MCTS へ戻します。検索エンジンを捨てずに学習の効果を見せられる構成です。

### 3. 学習アセットのフォーマットを分離
`artifacts/learning/*.book.json` を UI から独立した配布物として持たせています。ゲーム定義、探索コード、学習成果物の責務が分かれているので、派生 repo にも切り出しやすいです。

### 4. 作る人の導線まで含めた設計
編集、検証、プレビュー、比較、保存、共有、再学習までを 1 本の repo で回せるようにしています。デモではなく、作業基盤としての説得力を出す方向です。

## 既知の制約

- 2 人完全情報・決定論ゲーム向け
- グリッド盤面前提
- 持ち駒、ドロップ、昇格は未対応
- 反復局面の厳密判定は未対応
- Web Worker 化は未対応なので、重い探索はメインスレッドで走る
- 学習済みアセットは統計ブック方式であり、ニューラルネット評価器ではない
- 対称局面の圧縮はまだ入れていない

## 今後の発展案

- book 生成時の対称局面圧縮
- 学習バンドルの差分比較レポート
- Arena から再学習対象局面を抽出する機能
- Web Worker 化による探索分離
- 反復局面検知
- 量子将棋向けの測定・重ね合わせ拡張

## ドキュメント

- `docs/architecture.md`
- `docs/game-definition.md`
- `docs/studio.md`
- `docs/arena.md`
- `docs/cli.md`
- `docs/ai-notes.md`
- `docs/learning.md`
- `docs/design-decisions.md`
- `docs/catalog-report.md`
- `docs/training-report.md`
- `docs/github-publish.md`
- `docs/product-positioning.md`
- `docs/release-checklist.md`
