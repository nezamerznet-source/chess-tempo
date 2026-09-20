import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";
import { tursoAuthToken, tursoDatabaseUrl } from "./turso-env";

let client: Client | undefined;

function connection() {
  if (client) return client;
  const url = tursoDatabaseUrl();
  if (!url) throw new Error("Set TURSO_DATABASE_URL before using accounts and game history.");
  if (process.env.VERCEL && url.startsWith("file:")) {
    throw new Error("Vercel requires a remote Turso database; local files are not persistent.");
  }
  client = createClient({ url, authToken: tursoAuthToken() });
  return client;
}

function result(value: ResultSet) {
  return { results: value.rows, meta: { changes: value.rowsAffected } };
}

class Statement {
  constructor(readonly sql: string, readonly args: InValue[] = []) {}

  bind(...args: InValue[]) { return new Statement(this.sql, args); }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const value = await connection().execute({ sql: this.sql, args: this.args });
    return (value.rows[0] as T | undefined) ?? null;
  }

  async all() {
    return result(await connection().execute({ sql: this.sql, args: this.args }));
  }

  async run() { return this.all(); }
}

const databaseClient = {
  prepare(sql: string) { return new Statement(sql); },
  async batch(statements: Statement[]) {
    // libSQL commits the whole batch or rolls it back on any error.
    const values = await connection().batch(statements.map(({ sql, args }) => ({ sql, args })), "write");
    return values.map(result);
  },
};

export function database() { return databaseClient; }
