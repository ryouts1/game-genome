# game definition

## 基本構造

ゲーム定義は次の要素で構成します。

- `id`
- `name`
- `description`
- `board`
- `players`
- `turnOrder`
- `pieceKinds`
- `actionCatalog`
- `initialState`
- `termination`
- `evaluation`

## 最小例

```json
{
  "id": "tic-tac-toe",
  "name": "Tic Tac Toe",
  "description": "3x3 配置ゲーム",
  "board": { "width": 3, "height": 3 },
  "players": [
    { "id": "P1", "name": "先手", "forward": 1 },
    { "id": "P2", "name": "後手", "forward": -1 }
  ],
  "turnOrder": ["P1", "P2"],
  "pieceKinds": {
    "mark": {
      "label": "Mark",
      "symbolByPlayer": { "P1": "X", "P2": "O" },
      "evaluation": { "value": 1 }
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

## board

```json
"board": { "width": 7, "height": 6 }
```

矩形グリッド盤面を前提にしています。

## players

`forward` は前進方向の向きを表します。

- `1`: 下方向へ進む
- `-1`: 上方向へ進む

`orientation: "forward"` の movement で使います。

## pieceKinds

### 記号

```json
"symbolByPlayer": {
  "P1": "▲",
  "P2": "▼"
}
```

プレイヤーごとに記号を切り替えられます。

### movement

現在対応しているのは `step` と `ray` です。

#### step

```json
{
  "type": "step",
  "mode": "move-or-capture",
  "vectors": [[1, 2], [2, 1], [-1, 2], [-2, 1]]
}
```

固定距離移動です。ナイト移動のような飛び越し系にも使えます。

#### ray

```json
{
  "type": "ray",
  "mode": "move-or-capture",
  "vectors": [[1, 0], [-1, 0], [0, 1], [0, -1]]
}
```

障害物に当たるまで伸びる移動です。`maxDistance` を付ければ長さ制限もできます。

#### mode

- `move`
- `capture`
- `move-or-capture`

#### orientation

- `absolute`
- `forward`

`forward` を使うと、`players[].forward` に応じてベクトルの y が反転します。

## actionCatalog

### place

```json
{
  "type": "place",
  "pieceKind": "disc",
  "constraints": [
    { "type": "empty" },
    { "type": "gravity" }
  ]
}
```

#### place の制約
- `empty`
- `gravity`
- `row-zone`
- `column-zone`
- `cell-whitelist`

### move-piece

```json
{
  "type": "move-piece",
  "pieceKinds": ["king", "rook"]
}
```

指定した駒種だけ移動できます。

## initialState

```json
"initialState": {
  "pieces": [
    { "kind": "king", "owner": "P1", "x": 2, "y": 0 }
  ]
}
```

座標重複はエラーになります。

## termination

### winConditions

- `line`
- `capture-all`
- `reach-row`
- `opponent-has-no-legal-moves`

### drawConditions

- `board-full`
- `move-limit`
- `no-legal-moves`

## evaluation

```json
"evaluation": {
  "weights": {
    "material": 1,
    "mobility": 0.08,
    "centerControl": 0.06,
    "advancement": 0.12,
    "linePotential": 1.3
  }
}
```

現在の評価関数は次の要素を足し合わせています。

- material
- mobility
- centerControl
- advancement
- linePotential

## Studio 上の診断

Studio では次のような診断を返します。

- JSON の構文エラー
- 未知の piece kind 参照
- turnOrder の重複
- 初期配置の重複
- draw 条件不足の警告
- 大盤面や重すぎる設定への警告

Schema と実装側検証の両方を置いているため、IDE 補完と実行時診断の両方を使えます。
