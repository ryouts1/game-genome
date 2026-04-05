# Release checklist

## コード
- `npm run validate:games`
- `npm run validate:learning`
- `npm test`
- `npm run catalog:report`
- `npm run training:report`
- `games/manifest.json` と `artifacts/learning/manifest.json` が最新になっている

## UI
- 既存ゲームの切り替えで editor と board が同期する
- 局面分析で Minimax / MCTS / Learned 候補表が更新される
- `Genome AI` が既知局面で book を採用できる
- Arena 実行後に CSV が保存できる

## README / docs
- README の主機能一覧が現状と一致する
- `docs/catalog-report.md` を再生成したか
- `docs/training-report.md` を再生成したか
- GitHub 公開手順が現在の zip 名や commit 文言とズレていないか

## GitHub
- Actions が緑になる
- About と Topics を設定する
- 必要なら Pages を有効にする
