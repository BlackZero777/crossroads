import { build as viteBuild } from "vite";
import { rm } from "node:fs/promises";

/**
 * 靜態版建置（GitHub Pages 用）：
 * 只建置前端，情境打包進網頁、紀錄存瀏覽器、回饋用內建規則。
 * VITE_STATIC=1 會讓前端切換到本機資料層（見 client/src/lib/staticApi.ts）。
 */
process.env.VITE_STATIC = "1";

async function buildStatic() {
  await rm("dist/public", { recursive: true, force: true });
  console.log("building static client (VITE_STATIC=1)...");
  await viteBuild();
  console.log("done: dist/public 可直接部署到 GitHub Pages");
}

buildStatic().catch((err) => {
  console.error(err);
  process.exit(1);
});
