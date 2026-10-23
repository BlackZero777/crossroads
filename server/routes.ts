import type { Express } from "express";
import type { Server } from "node:http";
import { z } from "zod";
import { createHash } from "node:crypto";
import { eq, and, gt, sql } from "drizzle-orm";
import { db } from "./storage";
import { aiScenarios, playthroughs, aiUsage } from "@shared/schema";
import { closingTen } from "@shared/scenarios/closingTen";
import { validateScenario } from "@shared/scenario";
import type { Scenario, StoryNode } from "@shared/scenario";
import {
  generateReflection,
  generateScenario,
  llmAvailable,
  extractJson,
} from "./llm";
import { builtinReflection } from "../shared/builtin";
import { replay, type PathStep } from "../shared/replay";

/* ---------- 情境來源：作者撰寫 + AI 圖書館 ---------- */

function getAuthoredScenario(id: string): Scenario | undefined {
  if (id === closingTen.id) return closingTen;
  return undefined;
}

async function getAiScenario(id: string): Promise<Scenario | undefined> {
  const row = await db
    .select()
    .from(aiScenarios)
    .where(eq(aiScenarios.scenarioId, id))
    .get();
  if (!row) return undefined;
  try {
    return JSON.parse(row.data) as Scenario;
  } catch {
    return undefined;
  }
}

async function getScenario(id: string): Promise<Scenario | undefined> {
  return (await getAiScenario(id)) ?? getAuthoredScenario(id);
}

function scenarioSummary(s: Scenario) {
  return {
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    origin: s.origin,
    brief: s.brief,
    characters: s.characters,
    cluesTotal: s.clues.length,
    endingsTotal: Object.keys(s.endings).length,
  };
}

/* ---------- 伺服器端重放：不信任客戶端提交的路徑與線索 ---------- */
/* replay 實作移至 shared/replay.ts，與靜態版共用 */

/* ---------- AI 額度（落庫，重啟不歸零） ---------- */

const BUDGETS = {
  reflection: { limit: 30, label: "反思回饋" },
  generation: { limit: 10, label: "情境生成" },
} as const;

async function usedInLastHour(kind: keyof typeof BUDGETS): Promise<number> {
  const since = new Date(Date.now() - 3600_000);
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiUsage)
    .where(and(eq(aiUsage.kind, kind), gt(aiUsage.createdAt, since)))
    .get();
  return row?.count ?? 0;
}

async function remaining(kind: keyof typeof BUDGETS): Promise<number> {
  const used = await usedInLastHour(kind);
  return Math.max(0, BUDGETS[kind].limit - used);
}

async function consume(kind: keyof typeof BUDGETS): Promise<boolean> {
  // 原子操作：只有當最近一小時用量未達上限時才插入紀錄。
  // 失敗的呼叫也計入額度（在呼叫前預留）；快取命中不經過這裡。
  // 注意：created_at 欄位是「秒」（drizzle timestamp 模式），這裡必須用同一單位。
  const nowSec = Math.floor(Date.now() / 1000);
  const sinceSec = nowSec - 3600;
  const result = db.run(
    sql`INSERT INTO ai_usage (kind, created_at) SELECT ${kind}, ${nowSec} WHERE (SELECT COUNT(*) FROM ai_usage WHERE kind = ${kind} AND created_at > ${sinceSec}) < ${BUDGETS[kind].limit}`
  );
  return result.changes === 1;
}

/* ---------- 反思回饋快取與進行中請求合併 ---------- */

const reflectionCache = new Map<string, { source: string; reflection: string }>();
const inFlight = new Map<string, Promise<string>>();

function signatureOf(
  scenarioId: string,
  choiceIds: string[],
  endingId: string
): string {
  return createHash("sha1")
    .update(
      JSON.stringify({ scenarioId, choiceIds, endingId, v: 2 })
    )
    .digest("hex");
}

