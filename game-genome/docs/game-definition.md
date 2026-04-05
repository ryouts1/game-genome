# game definition

## 前提

現在の定義フォーマットは、2 人対戦・長方形グリッド・完全情報ゲームを対象にしています。

## トップレベル項目

### `id`
ゲーム識別子。`manifest.json` から参照します。

### `name`
表示名です。

### `description`
ゲーム概要です。UI 側で補助説明に使えます。

### `board`
```json
{ "width": 7, "height": 6 }
```

### `players`
```json
[
  { "id": "P1", "name": "先手", "forward": 1 },
  { "id": "P2", "name": "後手", "forward": -1 }
]
```

- `forward` は前進方向です
- `1` は下方向、`-1` は上方向として扱います

### `pieceKinds`
駒種定義です。

```json
{
  "soldier": {
    "label": "Soldier",
    "shortLabel": "Soldier",
    "symbolByPlayer": { "P1": "▲", "P2": "▼" },
    "movement": [
      {
        "type": "step",
        "orientation": "forward",
        "mode": "move",
        "vectors": [[0, 1]]
      }
    ],
    "evaluation": { "value": 2 }
  }
}
```

#### `movement`
現在サポートしている型は次の 2 つです。

- `step`: 1 回の跳躍移動
- `ray`: 直線に伸びる移動

#### `mode`
- `move`: 空きマスのみ
- `capture`: 相手駒のあるマスのみ
- `move-or-capture`: 両方

#### `orientation`
- 省略時または `absolute`: ベクトルをそのまま使う
- `forward`: プレイヤーの向きで `dy` を反転する

## `actionCatalog`

### 配置型
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

### 移動型
```json
{
  "type": "move-piece",
  "pieceKinds": ["king", "rook"]
}
```

## 配置制約

### `empty`
空きマスのみ。

### `gravity`
同じ列の最下部に着地する場合のみ合法。

### `row-zone`
プレイヤーごとに置ける行を制限します。

### `column-zone`
置ける列を制限します。

### `cell-whitelist`
許可セルだけに限定します。

## `initialState`

```json
{
  "pieces": [
    { "kind": "king", "owner": "P1", "x": 2, "y": 0 }
  ]
}
```

## 終局条件

### 勝利条件

#### `line`
```json
{
  "type": "line",
  "pieceKind": "mark",
  "length": 3,
  "directions": "orthogonal+diagonal"
}
```

#### `capture-all`
```json
{
  "type": "capture-all",
  "pieceKind": "king"
}
```

#### `reach-row`
```json
{
  "type": "reach-row",
  "pieceKind": "soldier",
  "targetRowByPlayer": { "P1": 4, "P2": 0 }
}
```

#### `opponent-has-no-legal-moves`
相手番で合法手がなければ勝ちです。

### 引き分け条件

- `board-full`
- `move-limit`
- `no-legal-moves`

## `evaluation`

```json
{
  "weights": {
    "material": 1,
    "mobility": 0.1,
    "centerControl": 0.05,
    "advancement": 0.2,
    "linePotential": 1.5
  }
}
```

ゲームごとに重みを変えて、探索の癖を調整できます。

## 追加しやすい拡張

- 持ち駒
- 昇格
- 確率イベント
- 反復局面ルール
- 特殊終了条件

現状はそこまで広げず、まずは「差し替えてすぐ動く」ことを優先しています。
