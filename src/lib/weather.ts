// Live NYC temperature from Open-Meteo (free, no key). Used to derate DC charging in
// the cold. Returns null on any failure so the UI just skips the cold adjustment.
export type LiveConditions = { tempC: number; observedAt: string; source: "open-meteo" };

const URL =
  "https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m&timezone=America/New_York";

// observedAt is New York wall-clock time with no offset ("2026-11-06T18:00"). new Date()
// would read it as UTC on the server and local time in the browser, so format the text.
export function formatObservedAt(observedAt: string): string {
  const [h, m] = observedAt.slice(11, 16).split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? "AM" : "PM"}`;
}

export async function getLiveConditions(): Promise<LiveConditions | null> {
  try {
    const res = await fetch(URL, { next: { revalidate: 900 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const { current } = await res.json();
    if (typeof current?.temperature_2m !== "number") return null;
    return { tempC: current.temperature_2m, observedAt: String(current.time), source: "open-meteo" };
  } catch {
    return null;
  }
}
