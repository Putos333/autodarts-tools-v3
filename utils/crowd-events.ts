/**
 * crowd-events.ts — Shared crowd event key union.
 * Extracted so utils/crowd-samples.ts can reference the same list.
 */
export type CrowdEventKey =
  | "crowd_180"
  | "crowd_170"
  | "crowd_140plus"
  | "crowd_100plus"
  | "crowd_gameshot"
  | "crowd_matchshot"
  | "crowd_bust"
  | "crowd_bust_double_miss"
  | "crowd_low_score"
  | "crowd_checkout_pressure"
  | "crowd_nine_darter_potential"
  | "crowd_comeback"
  | "crowd_gameon"
  | "crowd_close_game"
  | "crowd_ambient";
