/**
 * Legacy World Cup routes live on the competitions router as /api/world-cup/*
 * aliases for competition code "WC". Prefer /api/competitions/:code/* going forward.
 */
export {
  syncWorldCup,
  syncCompetition,
  type SquadPlayer,
  type StandingRow,
  type StandingGroup,
} from "./competitions";

export { default } from "./competitions";
