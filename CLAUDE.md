# CLAUDE.md — 福大自然家教管理系統 專案記憶

給 Claude 的導覽：**先讀這裡定位，再用 Grep 搜尋「錨點名稱」讀該段落，不要重讀整個大檔**（`teacher.html`、`parent-preview.html` 皆為數萬字壓縮單行檔）。

## 部署與網址
- 正式站（給家長/老師用）：**Vercel** `https://bossfu-tutoring.vercel.app`（`main` 一 push 自動部署）。備援：GitHub Pages `https://boss-fu.github.io/tutoring/`（不讀 `vercel.json`，根目錄永遠是 `index.html`）。
- 路由由 `vercel.json` 控制：`/`→`/home`（選擇頁）；`/teacher`、`/parent`、`/parents`。
- 開發分支固定：`claude/through-this-5f7djl`。PR 合併進 `main` 才會上線。

## 檔案角色
- `home.html`：進站身分選擇頁（自包含、含 PWA/iOS standalone 標記 + `home.webmanifest`）。**不要外部載入 JS/CSS**（避免踩版本一致性測試）。
- `index.html`：個人班表引擎；被 `teacher.html` 以 iframe (`?embed=teacher`) 嵌入。**勿刪、勿改成別的頁**。
- `teacher.html`：教師端（DB 版）。單檔多個 `<script type="module">`，各自建 `window.BOSSFU_DB`。
- `parent.html`：家長端登入外殼，登入後 iframe 嵌 `parent-preview.html`。
- `parent-preview.html`：家長端**實際內容**（月曆/課務/學費單/親師溝通/檔案中心），也被教師端「家長端預覽」嵌用。
- `theme.css`：共用設計主題（品牌色 `--tzu-red:#850103`）。
- `supabase-config.js`：`window.SUPABASE_CONFIG`（url + publishable key）。

## 關鍵錨點（用 Grep 搜這些名字）
- 月曆配色（教師）：`COURSE_PALETTE` / `courseColorFor` / `eventStyle` / `renderCalendarLegend`（teacher.html）。12 色，不同課程配不同色。
- 月曆配色（家長）：`window.bossfuCourseColor` / `keyColor` / `recolor` / `renderCalLegend`（parent-preview.html，共用同一組）。
- 學費單開立：教師端 `issueInvoices` / `#issueInvoice`；家長端 `loadIssuedMonths` / `renderInvoices`（近 6 個月，未開立顯示「老師尚未開立」）。
- 家長隱私隔離：所有 `messages`/`student_files` 寫入都帶 `parent_id`；教師傳檔前選「指定家長」(`#fileParent` / `populateParents`)；教師預覽送訊息帶 `parentId`（`BossfuPreviewParent` → postMessage → `window.__bossfuPreviewParentId`）；教師端「清空未指定家長的舊資料」= `#purgeLegacy`。
- 教師檔案中心：`addTeacherFileCenter` / `#fileStudent`（學生清單從 `#workStudent` 複製，會重試填充）。
- 教師通知鈴鐺：`refreshBell`；家長通知：`startParentBell` / `enableTabNotices`。
- **分頁整併（重要）**：教師端已無獨立「兼職薪資」「收入分析」分頁。導覽只剩 首頁／課次與月曆／學生課務／檔案中心／學費與收入／學習狀況／家長端預覽／個人課表／新增·管理行程。
  - **首頁（`#home` / `renderHome`）**：儀表板指標 + **今天課程**（`#todayLessons`，當日家教課次＋兼職班次）+ 收入分析圖表（`#incomeTrend` 近12月堆疊、`#studentDonut` 學生占比、`#incomeSplit` 收入結構、`#incomeByEmployer` 各補習班兼職）。原「近六個月收入」`#incomeChart` 已移除，改由 12 個月趨勢取代。
  - **學費與收入（`#finance` / `renderFinance`）**：家教學費彙總 + 併入兼職（`#employerForm`/`#shiftForm`/薪資對帳單 `#statementEmployer`·`#statementMonth`·`#printStatement`）與正職薪資（Gemini 卡片）與 `#incomeStatMetrics`。
