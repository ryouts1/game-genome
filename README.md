# game-genome studio

JSON で盤面ゲームを定義すると、共通 UI、ルールエンジン、局面分析、Arena、そして `Minimax / MCTS / Genome AI` までそのまま立ち上がるフレームワークです。

この版では、単なる「グリッドに駒を置く小さな DSL」から一段広げて、**masked board・named zone・接続勝利・目標到達・エリア占有**まで扱えるようにしました。派生 repo を量産しやすい母体として、どこまで一般化し、どこをまだ切っているかが説明しやすい構成を狙っています。

## この版で広がった点

- `board.disabledCells` で欠けた盤面を表現できる
- `board.zones` で named zone を持てる
- `place` に `zone` 制約を付けられる
- `reach-zone` / `occupy-zone` / `connect-zones` を終局条件に追加した
- `repetition` draw を追加し、循環局面を明示的に打ち切れるようにした
- 評価関数に `zonePressure` / `connectionPressure` を追加した
- UI 上で blocked cell と zone cell を可視化した
- Studio テンプレートと scaffold CLI から zone / connection 系ゲームを始められる

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
- `connection` / `zone-objective` を含むスターターテンプレートから派生ゲームを作り始められる

### Arena
- 現在の定義で AI 同士をまとめて対戦させられる
- 先後入れ替えを自動で回せる
- 勝敗、引き分け、平均手数、決着率、先手勝率、処理時間を集計できる
- 結果を CSV に書き出せる

### Learning bundle
- 自己対戦で生成した学習済みブックを同梱している
- `Genome AI` は book hit が十分強い局面では学習済み手を使い、足りない局面では探索に戻る
- zone / connection 系の新サンプルは book 未同梱だが、その場合も `Genome AI` は探索へフォールバックする

## サポートしている DSL の範囲

### board
- `width`, `height`
- `disabledCells`
- `zones`

### actionCatalog
- `place`
  - `empty`
  - `gravity`
  - `row-zone`
  - `column-zone`
  - `cell-whitelist`
  - `zone`
- `move-piece`

### movement
- `step`
- `ray`
- `orientation: forward`
- `mode: move / capture / move-or-capture`

### termination
- `line`
- `capture-all`
- `reach-row`
- `reach-zone`
- `occupy-zone`
- `connect-zones`
- `opponent-has-no-legal-moves`
- `board-full`
- `move-limit`
- `no-legal-moves`
- `repetition`

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

### Bridge Link
欠けた盤面と named zone を使う接続ゲームです。`connect-zones` と `connectionPressure` の実例です。

### Sanctum Duel
四隅を欠いた盤面で中央の sanctum を奪い合う小型対局です。`reach-zone` と `repetition` の実例です。

### Ring Control
中央リングの支配を競うエリア制圧ゲームです。`occupy-zone` と `zonePressure` の実例です。

## 同梱している学習済みアセット

現在は次の 6 ゲームに自己対戦ブックを付けています。

- `tic-tac-toe`
- `connect-four`
- `lane-breakthrough`
- `knight-skirmish`
- `royal-duel`
- `relay-outpost`

詳細は `docs/training-report.md` を参照してください。

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

### 新規ゲームのひな形作成

```bash
npm run scaffold:game -- --id my-game --name "My Game" --template connection --register
```

テンプレートは `placement`, `movement`, `duel`, `connection`, `zone-objective` の 5 種類です。

## この repo の見どころ

### 1. 盤面の形状と目的を JSON 側で持てる
`disabledCells` と `zones` を導入したことで、「矩形の中でただ置く / 動かす」だけでなく、**地形を持つ盤面**と**意味のある目標エリア**を定義で扱えるようにしています。

### 2. ルール DSL を広げても UI と AI を崩していない
新しい勝利条件を足しても、共通 UI、局面分析、Arena、Studio の導線はそのまま維持しています。JSON を差し替えたときの再利用性を優先しています。

### 3. 探索だけでなく学習済みアセットも repo に含めている
`Genome AI` は book hit がある局面では学習済み手を使い、ない局面では探索に戻ります。学習成果物を配布物として切り出しているので、派生 repo にも持ち出しやすいです。

### 4. 作る人の導線まで同じ repo に入れている
編集、検証、プレビュー、比較、保存、共有、再学習までを 1 本の repo で回せます。デモではなく、**派生作品を増やすための母艦**として使う前提です。

## 既知の制約

- 2 人完全情報・決定論ゲーム向け
- 盤面は「任意グラフ」ではなく **masked rectangular grid** 前提
- 持ち駒、ドロップ、昇格、多段行動、同一ターン中の連続手は未対応
- 強制捕獲、チェック判定、反則負けなどの高度な裁定は未対応
- Web Worker 化は未対応なので、重い探索はメインスレッドで走る
- 学習済みアセットは統計ブック方式であり、ニューラルネット評価器ではない

## 今後の発展案

- 任意グラフ盤面への一般化
- 移動パターンの条件分岐と multi-step action
- 強制捕獲や特殊ルールの action filter
- 対称局面圧縮を含む学習アセット最適化
- Web Worker 化と large-board 用の探索分離
