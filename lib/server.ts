import { database } from "./database";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
export const db = database;
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function json(value: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", ...headers } });
}
export function failure(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError) return json({ error: error.issues[0]?.message || "Проверьте введённые данные." }, 400);
  console.error("Tempo request failed", error instanceof Error ? error.name + ": " + error.message : "Unknown error");
  return json({ error: "Сервис временно недоступен. Попробуйте ещё раз." }, 503);
}
export async function body<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  if (request.headers.get("X-Tempo-Request") !== "1") throw new ApiError(403, "Недопустимый запрос.");
  const origin = request.headers.get("origin");
  // Next.js may expose its internal hostname in request.url. The Host header
  // contains the actual browser-facing host; Vercel terminates HTTPS for us.
  const target = new URL(request.url);
  const expectedOrigin = `${process.env.VERCEL ? "https:" : target.protocol}//${request.headers.get("host") || target.host}`;
  if (origin && origin !== expectedOrigin) throw new ApiError(403, "Недопустимый источник запроса.");
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Ожидаются данные JSON.");
  if (Number(request.headers.get("content-length") || 0) > 8192) throw new ApiError(413, "Слишком большой запрос.");
  const source = await request.text(); if (source.length > 8192) throw new ApiError(413, "Слишком большой запрос.");
  let parsed; try { parsed = JSON.parse(source); } catch { throw new ApiError(400, "Некорректные данные."); }
  return schema.parse(parsed);
}
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  // OWASP scrypt profile: N=2^14, r=8, p=5; 16 MiB of memory.
  const derived = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 }).toString("hex");
  return `scrypt-v1$${salt}$${derived}`;
}
export function passwordMatches(password: string, encoded: string) {
  const [version, salt, value] = encoded.split("$");
  if (version !== "scrypt-v1" || !salt || !value) return false;
  const actual = passwordHash(password, salt).split("$")[2];
  const left = Buffer.from(actual, "hex"), right = Buffer.from(value, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
export function cookieToken(request: Request) { return request.headers.get("cookie")?.match(/(?:^|;\s*)tempo_session=([a-f0-9]{64})(?:;|$)/)?.[1] || null; }
export type Account = { id: string; email: string; name: string };
export async function account(request: Request): Promise<Account | null> {
  const token = cookieToken(request); if (!token) return null;
  return db().prepare("SELECT a.id, a.email, a.name FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?").bind(hash(token), Date.now()).first<Account>();
}
export async function requireAccount(request: Request) { const user = await account(request); if (!user) throw new ApiError(401, "Войдите в аккаунт, чтобы сохранить данные."); return user; }
export function sessionCookie(request: Request, token: string, expires = false) {
  const hostname = new URL(request.url).hostname;
  const local = !process.env.VERCEL && ["terminal.local", "localhost", "127.0.0.1"].includes(hostname);
  return `tempo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expires ? 0 : 60 * 60 * 24 * 30}${local ? "" : "; Secure"}`;
}
export async function createSession(request: Request, owner: string) {
  const token = randomBytes(32).toString("hex"), now = Date.now();
  const previous = cookieToken(request);
  await db().batch([
    db().prepare("DELETE FROM sessions WHERE expires_at < ? OR token_hash = ?").bind(now, previous ? hash(previous) : ""),
    db().prepare("INSERT INTO sessions(token_hash, account_id, expires_at) VALUES (?, ?, ?)").bind(hash(token), owner, now + 30 * 24 * 60 * 60 * 1000),
  ]);
  return sessionCookie(request, token);
}
export async function rateLimit(subject: string, max: number, duration = 15 * 60 * 1000) {
  const now = Date.now(); const bucket = Math.floor(now / duration); const key = hash(subject + ":" + bucket);
  const result = await db().prepare("INSERT INTO rate_limits(key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits").bind(key, (bucket + 1) * duration).first<{ hits: number }>();
  if (!result || result.hits > max) throw new ApiError(429, "Слишком много попыток. Повторите через 15 минут.");
}
