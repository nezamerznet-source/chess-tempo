import { z } from "zod";
import { ApiError, body, db, failure, json, requireAccount } from "@/lib/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await requireAccount(request);
    const { name } = await body(request, z.object({ name: z.string().trim().min(1, "Введите имя игрока.").max(32, "Имя должно быть не длиннее 32 символов.") }));
    const count = await db().prepare("SELECT COUNT(*) AS total FROM players WHERE owner_id=?").bind(user.id).first<{ total: number }>();
    if ((count?.total || 0) >= 200) throw new ApiError(400, "Можно добавить до 200 игроков.");
    const id = crypto.randomUUID();
    await db().prepare("INSERT INTO players(id,owner_id,name,created_at) VALUES (?,?,?,?)").bind(id, user.id, name, Date.now()).run();
    return json({ id, name }, 201);
  } catch (error) { return failure(error); }
}
