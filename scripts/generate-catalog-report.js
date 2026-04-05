import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const manifestPath = path.resolve(projectRoot, 'games/manifest.json');
const reportPath = path.resolve(projectRoot, 'docs/catalog-report.md');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

function readGame(entry) {
  const targetPath = path.resolve(projectRoot, entry.path.replace('./', ''));
  return JSON.parse(readFileSync(targetPath, 'utf-8'));
}

function listActionSummary(rawGame) {
  return (rawGame.actionCatalog ?? []).map((action) => {
    if (action.type === 'place') {
      return `place:${action.pieceKind}`;
    }
    return `move:${(action.pieceKinds ?? []).join('/') || 'all'}`;
  }).join(', ');
}

const sections = manifest.map((entry) => {
  const rawGame = readGame(entry);
  const pieceKinds = Object.keys(rawGame.pieceKinds ?? {});
  const winConditions = (rawGame.termination?.winConditions ?? []).map((condition) => condition.type).join(', ');
  const categories = (entry.categories ?? []).join(', ') || '-';

  return [
    `## ${entry.name}`,
    '',
    `- id: \`${entry.id}\``,
    `- board: ${rawGame.board.width} x ${rawGame.board.height}`,
    `- categories: ${categories}`,
    `- actions: ${listActionSummary(rawGame)}`,
    `- piece kinds: ${pieceKinds.join(', ')}`,
    `- win conditions: ${winConditions}`,
    `- summary: ${entry.summary}`,
    '',
  ].join('\n');
});

const output = [
  '# Catalog report',
  '',
  '同梱ゲームの一覧を `games/manifest.json` と各 JSON 定義から生成したメモです。README より細かく、`games/` 配下の見どころをざっと確認したいときに使います。',
  '',
  ...sections,
].join('\n');

writeFileSync(reportPath, `${output}\n`);
console.log(`Wrote ${path.relative(projectRoot, reportPath)}`);