async function produceReflection(
  scenario: Scenario,
  path: PathStep[],
  clueIds: string[],
  endingId: string,
  signature: string
): Promise<string> {
  let output: { summary: string; questions: string[] } | null = null;
  let source = "builtin";

  // 先預留額度再呼叫模型：失敗的呼叫也計入成本，快取命中則完全不算
  let reserved = false;
  if (llmAvailable()) {
    reserved = await consume("reflection");
  }

  if (reserved) {
    try {
      output = await generateReflection({
        scenarioTitle: scenario.title,
        pathLabels: path.map((p) => p.choiceLabel),
        steps: path.map((p) => {
          const node = scenario.nodes[p.nodeId];
          const nextNode = scenario.nodes[
            (node?.choices ?? []).find((c) => c.id === p.choiceId)?.next ?? ""
          ];
          return {
            choiceLabel: p.choiceLabel,
            nodeTitle: nextNode?.title ?? "",
            clueLabels: (nextNode?.clues ?? [])
              .map((id) => scenario.clues.find((c) => c.id === id)?.label)
              .filter(Boolean) as string[],
          };
        }),
        clues: clueIds
          .map((id) => scenario.clues.find((c) => c.id === id)!)
          .filter(Boolean)
          .map((c) => ({ label: c.label, text: c.text, kind: c.kind })),
        endingTitle: scenario.endings[endingId].title,
        endingText: scenario.endings[endingId].text,
      });
      if (output) {
        source = "ai";
      }
    } catch (err) {
      console.error("reflection LLM failed, fallback to builtin:", err);
      output = null;
    }
  }

  if (!output) {
    output = builtinReflection(scenario, path, clueIds, endingId);
  }
  const reflectionText = JSON.stringify(output);
  reflectionCache.set(signature, { source, reflection: reflectionText });
  return reflectionText;
}

/* ---------- 路由 ---------- */

