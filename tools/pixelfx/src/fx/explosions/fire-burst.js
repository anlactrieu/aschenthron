// Aschenthron-Remix: small-explosion, nur die ersten 1,5 s (Blitz, Feuerball, Funken, Beginn des Rauchs) in kleinerem Rahmen,
// als Einschlag des Feuerball-Zaubers. Der lange Rauchschwanz der Vorlage entfällt.
import * as base from "./small-explosion.js";

export const meta = {
  ...base.meta,
  name: "Fire burst",
  desc: "Short fireball impact: the flash, the fireball and sparks of small-explosion, cut before the long smoke trail.",
  size: [200, 150],
  origin: [100, 120],
  duration: 1.3,
  options: { ...base.meta.options, stone: "#2a2230", size: 0.75 },
};
export * from "./small-explosion.js";
