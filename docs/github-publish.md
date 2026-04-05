# GitHub への公開メモ

`ryouts1/game-genome` に上げる想定の手順です。README、CI、学習済みアセットまで含めて、見た人がそのまま触れる状態を目標にしています。

## 1. zip を展開して main へ push

```bash
unzip ~/Downloads/game-genome-learning-bundle.zip -d ~/work
cd ~/work/game-genome
git init -b main
git add .
git commit -m "Initial commit: add game-genome studio with learning bundle"
git remote add origin https://github.com/ryouts1/game-genome.git
git push -u origin main
```

GitHub で新規 repo を作るときは、README / LICENSE / `.gitignore` を先に追加しないほうが衝突しません。

## 2. 公開直後に見られやすい場所

- README 冒頭
- `games/manifest.json`
- `artifacts/learning/manifest.json`
- `games/*.json`
- `src/core/`
- `src/learning/`
- `src/ui/`
- `docs/design-decisions.md`
- `docs/training-report.md`
- `.github/workflows/ci.yml`

## 3. About / Topics の設定例

- About: JSON-defined board game framework with shared UI, rule engine, learned book bundle, and authoring studio.
- Topics: `board-games`, `game-framework`, `json`, `minimax`, `mcts`, `self-play`, `game-ai`, `vanilla-js`

## 4. GitHub Pages を開く場合

`index.html` が root にあるので、Pages を有効にすればデモ導線を作れます。スクリーンショットより、実際に触れる repo として見せやすいです。

## 5. リリース前チェック

- `npm run check`
- README の先頭 2 段落が repo の価値を言えているか
- `docs/catalog-report.md` と `docs/training-report.md` が最新か
- 学習済みアセットの manifest と実ファイルが一致しているか
