# architecture

## 全体像

`game-genome studio` は、ゲーム固有差分を JSON に寄せて、実行まわりを共通化する構成です。

```text
games/*.json
   ↓
definition-loader
   ↓
core engine
   ↓
ui / ai / arena / studio
```

## レイヤ

### 1. definition layer
`games/*.json` がゲーム固有差分です。

- 盤面サイズ
- プレイヤー
- 駒種
- 行動定義
- 初期配置
- 勝敗条件
- 評価重み

### 2. engine layer
`src/core/` がゲーム共通エンジンです。

- `definition-loader.js`: 定義の検証と正規化
- `state.js`: 初期状態生成、盤面参照、局面シリアライズ
- `session.js`: タイムライン管理
- `move-generator.js`: 合法手列挙
- `termination.js`: 終局判定
- `evaluator.js`: 評価関数
- `game-engine.js`: 状態遷移

### 3. ai layer
`src/ai/` が探索です。

- `minimax.js`: alpha-beta 付き探索
- `mcts.js`: UCT ベースの探索
- `controller.js`: Human / Minimax / MCTS / Random の統一入口

### 4. tooling layer
実制作に近い用途を `src/studio/` と `src/arena/` にまとめています。

- `studio/`: 保存、共有、定義エディタ
- `arena/`: バッチ対局と集計

### 5. presentation layer
`src/ui/` が DOM と表示処理です。

## セッション管理を分けた理由

前回版では「現在局面」だけを持てば十分でしたが、定義調整や AI 比較をする場合は次が欲しくなります。

- Undo / Redo
- 過去局面に戻って分岐する
- 候補手分析を過去局面にもかける
- 手順ログとスライダーを同期する

そのため、局面を 1 個だけ持つのではなく、`timeline[] + index` の構造にしています。

## Studio を同じ repo に置いた理由

このリポジトリの価値は「ゲームが動くこと」だけではなく、**新しいゲームを短時間で試せること**です。

Studio を別ツールに分けると次の流れが分断されます。

1. JSON を書く
2. 検証する
3. プレビューする
4. AI を回す
5. 修正する

この往復を速くしたかったので、同じアプリの中に載せています。

## Arena を入れた理由

ゲーム定義は、書いた瞬間よりも「何局か回してみた瞬間」に粗が見えます。

- 先手有利が強すぎないか
- move-limit が短すぎないか
- MCTS だけ勝ちすぎていないか
- 進軍評価が効きすぎていないか

これを毎回手動で確認するのは遅いので、まとめて回せるようにしています。

## DSL を欲張りすぎなかった理由

汎用 DSL を最初から広げすぎると、説明量が増えて repo の焦点がぼやけます。

今回は次の軸で切っています。

- `place`
- `move-piece`
- `step`
- `ray`
- `line`
- `capture-all`
- `reach-row`

これで、面接や README でも「どこまで抽象化したか」「どこをまだ切っているか」が説明しやすくなります。
