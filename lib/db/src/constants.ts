export const SORARE_POSITION: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  Defender: "Defence",
  Midfielder: "Midfield",
  Forward: "Offence",
};

export const CANONICAL_POSITIONS = ["Goalkeeper", "Defence", "Midfield", "Offence"] as const;
export type CanonicalPosition = (typeof CANONICAL_POSITIONS)[number];
