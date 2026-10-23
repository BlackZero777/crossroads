/**
 * 靜態版（GitHub Pages）的本機資料層。
 * 不需要後端伺服器：情境打包進網頁、遊玩紀錄存在瀏覽器 localStorage、
 * 反思回饋一律使用內建規則（誠實標示，不冒充 AI）。
 */
import { localScenarios } from "@shared/scenarios/index";
import { replay } from "@shared/replay";
import { builtinReflection } from "@shared/builtin";
import type { Scenario } from "@shared/scenario";

export const IS_STATIC =
  (import.meta as { env?: { VITE_STATIC?: string } }).env?.VITE_STATIC === "1";

const STORAGE_KEY = "crossroads:playthroughs";

export interface LocalPlaythrough {
  scenarioId: string;
  signature: string;
  clueIds: string[];
  endingId: string;
  reflectionSource: string;
  reflection: string;
  savedAt: number;
}

function loadRuns(): LocalPlaythrough[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as LocalPlaythrough[];
  } catch {
    return [];
  }
}

function saveRuns(runs: LocalPlaythrough[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

function signatureOf(scenarioId: string, choiceIds: string[], endingId: string): string {
  return JSON.stringify({ scenarioId, choiceIds, endingId });
}

function scenarioById(id: string): Scenario | undefined {
  return localScenarios.find((s) => s.id === id);
}

function runsOf(scenarioId: string): LocalPlaythrough[] {
  return loadRuns().filter((r) => r.scenarioId === scenarioId);
}

/* ---- 與後端 API 同形的本機實作 ---- */

export function localScenarioList() {
  return localScenarios.map((s) => {
    const runs = runsOf(s.id);
    const endings = new Set(runs.map((r) => r.endingId));
    const clues = new Set<string>();
    runs.forEach((r) => r.clueIds.forEach((c) => clues.add(c)));
    return {
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      origin: s.origin,
      brief: s.brief,
      characters: s.characters,
      cluesTotal: s.clues.length,
      endingsTotal: Object.keys(s.endings).length,
      progress: {
        endingsDiscovered: endings.size,
        cluesDiscovered: clues.size,
        totalRuns: runs.length,
      },
    };
  });
}

export function localProgress(scenarioId: string) {
  const s = scenarioById(scenarioId);
  if (!s) throw new Error("找不到這個情境");
  const runs = runsOf(scenarioId);
  const endings = new Set(runs.map((r) => r.endingId));
  const clues = new Set<string>();
  runs.forEach((r) => r.clueIds.forEach((c) => clues.add(c)));
  return {
    endingsDiscovered: [...endings],
    cluesDiscovered: [...clues],
    totalRuns: runs.length,
    endingsTotal: Object.keys(s.endings).length,
    cluesTotal: s.clues.length,
  };
}

export function localRun(scenarioId: string, choiceIds: string[]) {
  const scenario = scenarioById(scenarioId);
  if (!scenario) throw new Error("找不到這個情境");
  const result = replay(scenario, choiceIds);
  if (!result) throw new Error("這組選擇無法走完整輪（路徑不合法）");

  const { path, clueIds, endingId } = result;
  const sig = signatureOf(scenarioId, choiceIds, endingId);

  const reflection = builtinReflection(scenario, path, clueIds, endingId);
  const reflectionText = JSON.stringify(reflection);

  // 儲存遊玩紀錄（每次完成都記一筆，發現數由集合去重；上限 500 筆避免無限成長）
  const runs = loadRuns();
  runs.push({
    scenarioId,
    signature: sig,
    clueIds,
    endingId,
    reflectionSource: "builtin",
    reflection: reflectionText,
    savedAt: Date.now(),
  });
  if (runs.length > 500) runs.splice(0, runs.length - 500);
  saveRuns(runs);

  return { source: "builtin" as const, ...reflection };
}

export function localQuota() {
  // 靜態版沒有 AI 通道；回傳「不可用」讓前端隱藏相關功能
  return {
    available: false,
    generationRemaining: 0,
    reflectionRemaining: 0,
    limits: {
      reflection: { limit: 0, label: "反思回饋" },
      generation: { limit: 0, label: "情境生成" },
    },
  };
}

export function localGet(url: string): unknown {
  const listMatch = url.match(/^\/api\/scenarios$/);
  if (listMatch) return localScenarioList();

  const oneMatch = url.match(/^\/api\/scenarios\/([^/]+)$/);
  if (oneMatch) {
    const s = scenarioById(oneMatch[1]);
    if (!s) throw new Error("找不到這個情境");
    return s;
  }

  const progressMatch = url.match(/^\/api\/scenarios\/([^/]+)\/progress$/);
  if (progressMatch) return localProgress(progressMatch[1]);

  if (url === "/api/ai/quota") return localQuota();

  throw new Error(`靜態版不支援：${url}`);
}

export function localPost(url: string, data: unknown): unknown {
  if (url === "/api/run") {
    const body = data as { scenarioId: string; choiceIds: string[] };
    return localRun(body.scenarioId, body.choiceIds);
  }
  throw new Error(`靜態版不支援：${url}`);
}