const runBodySchema = z.object({
  scenarioId: z.string().min(1),
  choiceIds: z.array(z.string()).min(1).max(32),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  /* 情境清單（含跨輪探索進度） */
  app.get("/api/scenarios", async (_req, res) => {
    const aiRows = await db.select().from(aiScenarios).all();
    const list: Scenario[] = [closingTen];
    for (const row of aiRows) {
      try {
        list.push(JSON.parse(row.data) as Scenario);
      } catch {
        // skip corrupted
      }
    }
    const allRuns = await db.select().from(playthroughs).all();
    const byScenario = new Map<
      string,
      { endings: Set<string>; clues: Set<string>; runs: number }
    >();
    for (const run of allRuns) {
      const agg =
        byScenario.get(run.scenarioId) ?? {
          endings: new Set<string>(),
          clues: new Set<string>(),
          runs: 0,
        };
      agg.endings.add(run.endingId);
      for (const c of JSON.parse(run.clueIds) as string[]) agg.clues.add(c);
      agg.runs += 1;
      byScenario.set(run.scenarioId, agg);
    }
    res.json(
      list.map((s) => {
        const agg = byScenario.get(s.id);
        return {
          ...scenarioSummary(s),
          progress: {
            endingsDiscovered: agg ? agg.endings.size : 0,
            cluesDiscovered: agg ? agg.clues.size : 0,
            totalRuns: agg ? agg.runs : 0,
          },
        };
      })
    );
  });

  /* 單一情境完整內容 */
  app.get("/api/scenarios/:id", async (req, res) => {
    const s = await getScenario(req.params.id);
    if (!s) return res.status(404).json({ message: "找不到這個情境" });
    res.json(s);
  });

  /* 單一情境的探索進度 */
  app.get("/api/scenarios/:id/progress", async (req, res) => {
    const s = await getScenario(req.params.id);
    if (!s) return res.status(404).json({ message: "找不到這個情境" });
    const runs = await db
      .select()
      .from(playthroughs)
      .where(eq(playthroughs.scenarioId, s.id))
      .all();
    const endings = new Set<string>();
    const clues = new Set<string>();
    for (const run of runs) {
      endings.add(run.endingId);
      for (const c of JSON.parse(run.clueIds) as string[]) clues.add(c);
    }
    res.json({
      endingsDiscovered: [...endings],
      cluesDiscovered: [...clues],
      totalRuns: runs.length,
      endingsTotal: Object.keys(s.endings).length,
      cluesTotal: s.clues.length,
    });
  });

  /* 完成一輪：伺服器端重放驗證 → 反思回饋（快取／額度／合併）＋儲存紀錄 */
  app.post("/api/run", async (req, res) => {
    const parsed = runBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "紀錄格式不正確" });
    }
    const { scenarioId, choiceIds } = parsed.data;
    const scenario = await getScenario(scenarioId);
    if (!scenario) return res.status(404).json({ message: "找不到這個情境" });

    const result = replay(scenario, choiceIds);
    if (!result) {
      return res
        .status(400)
        .json({ message: "這組選擇無法走完整輪（路徑不合法）" });
    }

    const { path, clueIds, endingId } = result;
    const signature = signatureOf(scenarioId, choiceIds, endingId);

    let source: string;
    let reflectionText: string;

    const cached = reflectionCache.get(signature);
    if (cached) {
      source = cached.source;
      reflectionText = cached.reflection;
    } else {
      const row = await db
        .select()
        .from(playthroughs)
        .where(eq(playthroughs.signature, signature))
        .get();
      if (row) {
        source = row.reflectionSource;
        reflectionText = row.reflection;
        reflectionCache.set(signature, { source, reflection: reflectionText });
      } else {
        // 進行中的相同請求合併，避免重複呼叫
        let p = inFlight.get(signature);
        if (!p) {
          p = produceReflection(scenario, path, clueIds, endingId, signature);
          inFlight.set(signature, p);
          p.finally(() => inFlight.delete(signature));
        }
        reflectionText = await p;
        const c = reflectionCache.get(signature);
        source = c?.source ?? "builtin";
      }
    }

    // 儲存遊玩紀錄（探索地圖資料來源）
    await db
      .insert(playthroughs)
      .values({
        scenarioId,
        signature,
        path: JSON.stringify(path),
        clueIds: JSON.stringify(clueIds),
        endingId,
        reflectionSource: source,
        reflection: reflectionText,
      })
      .run();

    let reflection: { summary: string; questions: string[] };
    try {
      reflection = JSON.parse(reflectionText);
    } catch {
      reflection = builtinReflection(scenario, path, clueIds, endingId);
      source = "builtin";
    }
    res.json({ source, ...reflection });
  });

  /* AI 產生新情境（使用者主動觸發，資料庫額度控制） */
  app.post("/api/scenarios/generate", async (req, res) => {
    const parsed = z
      .object({ theme: z.string().trim().min(1).max(40) })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "請提供 1-40 字的主題描述" });
    }
    if (!llmAvailable()) {
      return res.status(503).json({ message: "AI 通道目前無法使用" });
    }
    if (!(await consume("generation"))) {
      return res.status(429).json({
        message: `AI 情境生成額度已用完（每小時 ${BUDGETS.generation.limit} 次），請稍後再試`,
      });
    }

    const theme = parsed.data.theme;

    let result = await generateScenario(theme);
    let validation = validateScenario(result.raw);

    // 失敗時帶著錯誤訊息重試一次（同樣計入額度，規格會完整重送）
    if (!validation.ok) {
      if (!(await consume("generation"))) {
        return res.status(429).json({
          message: `AI 情境生成額度已用完（每小時 ${BUDGETS.generation.limit} 次），請稍後再試`,
        });
      }
      result = await generateScenario(theme, validation.errors);
      validation = validateScenario(result.raw);
    }

    if (!validation.ok || !validation.scenario) {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(
        "debug-gen.log",
        `=== ${new Date().toISOString()} ===\n${result.raw.slice(0, 2000)}\n\nERRORS: ${validation.errors.join(
          " | "
        )}\n\n`
      );
      return res.status(502).json({
        message: "AI 產生的情境未通過結構驗證，請再試一次",
        errors: validation.errors.slice(0, 10),
      });
    }

    const scenario = validation.scenario;
    // 伺服器端重新配置 id，避免碰撞
    scenario.id = `ai-${Date.now().toString(36)}`;

    await db
      .insert(aiScenarios)
      .values({
        scenarioId: scenario.id,
        theme,
        data: JSON.stringify(scenario),
      })
      .run();

    res.json({
      ...scenarioSummary(scenario),
      remaining: await remaining("generation"),
    });
  });

  /* AI 額度狀態（供前端顯示成本資訊） */
  app.get("/api/ai/quota", async (_req, res) => {
    res.json({
      available: llmAvailable(),
      generationRemaining: await remaining("generation"),
      reflectionRemaining: await remaining("reflection"),
      limits: BUDGETS,
    });
  });

  return httpServer;
}
