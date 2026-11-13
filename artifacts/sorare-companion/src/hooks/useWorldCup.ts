/**
 * Backward-compatible WC helpers. New code should use useCompetition(code).
 */
import {
  DEFAULT_COMPETITION_CODE,
  useCompetitionFixtures,
  useCompetitionSquad,
  useCompetitionStandings,
  useCompetitionTeams,
  useRemovePlayer as useRemovePlayerForCompetition,
  useRestorePlayer as useRestorePlayerForCompetition,
  type CompetitionMatch,
  type CompetitionRound,
  type CompetitionTeamRef,
  type SquadPlayer,
  type SquadResponse,
  type SorareData,
  type StandingGroup,
  type StandingRow,
} from "./useCompetition";

export type WCTeamRef = CompetitionTeamRef;
export type WCMatch = CompetitionMatch;
export type WCRound = CompetitionRound;
export type {
  SquadPlayer,
  SquadResponse,
  SorareData,
  StandingGroup,
  StandingRow,
};

const WC = DEFAULT_COMPETITION_CODE;

export function useRemovePlayer(
  teamSlug: string,
  options?: Parameters<typeof useRemovePlayerForCompetition>[2],
) {
  return useRemovePlayerForCompetition(WC, teamSlug, options);
}

export function useRestorePlayer(
  teamSlug: string,
  options?: Parameters<typeof useRestorePlayerForCompetition>[2],
) {
  return useRestorePlayerForCompetition(WC, teamSlug, options);
}

export function useWCTeams() {
  return useCompetitionTeams(WC);
}

export function useWCSquad(teamSlug: string | null) {
  return useCompetitionSquad(WC, teamSlug);
}

export function useWCStandings() {
  return useCompetitionStandings(WC);
}

export function useWCFixtures() {
  return useCompetitionFixtures(WC);
}
