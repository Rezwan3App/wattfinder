import WattFinder from "@/components/WattFinder";
import { getStations } from "@/lib/stations";
import { getLiveConditions } from "@/lib/weather";

// Weather is live; refresh the rendered page about every 15 minutes.
export const revalidate = 900;

export default async function Home() {
  const [{ stations, source }, conditions] = await Promise.all([
    getStations(),
    getLiveConditions(),
  ]);
  return <WattFinder stations={stations} source={source} conditions={conditions} />;
}
