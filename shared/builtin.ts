import type { Scenario, Clue } from "./scenario";

export interface ReflectionOutput {
  summary: string;
  questions: string[];
}

export interface PathStep {
  nodeId: string;
  choiceId: string;
  choiceLabel: string;
}

/**
 * 規則式回饋（fallback）。
 * 明確標示為「系統內建」，不冒充即時 AI。
 * 通用版：只描述本輪實際的選擇與線索組成，不套用特定情境的詮釋，
 * 不評判、不洩漏未發現線索。
 */
export function builtinReflection(
  scenario: Scenario,
  path: PathStep[],
  clueIds: string[],
  endingId: string
): ReflectionOutput {
  const firstChoice = path[0]?.choiceLabel ?? "第一個選擇";
  const clueMap = new Map<string, Clue>(scenario.clues.map((c) => [c.id, c]));
  const clues = clueIds.map((id) => clueMap.get(id)!).filter(Boolean);
  const facts = clues.filter((c) => c.kind === "fact").length;
  const claims = clues.filter((c) => c.kind === "claim").length;
  const ending = scenario.endings[endingId];

  const summary = `這一輪，你從「${firstChoice}」開始，經過 ${Math.max(
    path.length,
    1
  )} 個選擇，發現了 ${clues.length} 條線索（事實 ${facts}、說法 ${claims}），抵達結局「${
    ending?.title ?? endingId
  }」。`;

  const questions: string[] = [
    `「${firstChoice}」——回頭看，這個選擇接近你平常的樣子嗎？`,
  ];

  // 依線索組成的提問
  if (facts > 0 && claims > 0) {
    questions.push("你同時看到了事實與某個人的說法。兩者之間的落差，你怎麼理解？");
  } else if (claims > 0 && facts === 0) {
    questions.push("你聽到的是某個人的說法。你平常怎麼分辨說法與事實？");
  } else if (facts > 0 && claims === 0) {
    questions.push("你看到的線索都是客觀事實。事實之外的「說法」，你通常怎麼取得？");
  }

  if (clues.length <= 2) {
    questions.push("這一輪你發現的線索不多。哪個環節，你想看得更清楚一點？");
  } else {
    questions.push("哪一條線索，最改變了你對這件事的理解？");
  }

  return { summary, questions: questions.slice(0, 3) };
}
