import { z } from "zod";

/** 線索種類：fact = 客觀事實，claim = 某人的說法 */
export type ClueKind = "fact" | "claim";

export interface Clue {
  id: string;
  label: string;
  text: string;
  kind: ClueKind;
}

export interface Choice {
  id: string;
  label: string;
  next: string;
}

export interface StoryNode {
  id: string;
  title: string;
  text: string[];
  /** 進入此節點時揭示的線索 id */
  clues?: string[];
  choices?: Choice[];
  /** 若為結局節點，指向 endings 裡的結局 id */
  endingId?: string;
}

export interface Ending {
  id: string;
  title: string;
  text: string[];
}

export interface Character {
  name: string;
  role: string;
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  origin: "authored" | "ai";
  brief: string[];
  characters: Character[];
  start: string;
  nodes: Record<string, StoryNode>;
  clues: Clue[];
  endings: Record<string, Ending>;
}

/* ---------- Zod schema：用於驗證 AI 產生的情境 ---------- */

const clueSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(["fact", "claim"]),
});

const choiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  next: z.string().min(1),
});

const nodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.array(z.string().min(1)).min(1),
  clues: z.array(z.string()).optional(),
  choices: z.array(choiceSchema).min(1).optional(),
  endingId: z.string().optional(),
});

const endingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.array(z.string().min(1)).min(1),
});

export const scenarioSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "id 僅限小寫英數與連字號"),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  origin: z.literal("ai"),
  brief: z.array(z.string()).min(1),
  characters: z.array(z.object({ name: z.string(), role: z.string() })),
  start: z.string().min(1),
  nodes: z.record(z.string(), nodeSchema),
  clues: z.array(clueSchema),
  endings: z.record(z.string(), endingSchema),
});

export interface ValidationResult {
  ok: boolean;
  scenario?: Scenario;
  errors: string[];
}

/** 結構驗證：節點參照、結局參照、線索參照是否都可解析 */
export function validateScenario(input: unknown): ValidationResult {
  const errors: string[] = [];

  // 先剝掉可能的 markdown code fence
  if (typeof input === "string") {
    const cleaned = input
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "");
    try {
      input = JSON.parse(cleaned);
    } catch (e) {
      return { ok: false, errors: ["JSON 解析失敗"] };
    }
  }

  const parsed = scenarioSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`
      ),
    };
  }

  const s = parsed.data as unknown as Scenario;

  if (!s.nodes[s.start]) errors.push(`start 節點不存在：${s.start}`);

  const clueIds = new Set(s.clues.map((c) => c.id));
  const endingIds = new Set(Object.keys(s.endings));
  const referencedClues = new Set<string>();
  const reachableEndings = new Set<string>();

  for (const [key, node] of Object.entries(s.nodes)) {
    if (key !== node.id) errors.push(`節點鍵 ${key} 與節點 id ${node.id} 不一致`);
    if (node.endingId && node.choices && node.choices.length > 0) {
      errors.push(`節點 ${node.id} 同時有 choices 與 endingId`);
    }
    if (!node.endingId && !node.choices) {
      errors.push(`節點 ${node.id} 沒有 choices 也沒有 endingId（死路）`);
    }
    if (node.choices && node.choices.length === 0) {
      errors.push(`節點 ${node.id} 的 choices 是空陣列`);
    }
    for (const c of node.choices ?? []) {
      // 選項可以指向節點，也可以直接指向結局
      if (!s.nodes[c.next] && !endingIds.has(c.next)) {
        errors.push(`節點 ${node.id} 的選項指向不存在的節點或結局 ${c.next}`);
      }
    }
    for (const cid of node.clues ?? []) {
      if (!clueIds.has(cid)) errors.push(`節點 ${node.id} 引用不存在的線索 ${cid}`);
      referencedClues.add(cid);
    }
    if (node.endingId && !endingIds.has(node.endingId)) {
      errors.push(`節點 ${node.id} 指向不存在的結局 ${node.endingId}`);
    }
  }

  const reachable = new Set<string>();
  const walk = (id: string) => {
    if (reachable.has(id)) return;
    const n = s.nodes[id];
    if (!n) return;
    reachable.add(id);
    if (n.endingId) reachableEndings.add(n.endingId);
    for (const c of n.choices ?? []) {
      if (endingIds.has(c.next)) reachableEndings.add(c.next);
      walk(c.next);
    }
  };
  walk(s.start);

  // 所有結局都必須可從起點抵達
  for (const eid of Object.keys(s.endings)) {
    if (!reachableEndings.has(eid)) errors.push(`結局 ${eid} 無法從起點抵達`);
  }

  // 所有線索都必須在某個節點被揭示
  for (const cid of clueIds) {
    if (!referencedClues.has(cid)) errors.push(`線索 ${cid} 沒有被任何節點揭示`);
  }

  for (const id of Object.keys(s.nodes)) {
    if (!reachable.has(id)) errors.push(`節點 ${id} 無法從起點抵達`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, scenario: s, errors: [] };
}
