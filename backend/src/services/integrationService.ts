import crypto from 'node:crypto';

type IntegrationName = 'OCR' | 'REDACTION' | 'FILING' | 'ESIGN' | 'TEMPLATE_REGISTRY';

function endpointFor(name: IntegrationName) {
  const value = process.env[`${name}_ENDPOINT`];
  if (!value) throw new Error(`${name}_ENDPOINT_REQUIRED`);
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error(`${name}_HTTPS_REQUIRED`);
  return value;
}

export class IntegrationService {
  async call<T>(name: IntegrationName, requestId: string, payload: unknown): Promise<{ data: T; provider: string; providerVersion: string; checksum: string }> {
    const endpoint = endpointFor(name);
    const apiKey = process.env[`${name}_API_KEY`];
    if (!apiKey) throw new Error(`${name}_API_KEY_REQUIRED`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': requestId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`${name}_PROVIDER_${response.status}`);
    const raw = await response.text();
    const data = JSON.parse(raw) as T;
    const provider = response.headers.get('x-provider') || new URL(endpoint).hostname;
    const providerVersion = response.headers.get('x-provider-version') || 'unreported';
    return { data, provider, providerVersion, checksum: crypto.createHash('sha256').update(raw).digest('hex') };
  }
}
