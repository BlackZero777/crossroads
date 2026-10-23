# 岔路｜人生選擇體驗

一個小型的人生選擇體驗系統：玩家的選擇會真的改變故事走向、同一件事隨著發現的線索而有不同理解、不評判玩家，AI 負責結局後的反思回饋與新情境撰寫。

內建兩個情境：

| 情境 | 來源 | 規模 |
|---|---|---|
| 《打烊前十分鐘》 | 作者撰寫 | 12 節點、3 路線、9 線索、12 結局 |
| 《停電那晚》 | AI 生成（已匯出為固定資料） | 13 節點、9 線索、8 結局 |

## 兩種運行模式

### 1. 靜態版（GitHub Pages，推薦入門）

純前端網站，不需要任何伺服器：

- 情境直接打包進網頁
- 遊玩紀錄存在**你自己的瀏覽器**（localStorage），探索地圖顯示個人的發現紀錄
- 結局後的反思回饋由**系統內建規則**即時產生（頁面如實標示，不冒充 AI）
- AI 生成新情境的功能需要後端，靜態版不提供

部署到 GitHub Pages 的步驟：

1. 把這個 repo 推到（或上傳到）你的 GitHub 帳號
   - 如果用上傳的：**先把 zip 解壓縮**，把解開的檔案（不是 zip 本身）上傳到儲存庫根目錄
   - 注意隱藏資料夾 `.github/` 一定要上傳（部署流程藏在裡面），
     如果用網頁拖拽方式上傳，先在作業系統顯示隱藏檔案
2. 進入 repo 頁面 → **Settings** → 左側 **Pages**
3. **Build and deployment** 的 **Source** 選 **GitHub Actions**
4. 到 **Actions** 分頁，選「Deploy to GitHub Pages」工作流程，手動按 **Run workflow**
   執行一次（首次上傳後不會自動觸發）
5. 完成。之後每次推送到 `main`，Actions 會自動建置並發布到
   `https://<你的帳號>.github.io/<repo名稱>/`

注意：GitHub Pages 對公開儲存庫（public）免費；私人儲存庫（private）
需要付費方案才開放 Pages。若不確定，建立儲存庫時選 public 即可。

在本機預覽靜態版：

```bash
npm install
npm run build:static
# 用任何靜態伺服器開啟 dist/public，例如：
npx serve dist/public
```

### 2. 完整版（需要 Node.js 主機）

含後端伺服器的完整功能：

- AI 反思回饋（Claude Haiku，每局結尾最多 1 次，快取共用）
- AI 情境生成（Claude Sonnet，主動觸發，每小時全站上限 10 次）
- 全站累積的探索地圖（SQLite 儲存）
- 額度控制與併發防護

```bash
npm install
npm run build
npm start        # NODE_ENV=production node dist/index.cjs，預設埠 5000
```

開發模式：

```bash
npm run dev      # Vite HMR + tsx 伺服器
```

AI 功能需要環境變數 `ANTHROPIC_API_KEY`（見 `.env.example`）。
沒有金鑰時程式會自動退回內建規則回饋並如實標示，網站仍可完整遊玩。

## 專案結構

```
shared/            前後端共用
  scenario.ts      情境資料結構與結構驗證
  replay.ts        選擇序列重放（推導路徑／線索／結局）
  builtin.ts       規則式反思回饋（fallback）
  scenarios/       情境資料（含 AI 生成情境的匯出）
client/            React 前端（Vite）
  lib/staticApi.ts 靜態版本機資料層
server/            Express 後端（AI 回饋、情境生成、額度控制）
script/            建置腳本（build.ts 全端版／build-static.ts 靜態版）
```

## 設計原則

- **選擇與分支**：三條路線接觸不同的人、做不同的事、走向不同的後果
- **隱藏資訊**：9 條線索分散在 3 條路線，任何一輪最多看到 3 條
- **不評判**：沒有分數與善良值，每個結局都是真實的後果
- **誠實標示**：內建回饋不冒充 AI；AI 看不到玩家未發現的線索

《打烊前十分鐘》的完整節點劇本（有劇透）見 `節點地圖-打烊前十分鐘.md`。
