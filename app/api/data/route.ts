import { account, db, failure, json } from "@/lib/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await account(request);
    if (!user) return json({ account: null, players: [], games: [] });
    const results = await db().batch([
      db().prepare(`SELECT p.id,p.name,
        COUNT(g.id) AS games,
        SUM(CASE WHEN (g.outcome='white' AND g.white_id=p.id) OR (g.outcome='black' AND g.black_id=p.id) THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN (g.outcome='black' AND g.white_id=p.id) OR (g.outcome='white' AND g.black_id=p.id) THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN g.outcome='draw' THEN 1 ELSE 0 END) AS draws
        FROM players p LEFT JOIN games g ON g.owner_id=p.owner_id AND (g.white_id=p.id OR g.black_id=p.id)
        WHERE p.owner_id=? GROUP BY p.id ORDER BY p.created_at`).bind(user.id),
      db().prepare(`SELECT g.id,g.white_id,g.black_id,w.name AS white_name,b.name AS black_name,g.outcome,g.base,g.increment,g.moves,g.reason,g.created_at
        FROM games g JOIN players w ON w.id=g.white_id JOIN players b ON b.id=g.black_id
        WHERE g.owner_id=? ORDER BY g.created_at DESC`).bind(user.id),
    ]);
    return json({ account: user, players: results[0].results, games: results[1].results });
  } catch (error) { return failure(error); }
}
