import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.resolve(projectRoot, 'artifacts/learning/manifest.json');
const outputPath = path.resolve(projectRoot, 'docs/training-report.md');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

function readArtifact(entry) {
  const targetPath = path.resolve(projectRoot, entry.path.replace('./', ''));
  return JSON.parse(readFileSync(targetPath, 'utf-8'));
}

const artifacts = manifest.map((entry) => ({ entry, artifact: readArtifact(entry) }));
const totalEpisodes = artifacts.reduce((sum, item) => sum + (item.artifact.meta?.episodes ?? 0), 0);
const totalStates = artifacts.reduce((sum, item) => sum + (item.artifact.meta?.stateCount ?? 0), 0);
const totalDecisionSamples = artifacts.reduce((sum, item) => sum + (item.artifact.meta?.decisionSamples ?? 0), 0);

const sections = artifacts.map(({ entry, artifact }) => {
  const topState = artifact.states[0];
  const trainingPlan = artifact.meta?.trainingPlan ?? null;
  const shardSummary = trainingPlan?.shards
    ? `${trainingPlan.shards.length} shards x ${trainingPlan.shards[0]?.episodes ?? 0} episodes`
    : null;
  const seeds = trainingPlan?.shards ? trainingPlan.shards.map((shard) => shard.seed).join(', ') : null;
  return [
    `## ${entry.gameId}`,
    '',
    `- teacher: ${artifact.meta.teacherController}`,
    shardSummary ? `- training mode: ${trainingPlan.mode} / ${shardSummary}` : null,
    seeds ? `- seeds: ${seeds}` : null,
    `- episodes: ${artifact.meta.episodes}`,
    `- retained states: ${artifact.meta.stateCount}`,
    `- decision samples: ${artifact.meta.decisionSamples}`,
    `- recommendation threshold: visits >= ${artifact.meta.recommendation.minimumVisits}, confidence >= ${artifact.meta.recommendation.minimumConfidence}`,
    `- generated: ${artifact.generatedAt}`,
    topState
      ? `- most-sampled state: ${topState.stateKey.slice(0, 96)}${topState.stateKey.length > 96 ? '…' : ''} / visits ${topState.visits}`
      : '- most-sampled state: none',
    '',
  ].filter(Boolean).join('\n');
});

const output = [
  '# Training report',
  '',
  '同梱した学習済みブックの生成条件を、artifact 本体から機械的に再構成したメモです。ニューラルネットの学習ではなく、自己対戦の結果を state-action 統計として保持する方式を採っています。',
  '',
  `- bundle games: ${manifest.length}`,
  `- total episodes: ${totalEpisodes}`,
  `- total retained states: ${totalStates}`,
  `- total decision samples: ${totalDecisionSamples}`,
  '',
  ...sections,
].join('\n');

writeFileSync(outputPath, `${output}\n`);
console.log(`Wrote ${path.relative(projectRoot, outputPath)}`);
