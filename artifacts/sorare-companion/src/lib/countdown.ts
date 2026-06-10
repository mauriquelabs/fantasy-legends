export type CountdownResult =
  | { past: true; days: 0; hours: 0; minutes: 0; seconds: 0 }
  | { past: false; days: number; hours: number; minutes: number; seconds: number };

export function computeCountdown(targetMs: number, nowMs: number): CountdownResult {
  const ms = targetMs - nowMs;
  if (ms <= 0) return { past: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const totalSeconds = Math.floor(ms / 1000);
  return {
    past: false,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
