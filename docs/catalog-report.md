# Catalog report

同梱ゲームの一覧を `games/manifest.json` と各 JSON 定義から生成したメモです。README より細かく、`games/` 配下の見どころをざっと確認したいときに使います。

## Connect Four

- id: `connect-four`
- board: 7 x 6
- categories: placement, gravity, connection
- actions: place:disc
- piece kinds: disc
- win conditions: line
- summary: 重力付き配置ゲーム。列クリックで着地し、同じ UI でも別ルールに変わる例です。

## Knight Skirmish

- id: `knight-skirmish`
- board: 6 x 6
- categories: movement, jump, capture
- actions: move:rider
- piece kinds: rider
- win conditions: capture-all, opponent-has-no-legal-moves
- summary: ナイト移動だけで戦うジャンプ駒ゲーム。step の非隣接移動例として使えます。

## Lane Breakthrough

- id: `lane-breakthrough`
- board: 5 x 5
- categories: movement, race, capture
- actions: move:soldier
- piece kinds: soldier
- win conditions: reach-row, capture-all, opponent-has-no-legal-moves
- summary: 前進・斜め捕獲・到達勝利を持つ駒移動ゲーム。将棋系派生の前段として使えます。

## Relay Outpost

- id: `relay-outpost`
- board: 5 x 5
- categories: hybrid, placement, movement
- actions: place:beacon, move:runner
- piece kinds: runner, beacon
- win conditions: line, reach-row, capture-all
- summary: 配置と移動を毎手で選べる混成ルール。Beacon の 3 連結と Runner の突破を同時に狙います。

## Royal Duel

- id: `royal-duel`
- board: 5 x 5
- categories: movement, ray, duel
- actions: move:king/rook/bishop
- piece kinds: king, rook, bishop
- win conditions: capture-all
- summary: King / Rook / Bishop の最小対局。ray 移動と王駒捕獲を 1 つの JSON にまとめています。

## Tic Tac Toe

- id: `tic-tac-toe`
- board: 3 x 3
- categories: placement, line
- actions: place:mark
- piece kinds: mark
- win conditions: line
- summary: もっとも小さい JSON 定義例。配置アクションと line 勝利条件だけで完結します。

