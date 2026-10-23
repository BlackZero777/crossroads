import type { Scenario } from "./scenario";

export interface PathStep {
  nodeId: string;
  choiceId: string;
  choiceLabel: string;
}

export interface ReplayResult {
  path: PathStep[];
  clueIds: string[];
  endingId: string;
}

/**
 * 伺服器端與靜態版共用的路徑重放：
 * 依選擇序列走過情境，推導出實際經過的節點、發現的線索與結局。
 * 選擇序列必須恰好走到結局——結局後還有剩餘選項視為不合法。
 */
export function replay(scenario: Scenario, choiceIds: string[]): ReplayResult | null {
  let nodeId = scenario.start;
  const startNode = scenario.nodes[nodeId];
  if (!startNode) return null;

  const clueIds = new Set<string>(startNode.clues ?? []);
  const path: PathStep[] = [];

  for (let i = 0; i < choiceIds.length; i++) {
    const node = scenario.nodes[nodeId];
    if (!node) return null;
    const choice = node.choices?.find((c) => c.id === choiceIds[i]);
    if (!choice) return null;
    path.push({ nodeId, choiceId: choiceIds[i], choiceLabel: choice.label });

    const target = scenario.nodes[choice.next];
    if (target) {
      (target.clues ?? []).forEach((c) => clueIds.add(c));
      if (target.endingId) {
        // 抵達結局後，所有輸入的選項必須恰好用完
        if (i !== choiceIds.length - 1) return null;
        return {
          path,
          clueIds: [...clueIds],
          endingId: target.endingId,
        };
      }
      nodeId = choice.next;
    } else if (scenario.endings[choice.next]) {
      // 選項直接指向結局：同樣必須是最後一個輸入
      if (i !== choiceIds.length - 1) return null;
      return { path, clueIds: [...clueIds], endingId: choice.next };
    } else {
      return null;
    }
  }
  return null; // 沒有走到結局
}
