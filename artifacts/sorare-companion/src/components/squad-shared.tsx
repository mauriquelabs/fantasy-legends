import { useState } from "react";
import type React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";

import { CANONICAL_POSITIONS } from "@workspace/db/constants";

const POSITION_ABBR: Record<string, string> = {
  Goalkeeper: "GK",
  Defence: "DEF",
  Midfield: "MID",
  Offence: "FWD",
};

export interface PlayerRowProps {
  name: string;
  position: string | null;
  teamName: string | null;
  nationality?: string | null;
  score: number | null;
  recentScores?: number[] | null;
  sorareSlug?: string | null;
  badge?: React.ReactNode;
}

export function PlayerRow({ player, onClick }: { player: PlayerRowProps; onClick?: () => void }) {
  const parts = player.name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : player.name.slice(0, 2).toUpperCase();
  const posLabel = player.position ? (POSITION_ABBR[player.position] ?? player.position) : "—";

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors border-b border-border/40 last:border-0 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-sm font-black select-none shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm leading-tight truncate flex items-center gap-1.5">
          {player.name}
          {player.badge}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {player.teamName ?? "—"}
          {player.nationality && player.nationality !== player.teamName && (
            <span className="text-muted-foreground/60"> · {player.nationality}</span>
          )}
        </div>
      </div>
      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground shrink-0">
        {posLabel}
      </span>
      {player.recentScores && player.recentScores.length > 0 && (
        <ScoreBar scores={player.recentScores} />
      )}
      {player.score != null && <AvgBadge score={player.score} />}
      {player.sorareSlug && (
        <a
          href={`https://sorare.com/football/players/${player.sorareSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

export const POSITION_ORDER = CANONICAL_POSITIONS;

export interface PlayerDetailInfo {
  sorareSlug: string;
  name: string;
  position: string | null;
  club: string | null;
  avgScore: number | null;
  recentScores: number[];
}

function ScoreBarsDetailed({ scores }: { scores: number[] }) {
  if (!scores.length) return <p className="text-xs text-muted-foreground italic">No recent scores</p>;
  return (
    <div className="flex items-end gap-3">
      {scores.map((s, i) => {
        const color = s >= 60 ? "#22c55e" : s >= 40 ? "#f5c518" : "#ef4444";
        const h = Math.min(56, Math.max(6, Math.round((s / 100) * 56)));
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-mono text-muted-foreground">{s.toFixed(0)}</span>
            <div className="w-7 rounded" style={{ height: h, backgroundColor: color }} />
          </div>
        );
      })}
    </div>
  );
}

export function PlayerDetailDialog({
  player,
  open,
  onClose,
  onRemove,
}: {
  player: PlayerDetailInfo;
  open: boolean;
  onClose: () => void;
  onRemove?: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const hasStats = player.avgScore != null || player.recentScores.length > 0;

  async function handleRemove() {
    if (!onRemove) return;
    if (!window.confirm(`Remove "${player.name}" from the squad?`)) return;
    setRemoving(true);
    try {
      await onRemove();
      onClose();
    } finally {
      setRemoving(false);
    }
  }

  const sorareLink = (
    <a
      href={`https://sorare.com/football/players/${player.sorareSlug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      View on Sorare <ExternalLink className="w-3.5 h-3.5" />
    </a>
  );

  const removeButton = onRemove ? (
    <button
      onClick={handleRemove}
      disabled={removing}
      className="text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors disabled:opacity-40"
    >
      Remove from squad
    </button>
  ) : <span />;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">{player.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">{player.position ?? "—"}</p>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {hasStats ? (
            <>
              {player.club && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Club</span>
                  <span className="text-sm font-medium">{player.club}</span>
                </div>
              )}
              {player.avgScore != null && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Avg score</span>
                  <div className="flex items-center gap-2">
                    <AvgBadge score={player.avgScore} />
                    <span className="text-sm text-muted-foreground">(last 15)</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Recent SO5 scores</p>
                <ScoreBarsDetailed scores={player.recentScores} />
              </div>
              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                {removeButton}
                {sorareLink}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No Sorare stats available yet.</p>
              <div className="flex items-center justify-between">
                {removeButton}
                {sorareLink}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