- 兼職薪資：`wLoad` / `wRender` / `wRenderStatement`（對帳單：應領薪資 − 勞保自付 − 健保自付 = 實領＋核章欄）。資料表 `employers`(含 `default_rate`/`labor_insurance`/`health_insurance`)、`work_shifts`。UI 卡片現位於學費與收入分頁。
- 收入分析：`renderIncomeStats`（家教＋兼職＋正職三來源；helper `shiftFee`=兼職毛額、`salaryFee`=正職實領）。填的元素散在首頁（趨勢/占比/結構/各補習班）與學費頁（`#incomeStatMetrics`），全部以 `if($(...))` 防呆。
- 正職薪資單分析（Gemini，UI 在學費與收入分頁，程式為 teacher.html 尾端獨立 module）：上傳薪資單 PDF → 用使用者自己的 Gemini API（`generativelanguage.googleapis.com/.../{model}:generateContent`，`inline_data` 傳 base64 PDF）判讀「實領」→ regex `實領=數字` 自動填 `#salaryAmount` →「存本月正職收入」寫進 `site_settings` key `salary_income`（JSON `{月份:金額}`，`onConflict:'key'`）。金鑰/模型只存 localStorage（`bossfu-gemini-key`/`bossfu-gemini-model`，預設 `gemini-2.5-flash`）。月份取自 `window.BOSSFU_SHOWN_MONTH()`；存完呼叫 `window.BOSSFU_RELOAD()`。主模組 `salaryMap`＋`salaryFee` 讀此值。
- 月曆拖曳／複製：teacher.html 尾端模組 `mMove`(搬移) / `mCopy`(複製)；月曆格帶 `data-date`、課次事件 `draggable`；主模組重載入口 `window.BOSSFU_RELOAD`（兼職/拖曳更動後連動刷新）。
- 推播通知：`pwa.js` 的 `subscribePush` / `window.bossfuPush(ids,…)` / `bossfuPushRole('teacher',…)`；Edge Function `supabase/functions/send-push`（用 VAPID 密鑰）；`sw.js` 的 push/notificationclick。觸發點：開立學費單、老師傳檔/回饋、家長回饋。

## Supabase 資料表（線上實際）
`profiles`(role: teacher/parent)、`students`、`parent_students`(多對多)、`lessons`、`messages`(有 `author_role`、`parent_id`)、`student_files`(有 `uploader_id`、`parent_id`)、`issued_invoices`(student_id, month, PK)、`site_settings`(key/value，如 `finance_profile`、`salary_income`＝正職各月實領 JSON)、`employers`(兼職單位；`default_rate`/`labor_insurance`/`health_insurance`)、`work_shifts`(兼職班次；`employer_id`/`work_date`/`hours`/`rate`)、`push_subscriptions`(user_id/endpoint/p256dh/auth，推播訂閱)。Storage bucket：`exam-papers`（上傳已移除前端 10MB 限制；Storage 端仍有預設上限）。
- RLS 輔助函式：`is_teacher()`、`can_view_student(uuid)`。
- 隱私隔離用 **restrictive** policy：`isolate parent messages` / `isolate parent files`（非老師只能 select `parent_id = auth.uid()`）。
- **DDL 只能由使用者在 Supabase SQL Editor 執行**（環境無 DB 憑證）。改 schema 時要寫「可重複執行」的 SQL（`if not exists` / `drop policy if exists`）。

## 慣例 / 部署前
- 改任何被 `?v=` 載入的子資源（js/css/被 iframe 的 html）後，跑 `python3 bump-version.py` 統一版本號（測試 `cache-bust` 會檢查一致）。頂層 HTML 文件本身改動不需 bump。
- 測試：`npm test`（含 cache-bust / boot / pages / preview / parent 等）。改行為時記得同步更新對應測試的 DB stub。
- 只推 `claude/through-this-5f7djl`；PR 合併進 `main`。原 PR 合併後，follow-up 要從最新 `main` 重開同名分支（`git checkout -B ... origin/main`），force-with-lease 推。

## 已完成的大功能（歷史）
- F 兼職薪資＋可蓋章薪資對帳單、勞健保自付額扣除、收入分析、月曆拖曳/複製課次、家長隱私隔離、學費單開立、推播通知（`send-push` 已部署、VAPID 密鑰已設）皆已上線。
- 正職收入（Gemini 讀薪資單）已上線；分頁整併：收入分析移入首頁、兼職＋正職併入「學費與收入」、首頁加「今天課程」，刪除獨立的兼職薪資／收入分析分頁。

## 慣例：更新此檔
- **每次新增功能或結構性改動，都要同步更新本 `CLAUDE.md`**（錨點／資料表／待辦），隨 PR 一起合併。

## 待辦（未完成）
- （目前無）正職收入已改用「上傳薪資單 PDF＋Gemini 判讀實領」完成（HR 系統無 API，不連動）。
