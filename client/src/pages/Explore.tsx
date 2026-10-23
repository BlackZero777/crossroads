import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Scenario, ScenarioSummaryDTO, ProgressDTO } from "@/lib/api";
import { IS_STATIC } from "@/lib/staticApi";

export default function Explore({ params }: { params: { id?: string } }) {
  const initial = params.id ?? null;
  const { data: scenarios } = useQuery<ScenarioSummaryDTO[]>({
    queryKey: ["/api/scenarios"],
  });

  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (initial) setSelected(initial);
    else if (scenarios && scenarios.length > 0 && !selected) {
      setSelected(scenarios[0].id);
    }
  }, [initial, scenarios, selected]);

  const { data: scenario } = useQuery<Scenario>({
    queryKey: ["/api/scenarios", selected ?? ""],
    enabled: Boolean(selected),
  });

  const { data: progress } = useQuery<ProgressDTO>({
    queryKey: ["/api/scenarios", selected ?? "", "progress"],
    enabled: Boolean(selected),
  });

  const discoveredEndings = useMemo(
    () => new Set(progress?.endingsDiscovered ?? []),
    [progress]
  );
  const discoveredClues = useMemo(
    () => new Set(progress?.cluesDiscovered ?? []),
    [progress]
  );

  if (!scenarios) {
    return (
      <div className="pt-10">
        <p className="text-muted-foreground">載入中…</p>
      </div>
    );
  }

  return (
    <div className="fade-up pt-8">
      <h1 className="font-serif text-3xl font-bold">探索地圖</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {IS_STATIC
                ? "這裡是你自己在這台瀏覽器累積出來的地圖：哪些結局被走到過、哪些線索被發現過。還沒被走到的結局不會透露內容——那是留給下一輪的你。"
                : "這裡是所有人的遊玩紀錄累積出來的地圖：哪些結局被走到過、 哪些線索被發現過。還沒被走到的結局不會透露內容——那是留給下一輪的你。"}
      </p>

      {/* 情境切換 */}
      <div className="mt-8 flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              selected === s.id
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
            data-testid={`tab-scenario-${s.id}`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {scenario && progress && (
        <div className="mt-8">
          <div className="mb-8 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <h2 className="font-serif text-xl font-semibold">
              {scenario.title}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-run-stats">
              共被走過 {progress.totalRuns} 輪 ・
              結局 {progress.endingsDiscovered.length}/{progress.endingsTotal} ・
              線索 {progress.cluesDiscovered.length}/{progress.cluesTotal}
            </p>
          </div>

          {/* 結局地圖 */}
          <section>
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              結局
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.values(scenario.endings).map((e) => {
                const found = discoveredEndings.has(e.id);
                return (
                  <div
                    key={e.id}
                    className={`rounded-lg border p-4 ${
                      found
                        ? "border-border/60 bg-card"
                        : "border-dashed border-border/40 bg-background"
                    }`}
                    data-testid={`card-ending-${e.id}`}
                  >
                    <p className="font-serif font-semibold">
                      {found ? e.title : "？？？"}
                    </p>
                    {found ? (
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                        {e.text[0]}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm text-muted-foreground/60">
                        還沒有人走到這裡
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 線索地圖 */}
          <section className="mt-10">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              線索
            </h3>
            <div className="space-y-2.5">
              {scenario.clues.map((c) => {
                const found = discoveredClues.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={`rounded-lg border p-3.5 ${
                      found
                        ? "border-border/60 bg-card"
                        : "border-dashed border-border/40 bg-background"
                    }`}
                    data-testid={`card-clue-${c.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="clue-tag">
                        {found
                          ? c.kind === "fact"
                            ? "事實"
                            : "說法"
                          : "未發現"}
                      </span>
                      <span className="text-sm font-medium">
                        {found ? c.label : "還沒有人發現這條線索"}
                      </span>
                    </div>
                    {found && (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {c.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
