import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { IS_STATIC } from "@/lib/staticApi";
import type { ScenarioSummaryDTO, QuotaDTO } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Sparkles, BookOpen, Compass, PenLine } from "lucide-react";

const PILLARS = [
  {
    n: "01",
    title: "選擇與分支",
    text: "你的選擇會真的改變故事：接觸到不同的人、做不同的事、走向不同的後果——不是只換一段文字。",
  },
  {
    n: "02",
    title: "隱藏資訊",
    text: "同一個晚上，每條路線只看得到一部分線索。事實與說法要分開讀，全部湊起來才是全貌。",
  },
  {
    n: "03",
    title: "不評判",
    text: "沒有分數、沒有善良值、沒有「正確結局」。每個角色都有自己的難處，每個結局都是真實的後果。",
  },
  {
    n: "04",
    title: "AI 的參與",
    text: IS_STATIC
      ? "完整版的設計裡，AI 負責結局後的反思提問與新情境撰寫，來源都會標示；此靜態版本由系統內建規則接手，同樣如實標示。"
      : "AI 只做兩件事：在結局後依你這一輪的紀錄生成反思提問，以及在你主動要求時撰寫新情境。來源都會標示。",
  },
];

const THEME_EXAMPLES = [
  "畢業前最後一堂課",
  "社區大樓停電的夜晚",
  "醫院走廊的凌晨三點",
  "國中同學會的前一晚",
];

