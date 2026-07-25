export function resolveApiBaseUrl(
  env: ImportMetaEnv,
  location: Pick<Location, 'origin'>,
): string {
  const configuredUrl = env.VITE_API_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  const isLocalDevelopment = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
    location.origin,
  );

  return isLocalDevelopment
    ? 'http://localhost:3000/api/v1'
    : '/api/v1';
}
