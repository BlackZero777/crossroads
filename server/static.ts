import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // 巢狀路由（如 /play/closing-ten）重新載入時，相對路徑資源會請求
  // /play/assets/…；這裡重寫回 /assets/…，避免 SPA fallback 把 index.html
  // 當成 JS 回給瀏覽器。
  app.use((req, res, next) => {
    const m = req.path.match(/^\/[^/]+\/assets\/(.+)$/);
    if (m) {
      const candidate = path.join(distPath, "assets", path.normalize(m[1]).replace(/^\.\./, ""));
      if (candidate.startsWith(path.join(distPath, "assets")) && fs.existsSync(candidate)) {
        return res.sendFile(candidate);
      }
    }
    next();
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
