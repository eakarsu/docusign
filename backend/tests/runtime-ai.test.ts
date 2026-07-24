import fs from 'node:fs';
import path from 'node:path';

describe('runtime OpenRouter boundary', () => {
  const service = fs.readFileSync(path.join(__dirname, '../src/services/aiService.ts'), 'utf8');

  test('requires the canonical OpenRouter API base and provider receipt', () => {
    expect(service).toContain("baseURL !== 'https://openrouter.ai/api/v1'");
    expect(service).toContain("if (!result || !providerReceipt)");
    expect(service).toContain("AI_PROVIDER_INCOMPLETE_RESPONSE");
  });

  test('persists the substantive response and provider receipt', () => {
    expect(service).toContain("kind: 'runtime-operational-risk-review'");
    expect(service).toContain('const output: Prisma.InputJsonValue');
    expect(service).toContain('providerReceipt,');
    expect(service).toContain('aIArtifact.create');
  });
});
