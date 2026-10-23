import { closingTen } from "./closingTen";
import { blackoutNight } from "./blackoutNight";
import type { Scenario } from "../scenario";

/** 靜態版使用的全部情境（打包進網頁，不需要後端） */
export const localScenarios: Scenario[] = [closingTen, blackoutNight];
