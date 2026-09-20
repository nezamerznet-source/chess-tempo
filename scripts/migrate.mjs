import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { tursoAuthToken, tursoDatabaseUrl } from './turso-env.mjs';

const url = tursoDatabaseUrl();
if (!url) throw new Error('Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to the project environment.');
if (process.env.VERCEL && url.startsWith('file:')) throw new Error('Use a remote Turso database on Vercel.');
const client = createClient({ url, authToken: tursoAuthToken() });

try {
  await client.execute('CREATE TABLE IF NOT EXISTS tempo_migrations (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  for (const name of (await readdir(new URL('../drizzle/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) {
    const source = await readFile(new URL('../drizzle/' + name, import.meta.url), 'utf8');
    const checksum = createHash('sha256').update(source).digest('hex');
    const transaction = await client.transaction('write');
    try {
      const existing = await transaction.execute({ sql: 'SELECT checksum FROM tempo_migrations WHERE name = ?', args: [name] });
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
      } else {
        const statements = source.split('--> statement-breakpoint').map(sql => sql.trim()).filter(Boolean);
        await transaction.batch([
          ...statements,
          { sql: 'INSERT INTO tempo_migrations VALUES (?, ?, ?)', args: [name, checksum, Date.now()] },
        ]);
        console.log(`Applied ${name}`);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  }
  console.log('Database is ready.');
} finally {
  client.close();
}
