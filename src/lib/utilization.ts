// Deterministic baseline busyness (0.25..0.64) from the station's stable OCM id.
// Same formula as scripts/seed.ts (which could import this instead of redefining it),
// so the JSON-cache path matches what was seeded into Postgres.
export const baseUtilization = (ocmId: number) => 0.25 + (ocmId % 40) / 100;
