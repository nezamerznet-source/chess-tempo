import { z } from "zod";
import { ApiError, body, db, failure, json, requireAccount } from "@/lib/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const schema = z.object({ id: z.string().uuid(), whiteId: z.string().uuid("Выберите игрока за белых."), blackId: z.string().uuid("Выберите игрока за чёрных."), outcome: z.enum(["white", "black", "draw"]), base: z.number().int().min(1).max(10800), increment: z.number().int().min(0).max(180), moves: z.number().int().min(0).max(100000), reason: z.enum(["manual", "timeout"]), whiteRemaining: z.number().int().min(0).max(2000000000), blackRemaining: z.number().int().min(0).max(2000000000) });
export async function POST(request: Request) {
  try {
    const user = await requireAccount(request); const input = await body(request, schema);
    if (input.whiteId === input.blackId) throw new ApiError(400, "Для партии нужны два разных игрока.");
    const owned = await db().prepare("SELECT id FROM players WHERE owner_id=? AND id IN (?,?)").bind(user.id, input.whiteId, input.blackId).all();
    if (owned.results.length !== 2) throw new ApiError(403, "Выберите игроков из вашего аккаунта.");
    // Client-generated id makes retries safe and prevents duplicate score entries.
    const inserted = await db().prepare("INSERT INTO games(id,owner_id,white_id,black_id,outcome,base,increment,moves,reason,white_remaining,black_remaining,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(input.id, user.id, input.whiteId, input.blackId, input.outcome, input.base, input.increment, input.moves, input.reason, input.whiteRemaining, input.blackRemaining, Date.now()).run();
    if (!inserted.meta.changes) {
      const previous = await db().prepare("SELECT owner_id,white_id,black_id,outcome FROM games WHERE id=?").bind(input.id).first<{ owner_id: string; white_id: string; black_id: string; outcome: string }>();
      if (!previous || previous.owner_id !== user.id || previous.white_id !== input.whiteId || previous.black_id !== input.blackId || previous.outcome !== input.outcome) throw new ApiError(409, "Результат этой партии уже сохранён.");
    }
    return json({ id: input.id, saved: true }, inserted.meta.changes ? 201 : 200);
  } catch (error) { return failure(error); }
}
