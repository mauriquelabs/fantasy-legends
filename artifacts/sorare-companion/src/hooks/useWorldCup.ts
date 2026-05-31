import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export interface WCTeamRef {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
  area: string | null;
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
  id: number;
  name: string;
  position: "Goalkeeper" | "Defence" | "Midfield" | "Offence" | string;
  dateOfBirth: string | null;
  nationality: string | null;
  shirtNumber: number | null;
  sorareSlug: string | null;
  sorare: SorareData | null;
  matchConfidence: "exact" | "fuzzy" | "manual" | "unmatched" | null;
}

export interface SorareCandidate {
  slug: string;
  displayName: string;
  score: number;
}

export interface SquadResponse {
  teamId: number;
  teamName: string;
  teamShortName: string;
  teamCrest: string | null;
  players: SquadPlayer[];
}

export function useWCTeams() {
  return useQuery<{ season: string | null; teams: WCTeamRef[] }>({
    queryKey: ["wc", "teams"],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/world-cup/teams`);
      if (!res.ok) throw new Error(`Failed to fetch WC teams: ${res.status}`);
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

export function useSorareCandidates(fdPlayerId: number | null, sorareTeamSlug?: string) {
  return useQuery<{ fdPlayer: { id: number; name: string }; candidates: SorareCandidate[] }>({
    queryKey: ["sorare-candidates", fdPlayerId, sorareTeamSlug],
    queryFn: async () => {
      const params = sorareTeamSlug ? `?sorareTeamSlug=${encodeURIComponent(sorareTeamSlug)}` : "";
      const res = await fetch(`${BASE()}/api/players/${fdPlayerId}/sorare-candidates${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: fdPlayerId !== null,
    staleTime: 30 * 60 * 1000,
    retry: 1,
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

export function useHidePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fdPlayerId, hidden, name }: { fdPlayerId: number; hidden: boolean; name: string }) => {
      const res = await fetch(`${BASE()}/api/players/${fdPlayerId}/hidden`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden, name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wc", "squad"] });
    },
  });
}

export function useLinkPlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fdPlayerId, sorareSlug, name }: { fdPlayerId: number; sorareSlug: string; name: string }) => {
      const res = await fetch(`${BASE()}/api/players/${fdPlayerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sorareSlug, name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wc", "squad"] });
    },
  });
}

export function useWCSquad(teamId: number | null, sorareSlug?: string) {
  return useQuery<SquadResponse>({
    queryKey: ["wc", "squad", teamId, sorareSlug],
    queryFn: async () => {
      const params = sorareSlug ? `?sorareSlug=${encodeURIComponent(sorareSlug)}` : "";
      const res = await fetch(`${BASE()}/api/world-cup/squad/${teamId}${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: teamId !== null,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
