import Anthropic from "@anthropic-ai/sdk";

/**
 * 後端 LLM 協助模組。
 * 成本控制：
 * - 反思回饋：每局結尾最多 1 次呼叫，模型 haiku，max_tokens 700，相同路徑快取。
 * - 情境生成：僅在使用者主動觸發時呼叫，模型 sonnet，max_tokens 8000，
 *   全站每小時上限由資料庫紀錄控制（見 routes.ts）。
 */

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function llmAvailable(): boolean {
  // 憑證由 start_server 的 api_credentials 注入環境變數
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_AUTH_TOKEN ||
      process.env.ANTHROPIC_BASE_URL
  );
}

/** 從模型回應中抽出 JSON（容忍 markdown code fence） */
export function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) t = fence[1];
  // 容忍前後雜訊：找到第一個 { 到最後一個 }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

export interface ReflectionInput {
  scenarioTitle: string;
  pathLabels: string[]; // 玩家依序做過的選擇
  steps: { choiceLabel: string; nodeTitle: string; clueLabels: string[] }[]; // 逐步紀錄
  clues: { label: string; text: string; kind: "fact" | "claim" }[]; // 僅限已發現
  endingTitle: string;
  endingText: string[];
}

export interface ReflectionOutput {
  summary: string;
  questions: string[];
}

const REFLECTION_SYSTEM = `你是互動敘事體驗「岔路」的反思引導員。根據玩家這一輪的紀錄，產生個人化的反思回饋。

嚴格規則：
1. 不評判玩家：不使用好/壞/善良/自私/正確等評價詞，不建議「更好的選擇」。
2. 只能引用玩家「已發現」的線索與已發生的情節，不得洩漏或暗示未發現的線索、其他路線或結局的內容。
3. 形式是「描述＋提問」：先用兩三句客觀描述玩家做了什麼、造成了什麼影響，再提出 3 個開放式問題，幫助玩家思考資訊、理解與選擇之間的關係。
4. 繁體中文，語氣平實溫和。summary 不超過 120 字，每個問題不超過 30 字。
5. 只輸出 JSON，格式：{"summary": "...", "questions": ["...", "...", "..."]}`;

export async function generateReflection(
  input: ReflectionInput
): Promise<ReflectionOutput> {
  const clueLines = input.clues
    .map(
      (c) =>
        `- [${c.kind === "fact" ? "事實" : "某人的說法"}] ${c.label}：${c.text}`
    )
    .join("\n");

  const user = `情境：${input.scenarioTitle}

玩家這一輪逐步的紀錄（依時間順序，括號內是進到該場景時揭示的線索）：
${input.steps
  .map(
    (s, i) =>
      `${i + 1}. 選擇「${s.choiceLabel}」→ 進到「${s.nodeTitle}」${
        s.clueLabels.length > 0 ? `（此時才知道：${s.clueLabels.join("、")}）` : ""
      }`
  )
  .join("\n")}

玩家已發現的線索（只有這些，其他線索一律不得提及或暗示）：
${clueLines || "（沒有發現任何線索）"}

玩家抵達的結局「${input.endingTitle}」：
${input.endingText.join("\n")}`;

  const resp = await getClient().messages.create({
    model: "claude_haiku_4_5",
    max_tokens: 700,
    messages: [
      { role: "user", content: `${REFLECTION_SYSTEM}\n\n${user}` },
    ],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const json = extractJson(text) as ReflectionOutput;
  if (
    !json ||
    typeof json.summary !== "string" ||
    !Array.isArray(json.questions) ||
    json.questions.length < 1
  ) {
    throw new Error("反思回饋格式不符");
  }
  return {
    summary: json.summary,
    questions: json.questions.slice(0, 4).map(String),
  };
}

/* ---------- 情境生成（額度由 routes 依資料庫控制） ---------- */

const SCENARIO_SYSTEM = `你是互動敘事「岔路」的情境作家。請產生一個「人生選擇體驗」情境，只輸出純 JSON，不要 markdown code fence，不要任何說明文字。

結構規則（必須完全符合）：
{
  "id": "ai-<小寫英數>",
  "title": "情境標題（6字內）",
  "subtitle": "副標題（12字內）",
  "origin": "ai",
  "brief": ["開場前導，2-4 段，每段一句"],
  "characters": [{"name": "...", "role": "..."}],
  "start": "n0",
  "nodes": {
    "n0": {"id": "n0", "title": "...", "text": ["..."], "clues": [], "choices": [{"id": "a", "label": "...", "next": "n1"}, {"id": "b", "label": "...", "next": "n2"}, {"id": "c", "label": "...", "next": "n3"}]},
    ... 共 12-16 個節點，id 用 n0, n1, n2 ...
  },
  "clues": [{"id": "c1", "label": "...", "text": "...", "kind": "fact 或 claim"}, ... 共 7-9 條],
  "endings": {"e1": {"id": "e1", "title": "...", "text": ["..."]}, ... 共 6-10 個}
}

節點規則：
- 開場節點 n0 必須有 3 個選項，分出三條不同的路線（n1/n2/n3 各自展開）。
- 共 12-14 個節點。每條路線至少 2-3 個節點後收束到結局。
- 每個節點的 text 是 2-3 句話，精煉、有畫面感。不要寫長段。
- 選項的 next 可以指向另一個節點，也可以直接指向結局 id（e1、e2…）。
- 「clues」是進入該節點時揭示的線索 id 陣列。
- 節點沒有後續時，不加 choices。

內容規則：
- 舞台設定在台灣日常（依使用者給的主題），文字精練、有畫面感、避免說教。
- 核心是「同一個事件，不同路線看到不同面向」：每條路線只能看到部分線索，湊在一起才是全貌。
- 線索分兩種：fact（客觀事實）與 claim（某人的說法），必須混雜分配到不同路線。
- 不評判玩家：沒有道德分數、沒有「正確結局」或「壞結局」。每個角色都有自己的難處，每個結局都是真實的後果而非獎懲。
- 繁體中文。`;

export async function generateScenario(
  theme: string,
  previousErrors?: string[]
): Promise<{ raw: string }> {
  let user = `主題：${theme}

請產生情境 JSON。記住：只輸出 JSON。`;
  if (previousErrors && previousErrors.length > 0) {
    user = `主題：${theme}

你上一次的輸出沒有完全符合規格，有這些問題：
${previousErrors
      .slice(0, 10)
      .map((e) => `- ${e}`)
      .join("\n")}

麻煩重新輸出完整的情境 JSON，這次務必嚴格遵守規格：頂層鍵只能是 id、title、subtitle、origin、brief、characters、start、nodes、clues、endings，不要自己發明其他結構。記住：只輸出 JSON。`;
  }

  const resp = await getClient().messages.create({
    model: "claude_sonnet_5_5",
    max_tokens: 8000,
    system: SCENARIO_SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  return { raw: text };
}
