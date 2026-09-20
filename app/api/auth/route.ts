import { z } from "zod";
import { account, ApiError, body, cookieToken, createSession, db, failure, hash, json, passwordHash, passwordMatches, rateLimit, sessionCookie } from "@/lib/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const credentials = z.object({ action: z.enum(["register", "login"]), email: z.string().trim().email("Укажите корректный email.").max(254).transform(v => v.toLowerCase()), password: z.string().min(1, "Введите пароль.").max(128, "Пароль слишком длинный."), name: z.string().trim().max(40).nullable().optional() });
const authBody = z.union([credentials, z.object({ action: z.literal("logout") })]);
export async function GET(request: Request) { try { return json({ account: await account(request) }); } catch (error) { return failure(error); } }
export async function POST(request: Request) {
  try {
    const input = await body(request, authBody);
    if (input.action === "logout") { const token = cookieToken(request); if (token) await db().prepare("DELETE FROM sessions WHERE token_hash=?").bind(hash(token)).run(); return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(request, "", true) }); }
    const ip = process.env.VERCEL
      ? (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim()
      : "local";
    await rateLimit(`auth-ip:${ip}`, 35);
    await rateLimit(`auth-email:${input.email}`, 12);
    await db().prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(Date.now()).run();
    const existing = await db().prepare("SELECT id, email, name, password_hash FROM accounts WHERE email=?").bind(input.email).first<{ id: string; email: string; name: string; password_hash: string }>();
    let user;
    if (input.action === "register") {
      if (input.password.length < 10) throw new ApiError(400, "Используйте пароль не короче 10 символов.");
      if (!input.name?.trim()) throw new ApiError(400, "Введите ваше имя.");
      if (existing) throw new ApiError(409, "Аккаунт с этим email уже есть. Перейдите на вкладку «Вход».");
      user = { id: crypto.randomUUID(), email: input.email, name: input.name.trim() };
      const encoded = passwordHash(input.password);
      const inserted = await db().prepare("INSERT INTO accounts(id,email,name,password_hash,created_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO NOTHING").bind(user.id, user.email, user.name, encoded, Date.now()).run();
      if (!inserted.meta.changes) throw new ApiError(409, "Аккаунт с этим email уже есть.");
    } else {
      // Always perform the KDF even for unknown addresses.
      const dummy = "scrypt-v1$6c50737ac2516db5ee7ec0ef096c48a1$0000000000000000000000000000000000000000000000000000000000000000";
      const valid = passwordMatches(input.password, existing?.password_hash || dummy);
      if (!existing || !valid) throw new ApiError(401, "Неверный email или пароль.");
      user = { id: existing.id, email: existing.email, name: existing.name };
    }
    const cookie = await createSession(request, user.id);
    return json({ account: user }, input.action === "register" ? 201 : 200, { "Set-Cookie": cookie });
  } catch (error) { return failure(error); }
}
