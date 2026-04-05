import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectDefinitionDiagnostics } from '../src/core/definition-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function resolveTargets(argv) {
  if (argv.length > 0) {
    return argv.map((arg) => path.resolve(process.cwd(), arg));
  }

  const gamesDir = path.resolve(projectRoot, 'games');
  return readdirSync(gamesDir)
    .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
    .map((name) => path.join(gamesDir, name));
}

function validateFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const rawGame = JSON.parse(content);
  const diagnostics = collectDefinitionDiagnostics(rawGame);

  console.log(`\n${path.relative(projectRoot, filePath)}`);
  if (diagnostics.errors.length === 0) {
    console.log(`  ✓ valid (${diagnostics.warnings.length} warning${diagnostics.warnings.length === 1 ? '' : 's'})`);
  } else {
    console.log(`  ✗ ${diagnostics.errors.length} error${diagnostics.errors.length === 1 ? '' : 's'} / ${diagnostics.warnings.length} warning${diagnostics.warnings.length === 1 ? '' : 's'}`);
  }

  diagnostics.errors.forEach((diagnostic) => {
    console.log(`    [error] ${diagnostic.path || '(root)'}: ${diagnostic.message}`);
  });

  diagnostics.warnings.forEach((diagnostic) => {
    console.log(`    [warning] ${diagnostic.path || '(root)'}: ${diagnostic.message}`);
  });

  return diagnostics.errors.length === 0;
}

const targets = resolveTargets(process.argv.slice(2));
let allValid = true;

for (const target of targets) {
  try {
    const valid = validateFile(target);
    allValid &&= valid;
  } catch (error) {
    allValid = false;
    console.error(`\n${target}`);
    console.error(`  ✗ failed to validate: ${error.message}`);
  }
}

if (!allValid) {
  process.exitCode = 1;
}
