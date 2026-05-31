export const POSITION_ORDER = ["Goalkeeper", "Defence", "Midfield", "Offence"] as const;
export const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: "Goalkeepers",
  Defence: "Defenders",
  Midfield: "Midfielders",
  Offence: "Forwards",
};

export function ScoreBar({ scores }: { scores: number[] }) {
  if (!scores.length) return null;
  return (
    <div className="flex items-end gap-0.5 h-4">
      {scores.map((s, i) => {
        const h = Math.max(2, Math.round((s / 100) * 16));
        const c = s >= 60 ? "#22c55e" : s >= 40 ? "#f5c518" : "#ef4444";
        return <div key={i} className="w-1.5 rounded-sm" style={{ height: h, backgroundColor: c }} />;
      })}
    </div>
  );
}

export function avgScoreColor(score: number): string {
  if (score >= 60) return "bg-green-500/15 text-green-400 border-green-500/30";
  if (score >= 45) return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  if (score >= 30) return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

export function AvgBadge({ score }: { score: number }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold tabular-nums ${avgScoreColor(score)}`}>
      {score.toFixed(0)}
    </span>
  );
}
