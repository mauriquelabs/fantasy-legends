import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export const DEFAULT_COMPETITION_CODE = "WC";

export interface CompetitionSummary {
  id: number;
  code: string;
  name: string;
  displayName: string;
  sport: string;
  season: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  fdCode: string | null;
  sorareSlug: string | null;
}

export interface CompetitionTeamRef {
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

export interface MatchTeam {
  name: string;
  crest: string | null;
  sorareSlug?: string;
}

export interface CompetitionMatch {
  id: number;
  utcDate: string;
  status: string;
  group: string | null;
  homeTeam: MatchTeam | null;
  awayTeam: MatchTeam | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface CompetitionRound {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  matches: CompetitionMatch[];
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

type PlayerMutationOptions = {
  onSuccess?: (data: void, playerSlug: string, playerName: string) => void;
  onError?: (err: Error) => void;
};

function apiBase(code: string) {
  return `${BASE()}/api/competitions/${encodeURIComponent(code)}`;
}

function setPlayerActive(
  queryClient: ReturnType<typeof useQueryClient>,
  code: string,
  teamSlug: string,
  playerSlug: string,
  active: boolean,
) {
  queryClient.setQueryData<SquadResponse>(
    ["competition", code, "squad", teamSlug],
    (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map((p) =>
          p.sorareSlug === playerSlug ? { ...p, active } : p,
        ),
      };
    },
  );
}

export function useCompetitions() {
  return useQuery<{ competitions: CompetitionSummary[] }>({
    queryKey: ["competitions"],
    queryFn: async () => {
      const res = await fetch(`${BASE()}/api/competitions`);
      if (!res.ok) throw new Error(`Failed to fetch competitions: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompetition(code: string) {
  return useQuery<CompetitionSummary>({
    queryKey: ["competition", code],
    queryFn: async () => {
      const res = await fetch(apiBase(code));
      if (!res.ok) throw new Error(`Failed to fetch competition: ${res.status}`);
      return res.json();
    },
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRemovePlayer(
  code: string,
  teamSlug: string,
  options?: PlayerMutationOptions,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerSlug: string) => {
      const res = await fetch(
        `${apiBase(code)}/squad/${teamSlug}/players/${playerSlug}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Failed to deactivate player: ${res.status}`);
    },
    onMutate: (playerSlug) => {
      const previous = queryClient.getQueryData<SquadResponse>([
        "competition",
        code,
        "squad",
        teamSlug,
      ]);
      setPlayerActive(queryClient, code, teamSlug, playerSlug, false);
      return { previous };
    },
    onSuccess: (data, playerSlug) => {
      const cached = queryClient.getQueryData<SquadResponse>([
        "competition",
        code,
        "squad",
        teamSlug,
      ]);
      const playerName =
        cached?.players.find((p) => p.sorareSlug === playerSlug)?.name ??
        "Player";
      options?.onSuccess?.(data, playerSlug, playerName);
    },
    onError: (err: Error, _playerSlug, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["competition", code, "squad", teamSlug],
          ctx.previous,
        );
      }
      options?.onError?.(err);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["competition", code, "squad", teamSlug],
      }),
  });
}

export function useRestorePlayer(
  code: string,
  teamSlug: string,
  options?: PlayerMutationOptions,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerSlug: string) => {
      const res = await fetch(
        `${apiBase(code)}/squad/${teamSlug}/players/${playerSlug}/restore`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`Failed to restore player: ${res.status}`);
    },
    onMutate: (playerSlug) => {
      const previous = queryClient.getQueryData<SquadResponse>([
        "competition",
        code,
        "squad",
        teamSlug,
      ]);
      setPlayerActive(queryClient, code, teamSlug, playerSlug, true);
      return { previous };
    },
    onSuccess: (data, playerSlug) => {
      const cached = queryClient.getQueryData<SquadResponse>([
        "competition",
        code,
        "squad",
        teamSlug,
      ]);
      const playerName =
        cached?.players.find((p) => p.sorareSlug === playerSlug)?.name ??
        "Player";
      options?.onSuccess?.(data, playerSlug, playerName);
    },
    onError: (err: Error, _playerSlug, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["competition", code, "squad", teamSlug],
          ctx.previous,
        );
      }
      options?.onError?.(err);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["competition", code, "squad", teamSlug],
      }),
  });
}

export function useCompetitionTeams(code: string) {
  return useQuery<{ teams: CompetitionTeamRef[] }>({
    queryKey: ["competition", code, "teams"],
    queryFn: async () => {
      const res = await fetch(`${apiBase(code)}/teams`);
      if (!res.ok) throw new Error(`Failed to fetch teams: ${res.status}`);
      return res.json();
    },
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompetitionSquad(code: string, teamSlug: string | null) {
  return useQuery<SquadResponse>({
    queryKey: ["competition", code, "squad", teamSlug],
    queryFn: async () => {
      const res = await fetch(`${apiBase(code)}/squad/${teamSlug}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: !!code && teamSlug !== null,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function useCompetitionStandings(code: string) {
  return useQuery<{ groups: StandingGroup[] }>({
    queryKey: ["competition", code, "standings"],
    queryFn: async () => {
      const res = await fetch(`${apiBase(code)}/standings`);
      if (!res.ok) throw new Error(`Failed to fetch standings: ${res.status}`);
      return res.json();
    },
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useCompetitionFixtures(code: string) {
  return useQuery<CompetitionRound[]>({
    queryKey: ["competition", code, "fixtures"],
    queryFn: async () => {
      const res = await fetch(`${apiBase(code)}/fixtures`);
      if (!res.ok) throw new Error(`Failed to fetch fixtures: ${res.status}`);
      const data = await res.json();
      return data.rounds as CompetitionRound[];
    },
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
