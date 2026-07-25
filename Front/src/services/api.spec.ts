import { resolveApiBaseUrl } from './api';

const makeEnv = (overrides: Record<string, string> = {}): ImportMetaEnv => ({
  BASE_URL: '/',
  MODE: 'test',
  DEV: false,
  PROD: false,
  SSR: false,
  ...overrides,
} as ImportMetaEnv);

describe('resolveApiBaseUrl', () => {
  it('uses the configured VITE_API_URL when present', () => {
    expect(resolveApiBaseUrl(makeEnv({ VITE_API_URL: 'https://api.example.com/api/v1' }), { origin: 'https://app.example.com' } as Location)).toBe('https://api.example.com/api/v1');
  });

  it('uses a same-origin relative URL in production when no env var is configured', () => {
    expect(resolveApiBaseUrl(makeEnv(), { origin: 'https://app.example.com' } as Location)).toBe('/api/v1');
  });

  it('keeps the local development fallback to localhost', () => {
    expect(resolveApiBaseUrl(makeEnv(), { origin: 'http://localhost:5173' } as Location)).toBe('http://localhost:3000/api/v1');
  });
});
