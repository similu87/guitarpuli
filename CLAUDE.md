# 吉他普利 Guitarpuli — 給 Claude 的工作說明

## 跟使用者合作的方式
- **一律用繁體中文回覆**，包括進度回報、摘要、提問。
- 使用者**沒有程式背景**：用白話說明，指令由 Claude 自己執行，不要叫使用者打指令；真的需要使用者動手（按按鈕、登入）時，一步一步講清楚。
- **改東西前先講要改什麼、等使用者同意**。例外：譜面上明顯的固定格式錯誤直接修（見「打譜規則」）。
- 會用掉額度、有次數上限或可能被暫停的動作（Cloudflare 建置、Supabase、寄信等），**動手前先說**。
- 任何網站版本更新／上傳前，**先問「現在更新，還是跟其他歌／修改一起上」**；使用者說「直接上架」時就不再問時機。

## 網站基本資料
- 網站：https://guitarpuli.pages.dev（Cloudflare Pages）。main 有新提交就自動建置（`npm run build` → `public/`）。
- GitHub：similu87/guitarpuli（main 分支）。
- 後台：/admin/（Decap CMS，只做臨時修正；主要來源是 Obsidian）。
- 會員與數據：Supabase 專案 guitarpuli（`supabase.sql`、`supabase-stats.sql`）。
- 管理者帳號：similu87@gmail.com、pulipapa5986@gmail.com。
- 品牌帳號 pulipapa：IG instagram.com/pulipapa5986、YouTube @pulipapa5986、信箱 pulipapa5986@gmail.com。

## 檔案結構
- `songs/<url_id>.md`：一首歌一個檔，開頭屬性欄位，內文和弦譜。
- `build.mjs`：把 songs/ 轉成 songs.json、歌曲頁、sitemap、404，並把 `changelog.md` 轉成 changelog.json；格式錯誤會讓建置失敗並指出檔案和行數。
- `og.mjs`：分享預覽圖與手機圖示。
- `public/index.html`：網站本體；預設指法圖在 `const SHAPES={...}`（`'和弦名':'6弦→1弦'`）。
- `changelog.md`：更新紀錄，格式 `## vX.Y.Z · YYYY-MM-DD`，底下 `### 網站`、`### 新增歌曲`（每行一個 url_id）。
- `.gitignore` 裡列的產生檔不要提交。本機測試：`npm install` 後 `node build.mjs`。

## Obsidian 筆記（樂譜的主要來源）
- 筆記庫在 Google 雲端硬碟同步。Mac：`~/Library/CloudStorage/GoogleDrive-similu87@gmail.com/我的雲端硬碟/Obsidian筆記資料庫`；Windows：`G:\我的雲端硬碟\Obsidian筆記資料庫`。
- 歌曲筆記在 `Reference Tracks/`（檔名「歌手 - 歌名」）；已上架的搬到 `Reference Tracks/吉他普利已上架/`。讀寫時兩個資料夾都要找。
- **`Reference Tracks/打譜必讀事項` 是規則本**：使用者只改這份；Claude 建筆記、整理譜、改網站選項都照它。規則改了要同步到網站。
- 雲端硬碟曾經把筆記蓋回舊版（另一台電腦的 Obsidian 存回舊內容）：寫入前確認內容是最新的，寫入後隔一陣子再檢查。
- 筆記屬性只能有這些欄位，依序：artist, key, capo, bpm, meter, feel, genre, level, language, strum, strum_note, url_id, tempo, mood, vocal, instrumentation, gp_publish，另外有 tuning、capo_use、video。每首都要有 url_id。
- 新筆記的「## 吉他譜」先填打譜必讀事項裡的範例譜；每首的按法寫在筆記最後的 `## 指法`。

## 加歌與上傳流程
1. 使用者照完整歌曲順序打譜（順序留空），打完說一聲。
2. Claude 整理：一樣的段落合併、不同處用「第N次」／「末次」，填上 `### 順序`；有疑問就問。段落寫 A／B／C（主歌A、副歌B）的**照原樣**，不要改名或合併。
3. 轉成 `songs/<url_id>.md`：title、artist 從檔名；meter→time；tuning 只在非標準調弦時寫；capo_use 為 true 才寫；### 改 ##；`## 指法` 原樣帶上。
4. **檢查缺指法圖**：網站沒有圖的和弦一定要向使用者要按法，**絕不自己編**。每次版本更新都要做這項檢查。
5. `node build.mjs` 測過才提交。
6. 一批（約 10 首＋網站修改）只建置一次：除了最後一個提交，其他提交說明都加 `[CF-Pages-Skip]`。
7. 同時更新 `changelog.md`：只寫網站使用者需要知道的事，管理者功能不寫。版本號：大改版加 X、新功能加 Y、修小問題或加歌加 Z。
8. 上線後把整理好的譜寫回 `吉他普利已上架` 的筆記，備註加「YYYY-MM-DD 上架 vX.Y.Z」。
9. **新增歌曲累積滿 8 首才做一次** IG＋Threads 公告圖和文案（這部分在 claude.ai 的「吉他普利」專案做）。不到 8 首可以先上傳網站、不做公告，等累積滿 8 首再一起公告（2026-11-21 使用者決定）。

## 打譜規則重點（完整版看打譜必讀事項）
- 和弦一律寫**實際音高**，Capo 另外設定；網站預設顯示夾 Capo 後的指型名稱，「實音」切換顯示實際音高。capo_use 的歌預設顯示實際音高。
- Capo 按法寫成 `F7/A（Capo 3）＝2x453x`（格數從 Capo 算）。非標準調弦的歌，按法是該調弦下的格數。
- 斜線和弦的指法圖一定要畫出低音。
- △ 單獨＝大三和弦（G△＝G）；△7/△9/△11/△13＝maj7/maj9/maj11/maj13。半減七顯示 ø。和弦名後加 `*` 表示同名不同按法。搥／勾弦和弦用顏色標示。
- 每個和弦和每個 `-` 各佔一格，整小節平均分；`Bm----A--` 是八分音符；`A 2拍` → `2/4 A`；`空拍` → NC。
- 手寫譜標「key: X→Y」一律用前面的 X，不是轉調。
- 直接修、不用問的格式錯誤：順序的 `-` 改 `→`、`主歌 2次` → `主歌 ×2`、黏在一起的 `-` 拆開、依調號統一升降記號（Dm7-5→Dm7♭5、G#sus2→A♭sus2 等）、標題多的空格、小節裡的指法搬到 `## 指法`。
- 公開譜只放和弦、段落、律動與刷法；歌詞只存在使用者自己的帳號，不公開。

## 免費方案限制
- Cloudflare Pages：每月 500 次建置（整個帳號共用）、單次 20 分鐘、每站 20,000 個檔案。
- Supabase 免費：一週沒活動會被暫停；內建寄信每小時只能寄 2 封。

## 其他資料
- 待辦、設計決策、交接紀錄在 claude.ai「吉他普利」專案的文件裡（這裡讀不到）；需要時請使用者貼過來，或問使用者。
