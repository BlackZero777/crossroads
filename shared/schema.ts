import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";

/** AI 產生的情境（通過驗證後存檔，成為「情境圖書館」） */
export const aiScenarios = sqliteTable("ai_scenarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scenarioId: text("scenario_id").notNull().unique(),
  theme: text("theme").notNull(),
  data: text("data").notNull(), // 完整情境 JSON
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** AI 呼叫額度紀錄（落庫，重啟不歸零） */
export const aiUsage = sqliteTable("ai_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(), // "reflection" | "generation"
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** 每一次走完整輪的遊玩紀錄（跨輪探索地圖的資料來源） */
export const playthroughs = sqliteTable("playthroughs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scenarioId: text("scenario_id").notNull(),
  /** 路徑簽名：路徑＋線索＋結局的雜湊，用於反思回饋快取 */
  signature: text("signature").notNull(),
  path: text("path").notNull(), // JSON: [{nodeId, choiceId, choiceLabel}]
  clueIds: text("clue_ids").notNull(), // JSON: string[]
  endingId: text("ending_id").notNull(),
  reflectionSource: text("reflection_source").notNull(), // "ai" | "builtin"
  reflection: text("reflection").notNull(), // JSON: {summary, questions[]}
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertAiScenarioSchema = createInsertSchema(aiScenarios).pick({
  scenarioId: true,
  theme: true,
  data: true,
});

export const insertPlaythroughSchema = createInsertSchema(playthroughs).pick({
  scenarioId: true,
  signature: true,
  path: true,
  clueIds: true,
  endingId: true,
  reflectionSource: true,
  reflection: true,
});
