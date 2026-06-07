import { useQuery } from "@tanstack/react-query";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export interface WCTeamRef {
  slug: string;
  name: string;
  pictureUrl: string | null;
}

export interface SorareData {
  slug: string;
  displayName: string;
  position: string;
  avgScore: number | null;
  recentScores: number[];
  currentClub: string | null;
}

export interface SquadPlayer {
  sorareSlug: string;
  name: string;
  position: string;
  addedManually: boolean;
  sorare: SorareData | null;
}

export interface SquadResponse {
  teamSlug: string;
  teamName: string;
  players: SquadPlayer[];
}

export function useWCTeams() {
  return useQuery<{ teams: WCTeamRef[] }>({
    queryKey: ["wc", "teams"],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/world-cup/teams`);
      if (!res.ok) throw new Error(`Failed to fetch WC teams: ${res.status}`);
      return res.json();
    },
    staleTime: Infinity,
  });
}

export function useWCSquad(teamSlug: string | null) {
  return useQuery<SquadResponse>({
    queryKey: ["wc", "squad", teamSlug],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/world-cup/squad/${teamSlug}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: teamSlug !== null,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export interface WCMatchTeam {
  name: string;
  crest: string | null;
  sorareSlug?: string;
}

export interface WCMatch {
  id: number;
  utcDate: string;
  status: string;
  group: string | null;
  homeTeam: WCMatchTeam | null;
  awayTeam: WCMatchTeam | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface WCRound {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  matches: WCMatch[];
}

export interface StandingRow {
  position: number;
  sorareSlug: string | null;
  name: string;
  crest: string | null;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface StandingGroup {
  group: string;
  label: string;
  table: StandingRow[];
}

export function useWCStandings() {
  return useQuery<{ groups: StandingGroup[] }>({
    queryKey: ["wc", "standings"],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/world-cup/standings`);
      if (!res.ok) throw new Error(`Failed to fetch WC standings: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useWCFixtures() {
  return useQuery<WCRound[]>({
    queryKey: ["wc", "fixtures"],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/world-cup/fixtures`);
      if (!res.ok) throw new Error(`Failed to fetch WC fixtures: ${res.status}`);
      const data = await res.json();
      return data.rounds as WCRound[];
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
