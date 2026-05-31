// ui/src/components/GreetingChip.tsx
import { Sun, Calendar as CalendarIcon, MapPin } from "lucide-react";

interface Props {
  managerName: string;
  storeName?: string;
  storeLocation?: string;
  weather?: string;
}

export function GreetingChip({ managerName, storeName, storeLocation, weather }: Props) {
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 11 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
                "Good evening";
  const firstName = managerName.split(" ")[0];
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const initials = managerName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <section className="relative overflow-hidden rounded-xl border border-[color:var(--color-hairline)] bg-white p-5 shadow-sm">
      {/* subtle accent stripe */}
      <div className="absolute left-0 top-0 h-full w-1 bg-[color:var(--color-lava)]" />

      <div className="flex flex-wrap items-center gap-4 pl-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
          style={{
            background: "linear-gradient(135deg, var(--color-lava), #C32815)",
            letterSpacing: "0.02em",
          }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-ink)]">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-0.5 text-sm text-[color:var(--color-ink-soft)]">
            Here's what's happening at your store today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip>
            <CalendarIcon className="size-3.5 text-[color:var(--color-ink-soft)]" />
            <span>{dateStr}</span>
          </Chip>

          {storeName && (
            <Chip>
              <MapPin className="size-3.5 text-[color:var(--color-lava)]" />
              <span className="font-medium text-[color:var(--color-ink)]">{storeName}</span>
              {storeLocation && (
                <span className="text-[color:var(--color-ink-soft)]">· {storeLocation}</span>
              )}
            </Chip>
          )}

          {weather && (
            <Chip>
              <Sun className="size-3.5 text-[#FBB300]" />
              <span>{weather}</span>
            </Chip>
          )}
        </div>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] px-3 py-1 text-xs text-[color:var(--color-ink-soft)]">
      {children}
    </div>
  );
}
