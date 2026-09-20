/** Resolve Turso credentials from plain names or Vercel Marketplace prefixes (`*_TURSO_*`). */
export function tursoDatabaseUrl(): string | undefined {
  return firstEnv("TURSO_DATABASE_URL", "_TURSO_DATABASE_URL");
}

export function tursoAuthToken(): string | undefined {
  return firstEnv("TURSO_AUTH_TOKEN", "_TURSO_AUTH_TOKEN");
}

function firstEnv(exact: string, suffix: string): string | undefined {
  const direct = process.env[exact]?.trim();
  if (direct) return direct;
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.endsWith(suffix) || key === exact) continue;
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}