export default function Home() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState("");
  const [genError, setGenError] = useState<string | null>(null);

  const { data: scenarios, isLoading } = useQuery<ScenarioSummaryDTO[]>({
    queryKey: ["/api/scenarios"],
  });

  const { data: quota } = useQuery<QuotaDTO>({
    queryKey: ["/api/ai/quota"],
  });

  const generate = useMutation({
    mutationFn: async (theme: string) => {
      const res = await apiRequest("POST", "/api/scenarios/generate", {
        theme,
      });
      return res.json();
    },
    onSuccess: () => {
      setGenError(null);
      setTheme("");
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/quota"] });
    },
    onError: (err: Error) => {
      setGenError(err.message.replace(/^\d+:\s*/, "") || "生成失敗，請再試一次");
      queryClient.invalidateQueries({ queryKey: ["/api/ai/quota"] });
    },
  });

  const authored = scenarios?.filter((s) => s.origin === "authored") ?? [];
  const aiOnes = scenarios?.filter((s) => s.origin === "ai") ?? [];

  return (
    <div className="fade-up">
      {/* Hero */}
      <section className="pt-14 pb-10">
        <p className="mb-3 text-sm text-muted-foreground">
          一個小型的人生選擇體驗
        </p>
        <h1 className="font-serif text-4xl font-bold leading-tight sm:text-5xl">
          同一個晚上，
          <br />
          三種理解。
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-foreground/75">
          打烊前的十分鐘，你的同事突然離開了。
          你可以留下處理、追出去了解，或者交代清楚之後準時下班。
          每個選擇都通向不同的人、不同的後果——而沒有人會替你打分數。
        </p>
        {scenarios && scenarios.length > 0 && (
          <div className="mt-7">
            <Link href={`/play/${authored[0]?.id ?? scenarios[0].id}`}>
              <Button size="lg" data-testid="button-play-main">
                開始這一晚
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </section>

      {/* 四層設計 */}
      <section className="border-t border-border/60 py-10">
        <h2 className="mb-6 font-serif text-lg font-semibold">
          這個體驗在練習的四件事
        </h2>
        <div className="space-y-0">
          {PILLARS.map((p, i) => (
            <div
              key={p.n}
              className={`grid grid-cols-[auto_1fr] gap-4 py-5 ${
                i > 0 ? "border-t border-border/40" : ""
              }`}
            >
              <span className="font-serif text-sm text-primary/70">{p.n}</span>
              <div>
                <h3 className="font-medium">{p.title}</h3>
                <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  {p.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 情境清單 */}
      <section className="border-t border-border/60 py-10">
        <h2 className="mb-6 font-serif text-lg font-semibold">情境</h2>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {authored.map((s) => (
              <ScenarioCard key={s.id} s={s} />
            ))}
            {aiOnes.map((s) => (
              <ScenarioCard key={s.id} s={s} />
            ))}
          </div>
        )}
      </section>

      {/* AI 情境生成（靜態版不提供） */}
      {!IS_STATIC && (
      <section className="border-t border-border/60 py-10">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-lg font-semibold">
            讓 AI 寫一個新情境
          </h2>
          {quota && (
            <span className="text-xs text-muted-foreground">
              本小時額度：{quota.generationRemaining}/{quota.limitPerHour}
            </span>
          )}
        </div>
        <p className="mb-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          給它一個主題，AI 會寫出一個有分支、有隱藏線索、不評判的新情境，
          經過結構驗證後加入上面的清單。這是主動觸發的功能，
          每次呼叫消耗數千 tokens，每小時全站上限 10 次。
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="輸入主題，例如：畢業前最後一堂課"
            maxLength={40}
            className="flex-1"
            data-testid="input-theme"
            onKeyDown={(e) => {
              if (e.key === "Enter" && theme.trim() && !generate.isPending) {
                generate.mutate(theme.trim());
              }
            }}
          />
          <Button
            disabled={!theme.trim() || generate.isPending || (quota?.available === false)}
            onClick={() => generate.mutate(theme.trim())}
            data-testid="button-generate"
          >
            {generate.isPending ? (
              <>
                <Sparkles className="mr-1 h-4 w-4 animate-pulse" />
                撰寫中，約需一分鐘
              </>
            ) : (
              <>
                <PenLine className="mr-1 h-4 w-4" />
                開始撰寫
              </>
            )}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {THEME_EXAMPLES.map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              data-testid={`chip-theme-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
        {genError && (
          <p
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
            data-testid="text-gen-error"
          >
            {genError}
          </p>
        )}
        {generate.isSuccess && !genError && (
          <p
            className="mt-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm"
            data-testid="text-gen-success"
          >
            新情境已加入上面的清單。
          </p>
        )}
      </section>
      )}
      {IS_STATIC && (
        <section className="border-t border-border/60 py-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            此版本為純前端靜態部署：情境與遊玩紀錄都在你的瀏覽器裡，
            不需要伺服器。反思回饋由系統內建規則即時產生（如實標示），
            AI 生成新情境的功能需要後端，在此版本不提供。
          </p>
        </section>
      )}

      {/* 其他入口 */}
      <section className="border-t border-border/60 grid gap-4 py-10 sm:grid-cols-2">
        <Link href="/explore">
          <div className="rounded-lg border border-border/60 bg-card p-5 transition-colors hover:border-primary/50">
            <Compass className="mb-3 h-5 w-5 text-primary" />
            <h3 className="font-medium">探索地圖</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {IS_STATIC
                ? "你的遊玩紀錄累積出的結局與線索地圖（存在這台瀏覽器）。"
                : "所有人的遊玩紀錄累積出的結局與線索地圖。"}
            </p>
          </div>
        </Link>
        <Link href="/about">
          <div className="rounded-lg border border-border/60 bg-card p-5 transition-colors hover:border-primary/50">
            <BookOpen className="mb-3 h-5 w-5 text-primary" />
            <h3 className="font-medium">設計說明</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              四層設計、AI 的使用範圍與成本控制。
            </p>
          </div>
        </Link>
      </section>
    </div>
  );
}

function ScenarioCard({ s }: { s: ScenarioSummaryDTO }) {
  return (
    <Link href={`/play/${s.id}`}>
      <div className="group rounded-lg border border-border/60 bg-card p-5 transition-colors hover:border-primary/50 sm:p-6" data-testid={`card-scenario-${s.id}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-lg font-semibold">{s.title}</h3>
          <span className="clue-tag">
            {s.origin === "authored" ? "撰寫版" : "AI 生成"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{s.subtitle}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground/70">
          {s.brief[0]}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {s.cluesTotal} 條線索 ・ {s.endingsTotal} 個結局
          </span>
          {s.progress.totalRuns > 0 && (
            <span data-testid={`text-progress-${s.id}`}>
              已被走過 {s.progress.totalRuns} 輪 ・
              探索了 {s.progress.endingsDiscovered}/{s.endingsTotal} 個結局
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
