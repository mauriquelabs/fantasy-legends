// Pure name-normalisation and slug utilities shared by players and world-cup routes.

export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

// Derives Sorare slug candidates from an FD player name.
// e.g. "Aurélien Tchouaméni" → ["aurelien-tchouameni", "tchouameni-aurelien"]
export function slugVariants(fdName: string): string[] {
  const parts = normName(fdName).split(/\s+/).filter(Boolean);
  const variants = new Set<string>();
  variants.add(parts.join("-"));
  if (parts.length >= 2) {
    variants.add([...parts].reverse().join("-"));
    if (parts.length > 2) variants.add(`${parts[0]}-${parts[parts.length - 1]}`);
  }
  return [...variants];
}

// Score how well two names match (0 = no overlap, 1 = exact).
export function similarity(fdName: string, sorareName: string): number {
  const a = normName(fdName);
  const b = normName(sorareName);
  if (a === b) return 1.0;
  const aParts = a.split(/\s+/).filter(w => w.length > 1);
  const bParts = b.split(/\s+/).filter(w => w.length > 1);
  if (!aParts.length || !bParts.length) return 0;
  const shared = aParts.filter(w => bParts.includes(w)).length;
  return shared / Math.max(aParts.length, bParts.length);
}
