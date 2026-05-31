import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export interface WCTeamRef {
  slug: string;
  name: string;
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

export interface SorareCandidate {
  slug: string;
  displayName: string;
  score: number;
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

export function useAddPlayer(teamSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sorareSlug }: { sorareSlug: string }) => {
      const res = await fetch(`${BASE()}/api/world-cup/squad/${teamSlug}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sorareSlug }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wc", "squad", teamSlug] });
    },
  });
}

export function useRemovePlayer(teamSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sorareSlug }: { sorareSlug: string }) => {
      const res = await fetch(`${BASE()}/api/world-cup/squad/${teamSlug}/players/${sorareSlug}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wc", "squad", teamSlug] });
    },
  });
}

export interface WCMatchTeam {
  id: number;
  name: string;
  crest: string;
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

export function useSorareSearch(query: string | null) {
  return useQuery<{ results: SorareCandidate[] }>({
    queryKey: ["sorare-search", query],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/sorare/search?q=${encodeURIComponent(query!)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: query !== null && query.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
