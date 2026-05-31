import { useQuery } from "@tanstack/react-query";

export interface DbPlayer {
  sorareSlug: string;
  name: string;
  position: string | null;
  teamName: string | null;
  teamSlug: string | null;
  avgScore: number | null;
  recentScores: number[] | null;
}

export function usePlayers() {
  return useQuery<DbPlayer[]>({
    queryKey: ["api", "players"],
    queryFn: async () => {
      const res = await fetch("/api/players");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.players as DbPlayer[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
