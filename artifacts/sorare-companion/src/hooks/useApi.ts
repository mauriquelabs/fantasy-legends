import { useQuery } from "@tanstack/react-query";

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
