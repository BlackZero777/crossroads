import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { IS_STATIC } from "@/lib/staticApi";
import type { Scenario, RunResponseDTO } from "@/lib/api";
import type { Choice, Clue } from "@shared/scenario";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Notebook,
  RotateCcw,
  ChevronLeft,
  Compass,
  ListFilter,
  X,
} from "lucide-react";

interface PathStep {
  nodeId: string;
  choiceId: string;
  choiceLabel: string;
}

export default function Play({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const { data: scenario, error } = useQuery<Scenario>({
    queryKey: ["/api/scenarios", params.id],
  });

  const [phase, setPhase] = useState<"brief" | "story" | "ending">("brief");
  const [nodeId, setNodeId] = useState("");
  const [path, setPath] = useState<PathStep[]>([]);
  const [discovered, setDiscovered] = useState<Clue[]>([]);
  const [justRevealed, setJustRevealed] = useState<string[]>([]);
  const [ending, setEnding] = useState<Scenario["endings"][string] | null>(null);
  const [preEndingText, setPreEndingText] = useState<string[]>([]);
  const [reflection, setReflection] = useState<RunResponseDTO | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);

  const node = scenario ? scenario.nodes[nodeId] : undefined;

  const startRun = () => {
    if (!scenario) return;
    setPhase("story");
    setNodeId(scenario.start);
    setPath([]);
    setEnding(null);
    setPreEndingText([]);
    setReflection(null);
    setDiscovered([]);
    setJustRevealed([]);
    revealNodeClues(scenario.nodes[scenario.start]);
  };

  const revealNodeClues = (n: Scenario["nodes"][string] | undefined) => {
    if (!n?.clues || !scenario) return;
    const ids = n.clues;
    setDiscovered((prev) => {
      const merged = [...prev];
      ids.forEach((id) => {
        const clue = scenario.clues.find((c) => c.id === id);
        if (clue && !merged.some((m) => m.id === id)) merged.push(clue);
      });
      return merged;
    });
    setJustRevealed(ids);
  };

  const finishRun = async (
    newPath: PathStep[],
    clueIds: string[],
    endingId: string
  ) => {
    if (!scenario) return;
    setReflection(null);
    setReflectionLoading(true);
    try {
      const res = await apiRequest("POST", "/api/run", {
        scenarioId: scenario.id,
        choiceIds: newPath.map((p) => p.choiceId),
      });
      const data = (await res.json()) as RunResponseDTO;
      setReflection(data);
      // 讓情境清單與探索地圖的進度立即更新（不重新整理）
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
    } catch {
      setReflection({
        source: "builtin",
        summary:
          "連線異常：反思回饋未能生成，且本輪紀錄可能沒有保存。你可以重新走一輪，或稍後再試。",
        questions: ["回頭看這一輪，哪個選擇最接近你平常的樣子？"],
      });
    } finally {
      setReflectionLoading(false);
    }
  };

  const mergeClues = (ids: string[]): Clue[] => {
    if (!scenario) return discovered;
    const merged = [...discovered];
    ids.forEach((id) => {
      const clue = scenario.clues.find((c) => c.id === id);
      if (clue && !merged.some((m) => m.id === id)) merged.push(clue);
    });
    return merged;
  };

  const choose = (choice: Choice) => {
    if (!scenario) return;
    const step: PathStep = { nodeId, choiceId: choice.id, choiceLabel: choice.label };
    const newPath = [...path, step];
    setPath(newPath);

    const target = scenario.nodes[choice.next];
    if (target) {
      const targetClueIds = target.clues ?? [];
      // 更新線索筆記（含終端節點揭示的線索）
      setDiscovered((prev) => {
        const merged = [...prev];
        targetClueIds.forEach((id) => {
          const clue = scenario.clues.find((c) => c.id === id);
          if (clue && !merged.some((m) => m.id === id)) merged.push(clue);
        });
        return merged;
      });

      if (target.endingId) {
        setPreEndingText(target.text);
        setEnding(scenario.endings[target.endingId]);
        setPhase("ending");
        const finalIds = mergeClues(targetClueIds).map((c) => c.id);
        finishRun(newPath, finalIds, target.endingId);
      } else {
        setNodeId(choice.next);
        setJustRevealed(targetClueIds);
      }
    } else {
      // 選項直接指向結局
      setPreEndingText([]);
      setEnding(scenario.endings[choice.next]);
      setPhase("ending");
      finishRun(newPath, discovered.map((c) => c.id), choice.next);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const undiscoveredCount = useMemo(
    () => (scenario ? scenario.clues.length - discovered.length : 0),
    [scenario, discovered]
  );

  if (error) {
    return (
      <div className="pt-20 text-center">
        <p className="text-muted-foreground">找不到這個情境。</p>
        <Link href="/">
          <Button variant="outline" className="mt-4">
            回情境列表
          </Button>
        </Link>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="space-y-4 pt-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-6 w-4/6" />
      </div>
    );
  }

  return (
    <div className="pt-8">
      {/* 頂部工具列 */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ChevronLeft className="mr-1 h-4 w-4" />
            情境列表
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {phase === "story" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={startRun}
              data-testid="button-restart"
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              重新開始
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNotebookOpen(true)}
            data-testid="button-notebook"
          >
            <Notebook className="mr-1.5 h-4 w-4" />
            線索筆記
            <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-xs text-primary">
              {discovered.length}/{scenario.clues.length}
            </span>
          </Button>
        </div>
      </div>

      {/* 簡介頁 */}
      {phase === "brief" && (
        <div className="fade-up">
          <p className="mb-2 text-sm text-muted-foreground">{scenario.subtitle}</p>
          <h1 className="mb-8 font-serif text-3xl font-bold">{scenario.title}</h1>
          <div className="story-prose space-y-4">
            {scenario.brief.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {scenario.characters.map((c) => (
              <span key={c.name} className="clue-tag">
                {c.name}｜{c.role}
              </span>
            ))}
          </div>
          <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted-foreground">
            接下來的每個選擇都會帶你去不同的地方。你只能看到這條路線上的線索——
            它們會進入你的「線索筆記」，分為事實與某人的說法。
          </p>
          <Button size="lg" className="mt-6" onClick={startRun} data-testid="button-start">
            開始
          </Button>
        </div>
      )}

      {/* 故事進行中 */}
      {phase === "story" && node && (
        <div key={nodeId} className="fade-up">
          {path.length > 0 && (
            <p className="mb-6 text-xs text-muted-foreground">
              你選擇了：{path[path.length - 1].choiceLabel}
            </p>
          )}
          <h2 className="mb-6 font-serif text-xl font-semibold">{node.title}</h2>
          <div className="story-prose space-y-4">
            {node.text.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {justRevealed.length > 0 && (
            <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="block-clue-reveal">
              <p className="mb-2 flex items-center gap-1.5 text-xs text-primary">
                <ListFilter className="h-3.5 w-3.5" />
                線索更新
              </p>
              <ul className="space-y-2">
                {justRevealed.map((id) => {
                  const clue = scenario.clues.find((c) => c.id === id);
                  return clue ? (
                    <li key={id} className="text-sm">
                      <span className="clue-tag mr-2">
                        {clue.kind === "fact" ? "事實" : "說法"}
                      </span>
                      <span className="font-medium">{clue.label}</span>
                      <span className="text-muted-foreground">——{clue.text}</span>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          )}

          <div className="mt-10 space-y-3">
            {node.choices?.map((c, i) => (
              <button
                key={c.id}
                onClick={() => choose(c)}
                className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-accent/40 sm:p-5"
                data-testid={`button-choice-${c.id}`}
              >
                <span className="choice-index">{i + 1}</span>
                <span className="pt-0.5 leading-relaxed">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 結局 */}
      {phase === "ending" && ending && (
        <div className="fade-up">
          <p className="mb-2 text-sm text-muted-foreground">結局</p>
          <h1 className="mb-8 font-serif text-3xl font-bold">{ending.title}</h1>
          <div className="story-prose space-y-4">
            {preEndingText.map((p, i) => (
              <p key={`pre-${i}`} className="text-foreground/70">
                {p}
              </p>
            ))}
            {ending.text.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* AI 反思回饋 */}
          <div className="mt-10 rounded-lg border border-border/60 bg-card p-5 sm:p-6" data-testid="card-reflection">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold">這一輪的反思</h3>
              {reflection && (
                <span className="clue-tag" data-testid="badge-reflection-source">
                  {reflection.source === "ai"
                    ? "AI 即時生成"
                    : "系統內建回饋"}
                </span>
              )}
            </div>
            {reflectionLoading || !reflection ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            ) : (
              <div>
                <p className="leading-relaxed text-foreground/85">
                  {reflection.summary}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {reflection.questions.map((q, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                      <span className="choice-index">{i + 1}</span>
                      <span className="pt-1 text-foreground/80">{q}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {reflection.source === "ai"
                    ? "由 AI 依你這一輪的選擇與已發現的線索即時生成。它看不到你沒發現的線索，也不會評判你。"
                    : IS_STATIC
                      ? "此版本為純前端部署，反思回饋由系統內建規則即時產生，如實標示。"
                      : "AI 暫時無法連線時，由系統內建的規則式回饋接手，來源如實標示。"}
                </p>
              </div>
            )}
          </div>

          {/* 這一輪的線索 */}
          <div className="mt-6 rounded-lg border border-border/60 bg-card p-5 sm:p-6">
            <h3 className="mb-4 font-serif text-lg font-semibold">
              這一輪你看見的線索
            </h3>
            {discovered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                這一輪沒有發現任何線索。
              </p>
            ) : (
              <ul className="space-y-2.5">
                {discovered.map((c) => (
                  <li key={c.id} className="text-sm leading-relaxed">
                    <span className="clue-tag mr-2">
                      {c.kind === "fact" ? "事實" : "說法"}
                    </span>
                    <span className="font-medium">{c.label}</span>
                    <span className="text-muted-foreground">——{c.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {undiscoveredCount > 0 && (
              <p
                className="mt-4 border-t border-border/40 pt-4 text-sm text-muted-foreground"
                data-testid="text-undiscovered"
              >
                還有 {undiscoveredCount}{" "}
                條線索不在這一輪的視野裡。換一條路，會看到同一個晚上不同的部分。
              </p>
            )}
          </div>

          {/* 下一步 */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={startRun} data-testid="button-replay">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              再走一次
            </Button>
            <Link href={`/explore/${scenario.id}`}>
              <Button size="lg" variant="outline" data-testid="button-explore">
                <Compass className="mr-1.5 h-4 w-4" />
                探索地圖
              </Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="ghost" className="text-muted-foreground">
                全部情境
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 線索筆記抽屜 */}
      {notebookOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60"
          onClick={() => setNotebookOpen(false)}
          data-testid="drawer-backdrop"
        >
          <aside
            className="ml-auto flex h-full w-full max-w-sm flex-col border-l border-border bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">
                線索筆記 {discovered.length}/{scenario.clues.length}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNotebookOpen(false)}
                aria-label="關閉線索筆記"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
              線索分為「事實」與「說法」。說法是某個人眼裡的版本，
              不一定等於事情的全貌。
            </p>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {discovered.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  還沒有發現任何線索。故事進行中，線索會自動記錄在這裡。
                </p>
              )}
              {discovered.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border/50 bg-card p-3.5"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="clue-tag">
                      {c.kind === "fact" ? "事實" : "說法"}
                    </span>
                    <span className="text-sm font-medium">{c.label}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
