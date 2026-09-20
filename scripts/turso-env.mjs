/** Resolve Turso credentials from plain names or Vercel Marketplace prefixes (`*_TURSO_*`). */
export function tursoDatabaseUrl() {
  return firstEnv("TURSO_DATABASE_URL", "_TURSO_DATABASE_URL");
}

export function tursoAuthToken() {
  return firstEnv("TURSO_AUTH_TOKEN", "_TURSO_AUTH_TOKEN");
}

function firstEnv(exact, suffix) {
  const direct = process.env[exact]?.trim();
  if (direct) return direct;
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.endsWith(suffix) || key === exact) continue;
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}
