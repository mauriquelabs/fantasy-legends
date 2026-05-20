export async function sorareQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${BASE}/api/sorare/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "GraphQL error");
  return json.data as T;
}

export const RARITY_COLORS = {
  LIMITED: "#00d4b4",
  RARE: "#f5c518",
  SUPER_RARE: "#9b59b6",
  UNIQUE: "#e74c3c",
} as const;

export function formatEth(wei: string | number | undefined | null): string {
  if (!wei) return "0.000";
  const num = typeof wei === "string" ? parseFloat(wei) : wei;
  return (num / 1e18).toFixed(3);
}
