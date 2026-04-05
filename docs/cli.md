# CLI

## validate:games

```bash
npm run validate:games
```

`games/*.json` を走査し、定義エラーと警告を表示します。

## validate:learning

```bash
npm run validate:learning
```

`artifacts/learning/manifest.json` と各学習済みブックを検証します。artifact の欠落や重複 key を見たいときに使います。

## scaffold:game

```bash
npm run scaffold:game -- --id my-game --name "My Game" --template duel --register
```

テンプレートは `placement`, `movement`, `duel` の 3 種類です。生成後は Studio で肉付けする流れを想定しています。

## train:self-play

```bash
npm run train:self-play -- --game lane-breakthrough
```

1 ゲームだけ自己対戦ブックを再生成します。`--episodes` などで上書きもできます。

## train:bundle

```bash
npm run train:bundle
```

`scripts/learning-bundle.config.js` にある全ゲーム分の学習済みブックを再生成します。

## catalog:report

```bash
npm run catalog:report
```

`games/manifest.json` と各 JSON 定義から `docs/catalog-report.md` を再生成します。

## training:report

```bash
npm run training:report
```

学習済みブックから `docs/training-report.md` を再生成します。
