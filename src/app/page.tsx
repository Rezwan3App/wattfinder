import { WattfinderMark } from "@/components/WattfinderMark";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6">
      <main className="flex max-w-md flex-col items-center gap-5 text-center">
        <WattfinderMark className="h-16 w-16" />
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          wattfinder
        </h1>
        <p className="text-base leading-7 text-foreground/70">
          Which nearby station is free right now, and how long will charging
          actually take for your car?
        </p>
      </main>
    </div>
  );
}
