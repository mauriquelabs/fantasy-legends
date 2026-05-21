import { integer, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  fdPlayerId: integer("fd_player_id").unique(),
  sorareSlug: text("sorare_slug").unique(),
  name: text("name").notNull(),
  dateOfBirth: text("date_of_birth"),
  nationality: text("nationality"),
  position: text("position"),
  matchConfidence: text("match_confidence").$type<"exact" | "fuzzy" | "manual" | "unmatched">(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const competitionTeams = pgTable("competition_teams", {
  competitionCode: text("competition_code").notNull(),
  season: text("season").notNull(),
  fdTeamId: integer("fd_team_id").notNull(),
  fdTeamName: text("fd_team_name").notNull(),
  sorareTeamSlug: text("sorare_team_slug"),
}, (t) => [
  primaryKey({ columns: [t.competitionCode, t.season, t.fdTeamId] }),
]);

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;
export type CompetitionTeam = typeof competitionTeams.$inferSelect;
export type InsertCompetitionTeam = typeof competitionTeams.$inferInsert;
