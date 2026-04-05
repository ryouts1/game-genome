# AI notes

## 役割分担

この repo には 4 つの AI 系コントローラがあります。

- `Minimax`: 小盤面や読み筋を明示したいゲーム向け
- `MCTS`: 分岐が広いゲームや厳密読みが難しいゲーム向け
- `Genome AI`: 学習済みブックを先に見て、足りなければ探索へ戻るハイブリッド
- `Random`: ルール破綻の確認や比較用の下限

## Minimax

alpha-beta pruning を使っています。局面表と手順 ordering を入れているので、小規模ゲームではかなり安定して読み筋を返せます。

### 向いているケース
- Tic Tac Toe
- Lane Breakthrough
- 小盤面の突破ゲーム
- ルール説明のために principal variation を見せたいケース

### UI で見られるもの
- 最善手
- 探索深さ
- 探索ノード数
- 候補手ごとの評価値
- principal variation

## MCTS

UCT ベースです。rollout は完全ランダムではなく、中心寄り・捕獲寄りの軽いバイアスを載せています。

### 向いているケース
- Connect Four
- Relay Outpost
- 分岐が広いゲーム
- 厳密読みより傾向把握を優先したいケース

### UI で見られるもの
- 最善手
- 反復回数
- 候補手ごとの visit 数
- 候補手ごとの win rate
- coverage
- confidence gap

## Genome AI

`Genome AI` は、自己対戦で生成した state-action 統計ブックを最初に参照します。十分なサンプル数と差がある局面ではブック手を採用し、そうでなければ Minimax / MCTS に戻ります。

### この方式を採った理由
- ニューラルネットより説明しやすい
- 生成物を JSON として repo に同梱しやすい
- 既存の探索器を捨てずに性能改善を見せられる
- 派生 repo でも「学習済みアセット付き」の見せ方がしやすい

### UI で見られるもの
- Learned 候補表
- book hit / miss
- サンプル数
- coverage
- Genome が book を採用したか、探索へ戻ったか

## 評価関数

現在は次の合成です。

- `material`
- `mobility`
- `centerControl`
- `advancement`
- `linePotential`

勝率と手触りがズレる場合は、まずここを調整し、そのうえで学習ブックのエピソード数を増やす想定です。

## 学習済みアセットの位置づけ

この repo での「学習済み」は、ニューラルネット学習済みモデルではなく、**自己対戦から得た state-action 統計ブック**です。性能を誇張するより、どう作ってどう使っているかを説明しやすくすることを優先しています。
