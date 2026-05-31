import { boolean, integer, json, pgTable, primaryKey, real, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

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
  avgScore: real("avg_score"),
  avg5Score: real("avg_5_score"),
  avg40Score: real("avg_40_score"),
  recentScores: json("recent_scores").$type<number[]>(),
  gamesPlayedLast15: integer("games_played_last15"),
  currentClub: text("current_club"),
  scoresUpdatedAt: timestamp("scores_updated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  fdTeamId: integer("fd_team_id").unique(),
  fdTeamName: text("fd_team_name"),
  sorareSlug: text("sorare_slug").unique(),
  matchConfidence: text("match_confidence").$type<"exact" | "fuzzy" | "manual" | "unmatched">(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teamPlayers = pgTable("team_players", {
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  sorareSlug: text("sorare_slug").notNull(),
  addedManually: boolean("added_manually").notNull().default(false),
  excludedFromSync: boolean("excluded_from_sync").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.teamId, t.sorareSlug] }),
]);

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
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type InsertTeamPlayer = typeof teamPlayers.$inferInsert;
export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = typeof competitions.$inferInsert;
export type CompetitionTeam = typeof competitionTeams.$inferSelect;
export type InsertCompetitionTeam = typeof competitionTeams.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;
