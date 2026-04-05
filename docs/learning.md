# Learning bundle

## 何を同梱しているか

`artifacts/learning/*.book.json` には、自己対戦から作った学習済みブックを入れています。各エントリは「ある局面で、どの手をどれだけ選び、その結果どうなったか」を保持します。

この repo はニューラルネット推論器を積んでいるわけではありません。方式としては次です。

1. 既存の `Minimax` または `MCTS` を teacher として自己対戦する
2. 各局面で採用した手と最終結果を記録する
3. `stateKey -> action stats` に集約する
4. 実行時は `Genome AI` がまずそのブックを参照する

現在の配布バンドルは、単一 seed の短い学習ではなく、**multi-seed self-play** で作っています。ゲームごとに seed を変えた複数 shard を回し、最後に state-action 統計をマージして 1 本の book にしています。

## artifact の形

各ファイルはおおむね次の情報を持ちます。

- `gameId`
- `generatedAt`
- `meta.episodes`
- `meta.teacherController`
- `meta.recommendation`
- `meta.trainingPlan`
- `states[]`
  - `stateKey`
  - `visits`
  - `averageValue`
  - `actions[]`
    - `key`
    - `text`
    - `visits`
    - `meanScore`
    - `wins / draws / losses`

## 実行時の判定

`Genome AI` は次の順で判断します。

1. 現局面の `stateKey` を作る
2. 学習済みブックに一致する局面があるか調べる
3. 最良候補の `visits` と、次点との差分 `confidence` を見る
4. 閾値を超えていればブック手を採用する
5. 足りなければ `MCTS` または `Minimax` に戻る

つまり、学習済みブックは探索器を置き換えるものではなく、**既知局面を速く安定してさばく補助層**です。

## 再生成

単体で回す場合:

```bash
npm run train:self-play -- --game lane-breakthrough
```

通常バンドル一式を再生成する場合:

```bash
npm run train:bundle
npm run training:report
```

高学習量の multi-seed バンドルを再生成する場合:

```bash
npm run train:bundle:max
npm run training:report
```

## この方式の利点

- JSON ベースの repo に自然に同梱できる
- 学習成果物が人間に読める
- 誤差のあるブラックボックス推論器より説明しやすい
- multi-seed 化で opening 偏りを減らしやすい
- 派生 repo ごとに軽い学習バンドルを付けやすい

## 制約

- 対称局面圧縮は未実装
- 長期学習で評価器そのものを改善する構成ではない
- エピソード数が少ないゲームでは opening book 的な効き方に寄りやすい
- 学習結果の品質は teacher と episodes に強く依存する
