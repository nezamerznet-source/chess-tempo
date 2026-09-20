import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(), passwordHash: text("password_hash").notNull(), createdAt: integer("created_at").notNull(),
}, table => [uniqueIndex("idx_accounts_email").on(table.email)]);
export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(), accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }), expiresAt: integer("expires_at").notNull(),
}, table => [index("idx_sessions_expires_at").on(table.expiresAt)]);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), hits: integer("hits").notNull(), expiresAt: integer("expires_at").notNull(),
}, table => [index("idx_rate_limits_expires_at").on(table.expiresAt)]);
export const players = sqliteTable("players", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => accounts.id, { onDelete: "cascade" }), name: text("name").notNull(), createdAt: integer("created_at").notNull(),
}, table => [index("idx_players_owner_id").on(table.ownerId)]);
export const games = sqliteTable("games", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  whiteId: text("white_id").notNull().references(() => players.id), blackId: text("black_id").notNull().references(() => players.id),
  outcome: text("outcome", { enum: ["white", "black", "draw"] }).notNull(), base: integer("base").notNull(), increment: integer("increment").notNull(), moves: integer("moves").notNull(),
  reason: text("reason", { enum: ["manual", "timeout"] }).notNull(), whiteRemaining: integer("white_remaining").notNull(), blackRemaining: integer("black_remaining").notNull(), createdAt: integer("created_at").notNull(),
}, table => [index("idx_games_owner_created_at").on(table.ownerId, table.createdAt)]);
