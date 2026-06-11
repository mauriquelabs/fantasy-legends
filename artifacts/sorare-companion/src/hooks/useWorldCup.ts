import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  active: boolean;
  sorare: SorareData | null;
}

export interface SquadResponse {
  teamSlug: string;
  teamName: string;
  players: SquadPlayer[];
}

type PlayerMutationOptions = {
  onSuccess?: (data: void, playerSlug: string) => void;
  onError?: (err: Error) => void;
};

function setPlayerActive(queryClient: ReturnType<typeof useQueryClient>, teamSlug: string, playerSlug: string, active: boolean) {
  queryClient.setQueryData<SquadResponse>(["wc", "squad", teamSlug], prev => {
    if (!prev) return prev;
    return { ...prev, players: prev.players.map(p => p.sorareSlug === playerSlug ? { ...p, active } : p) };
  });
}

export function useRemovePlayer(teamSlug: string, options?: PlayerMutationOptions) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerSlug: string) => {
      const res = await fetch(`${BASE()}/api/world-cup/squad/${teamSlug}/players/${playerSlug}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to deactivate player: ${res.status}`);
    },
    onMutate: (playerSlug) => {
      const previous = queryClient.getQueryData<SquadResponse>(["wc", "squad", teamSlug]);
      setPlayerActive(queryClient, teamSlug, playerSlug, false);
      return { previous };
    },
    onSuccess: (data, playerSlug) => options?.onSuccess?.(data, playerSlug),
    onError: (err: Error, _playerSlug, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["wc", "squad", teamSlug], ctx.previous);
      options?.onError?.(err);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["wc", "squad", teamSlug] }),
  });
}

export function useRestorePlayer(teamSlug: string, options?: PlayerMutationOptions) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerSlug: string) => {
      const res = await fetch(`${BASE()}/api/world-cup/squad/${teamSlug}/players/${playerSlug}/restore`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed to restore player: ${res.status}`);
    },
    onMutate: (playerSlug) => {
      const previous = queryClient.getQueryData<SquadResponse>(["wc", "squad", teamSlug]);
      setPlayerActive(queryClient, teamSlug, playerSlug, true);
      return { previous };
    },
    onSuccess: (data, playerSlug) => options?.onSuccess?.(data, playerSlug),
    onError: (err: Error, _playerSlug, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["wc", "squad", teamSlug], ctx.previous);
      options?.onError?.(err);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["wc", "squad", teamSlug] }),
  });
}

export function useWCTeams() {
  return useQuery<{ teams: WCTeamRef[] }>({
    queryKey: ["wc", "teams"],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/world-cup/teams`);
      if (!res.ok) throw new Error(`Failed to fetch WC teams: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
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
