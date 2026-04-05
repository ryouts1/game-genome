import test from 'node:test';
import assert from 'node:assert/strict';

import { collectDefinitionDiagnostics } from '../src/core/definition-loader.js';
import { getStudioTemplate } from '../src/studio/templates.js';
import { evaluateDefinitionHealth } from '../src/studio/quality.js';

test('definition health returns stable metrics for starter templates', () => {
  const template = getStudioTemplate('duel');
  assert.ok(template);

  const diagnostics = collectDefinitionDiagnostics(template.rawGame);
  const health = evaluateDefinitionHealth(template.rawGame, diagnostics);

  assert.equal(diagnostics.errors.length, 0);
  assert.ok(health.overall >= 70);
  assert.equal(health.metrics[0].label, 'Overall');
});
