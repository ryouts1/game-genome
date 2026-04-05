# ai notes

## Minimax

`src/ai/minimax.js` では alpha-beta pruning を入れています。

- ルートで合法手を列挙
- capture と中心寄りの手を先に読む
- 末端では `evaluateState()` を使う
- transposition table は簡易キャッシュとして利用

### 向いている局面

- 分岐数が少ない
- 明確な tactical win がある
- 1 手先 / 2 手先の勝敗を説明したい

## MCTS

`src/ai/mcts.js` では UCT ベースの探索を行います。

- 未展開手があれば 1 手展開
- 以後は UCT 最大の子を辿る
- ロールアウトは軽い中心・捕獲バイアス付きランダム
- 訪問回数最大の手を返す

### 向いている局面

- 分岐数が多い
- 厳密探索を深くしづらい
- 配置ゲームや長手数ゲーム

## 評価特徴量

### material
盤上の駒価値差です。

### mobility
合法手数の差です。

### centerControl
中央付近の占有度です。

### advancement
相手陣にどれだけ進んでいるかです。

### linePotential
line 系勝利条件に対する将来性です。

## テスト観点

- Tic Tac Toe の即勝ち局面で minimax が勝ち手を取る
- MCTS が少なくとも合法手を返す
- Breakthrough 系で forward 方向が崩れていない
- Connect Four で gravity が効く
