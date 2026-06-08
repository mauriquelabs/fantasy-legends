import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

export interface DbPlayer {
  sorareSlug: string;
  name: string;
  position: string | null;
  nationality: string | null;
  teamName: string | null;
  teamSlug: string | null;
  avgScore: number | null;
  avg5Score: number | null;
  avg40Score: number | null;
  recentScores: number[] | null;
  gamesPlayedLast15: number | null;
  currentClub: string | null;
}

export interface LeagueSummary {
  id: number;
  code: string;
  name: string;
  draftAt: string | null;
  createdAt: string;
  memberCount: number;
}

export function useMyLeagues(session: Session | null) {
  return useQuery<LeagueSummary[]>({
    queryKey: ["api", "my-leagues", session?.user.id ?? null],
    queryFn: async () => {
      const res = await fetch("/api/leagues", {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!session,
    staleTime: 60 * 1000,
  });
}

export interface GameweekFixture {
  slug: string;
  startDate: string;
  endDate: string;
}

export function useGameweeks() {
  return useQuery<GameweekFixture[]>({
    queryKey: ["api", "gameweeks"],
    queryFn: async () => {
      const res = await fetch("/api/gameweeks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlayers(q?: string, teamSlug?: string) {
  return useQuery<DbPlayer[]>({
    queryKey: ["api", "players", q ?? "", teamSlug ?? ""],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (teamSlug) params.set("team", teamSlug);
      const qs = params.size > 0 ? `?${params}` : "";
      const res = await fetch(`/api/players${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.players as DbPlayer[];
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
