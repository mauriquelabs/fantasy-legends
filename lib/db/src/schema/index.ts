import { boolean, integer, pgTable, primaryKey, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  fdPlayerId: integer("fd_player_id").unique(),
  sorareSlug: text("sorare_slug").unique(),
  name: text("name").notNull(),
  dateOfBirth: text("date_of_birth"),
  nationality: text("nationality"),
  position: text("position"),
  matchConfidence: text("match_confidence").$type<"exact" | "fuzzy" | "manual" | "unmatched">(),
  hidden: boolean("hidden").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  fdTeamId: integer("fd_team_id").unique().notNull(),
  fdTeamName: text("fd_team_name").notNull(),
  sorareSlug: text("sorare_slug"),
  matchConfidence: text("match_confidence").$type<"exact" | "fuzzy" | "manual" | "unmatched">(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const competitions = pgTable("competitions", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  sport: text("sport").notNull().default("football"),
});

export const competitionTeams = pgTable("competition_teams", {
  competitionCode: text("competition_code").notNull().references(() => competitions.code),
  season: text("season").notNull(),
  teamId: integer("team_id").notNull().references(() => teams.id),
}, (t) => [
  primaryKey({ columns: [t.competitionCode, t.season, t.teamId] }),
]);

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  sport: text("sport").notNull(),
  rawName: text("raw_name").notNull(),
  canonicalName: text("canonical_name").notNull(),
  sortOrder: integer("sort_order").notNull().default(99),
}, (t) => [
  unique().on(t.sport, t.rawName),
]);

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;
export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = typeof competitions.$inferInsert;
export type CompetitionTeam = typeof competitionTeams.$inferSelect;
export type InsertCompetitionTeam = typeof competitionTeams.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;
