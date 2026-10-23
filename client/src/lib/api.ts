import type { Scenario } from "@shared/scenario";

export interface ScenarioSummaryDTO {
  id: string;
  title: string;
  subtitle: string;
  origin: "authored" | "ai";
  brief: string[];
  characters: { name: string; role: string }[];
  cluesTotal: number;
  endingsTotal: number;
  progress: {
    endingsDiscovered: number;
    cluesDiscovered: number;
    totalRuns: number;
  };
}

export interface ProgressDTO {
  endingsDiscovered: string[];
  cluesDiscovered: string[];
  totalRuns: number;
  endingsTotal: number;
  cluesTotal: number;
}

export interface PathStepDTO {
  nodeId: string;
  choiceId: string;
  choiceLabel: string;
}

export interface RunResponseDTO {
  source: "ai" | "builtin";
  summary: string;
  questions: string[];
}

export interface QuotaDTO {
  available: boolean;
  generationRemaining: number;
  limitPerHour: number;
}

export type { Scenario };
