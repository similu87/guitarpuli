# 吉他普利 Guitarpuli

可以移調、夾 Capo 的吉他和弦譜網站。每一首歌是 `songs/` 資料夾裡的一個 `.md` 檔。網站上線時會自動把這些檔案轉成 `public/songs.json`，網頁再讀取這個檔案顯示樂譜。

```
songs/            ← 樂譜檔，一首歌一個 .md
templates/        ← Obsidian 新歌範本
public/index.html ← 網站本體
public/admin/     ← 網頁後台（Decap CMS）
build.mjs         ← 把 songs/ 轉成 songs.json，格式有錯會擋下來並告訴你哪一行
netlify.toml      ← Netlify 部署設定
```

---

## 一、第一次上線（只做一次，約 30 分鐘）

### 1. 建立 GitHub 帳號和儲存庫
1. 到 https://github.com 註冊帳號。
2. 右上角「+」→ **New repository**，名稱填 `guitarpuli`，選 **Private** 或 **Public** 都可以，按 **Create repository**。
3. 在新儲存庫頁面點 **uploading an existing file**，把這個資料夾裡的所有檔案和資料夾拖進去（`node_modules` 不用拖），按 **Commit changes**。

### 2. 修改後台設定
在 GitHub 上打開 `public/admin/config.yml`，按鉛筆圖示編輯，把
```
repo: YOUR-GITHUB-NAME/guitarpuli
```
改成你的帳號，例如 `repo: similu/guitarpuli`，然後 Commit。

### 3. 用 Netlify 免費架站
1. 到 https://app.netlify.com 用 GitHub 帳號登入。
2. **Add new project → Import an existing project → GitHub**，選 `guitarpuli`。
3. 設定會自動從 `netlify.toml` 讀取（Build command `npm run build`、Publish directory `public`），直接按 **Deploy**。
4. 一兩分鐘後會得到一個網址，例如 `guitarpuli.netlify.app`。可以在 **Domain management** 改名或綁定自己買的網域。

### 4. 開通網頁後台登入
後台用你的 GitHub 帳號登入，需要建立一個 GitHub OAuth App：
1. GitHub 右上角頭像 → **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Application name：`Guitarpuli CMS`
   - Homepage URL：你的網站網址
   - Authorization callback URL：`https://api.netlify.com/auth/done`
2. 建立後複製 **Client ID**，再按 **Generate a new client secret** 複製 Secret。
3. 回到 Netlify 你的網站 → **Project configuration → Access & security → OAuth → Install provider → GitHub**，貼上 Client ID 和 Secret。
4. 打開 `你的網址/admin/`，按「Login with GitHub」就能進後台。

---

## 二、新增樂譜：網頁後台

1. 打開 `你的網址/admin/` 並登入。
2. 點 **樂譜 → 新增樂譜**，依序填欄位：
   - **網址代稱**：小寫英文、數字和 `-`，例如 `rocket-88`。這會變成網址 `#song-rocket-88`，之後不要改。
   - **原調**：寫歌曲實際的調性（實際音高）。
   - **建議 Capo**：讀者第一次打開時自動套用的夾法。和弦譜仍然寫實際音高，網站會自動換成指型。
   - **律動、刷法、難度、曲風、上架日期**
   - **和弦譜**：格式見下方「三、和弦譜寫法」。
3. 按 **發布**。大約 1 分鐘後網站就會更新。

## 二之二、新增樂譜：Obsidian

1. 安裝 **GitHub Desktop**（https://desktop.github.com），登入後 **Clone** 你的 `guitarpuli` 儲存庫到電腦上。
2. 在 Obsidian 選 **開啟資料夾作為 Vault**，選剛剛 Clone 下來的 `guitarpuli` 資料夾。
3. 複製 `templates/新歌範本.md` 到 `songs/`，把檔名改成網址代稱，例如 `songs/rocket-88.md`。
   - 檔名只能用小寫英文、數字和 `-`。
   - 檔案開頭 `---` 之間的欄位會在 Obsidian 顯示成「屬性」，可以直接編輯。
4. 寫完後打開 GitHub Desktop，左下填說明（例如「新增 Rocket 88」）→ **Commit to main → Push origin**。網站約 1 分鐘後更新。
   - 也可以安裝 Obsidian 的 **Git** 外掛，設定自動推送，就不用另外開 GitHub Desktop。

兩種方式改的是同一批檔案。如果在網頁後台改過，回到電腦上要先在 GitHub Desktop 按 **Fetch / Pull**，再用 Obsidian 編輯，避免版本衝突。

---

## 三、和弦譜寫法

```
## 前奏
| G | D | Em | C |

## 主歌
| G | D | Em | Bm |
| C | G | Am D | G |

## 副歌
| C | D | G Em | C |
```

- `## 段落名` 開一個新段落。前奏、主歌、導歌、副歌、橋段、間奏、尾奏會自動翻成英文介面的 Intro、Verse 等；其他名稱會照原樣顯示。
- 每一列用 `|` 開頭和結尾，`|` 之間是一個小節，建議一列 4 小節。
- 同一小節兩個和弦用空格隔開，例如 `| Am D |`。
- 和弦寫法：`G`、`Em`、`D7`、`Cmaj7`、`G/B`、`F#m`、`Bb`。
- 和弦一律寫**實際音高**，夾 Capo 的指型交給網站換算。
- **不要寫歌詞**。公開譜只放和弦與段落，歌詞由讀者用「我的歌詞」自行輸入，只存在他們自己的瀏覽器。

### 欄位對照

| 欄位 | 說明 | 可用的值 |
|---|---|---|
| `key` | 原調 | `G`、`Bb`、`F#m`… |
| `capo` | 建議 Capo | `0`–`9` |
| `feel` | 律動 | `straight8` 平均八分、`swing` 搖擺八分、`shuffle` 三連音拖曳、`straight16` 平均十六分、`triplet` 12/8 三連音 |
| `level` | 難度 | `1` 初級、`2` 中級、`3` 進階 |
| `genre` | 曲風 | `pop`、`folk`、`blues`、`rock`、`ballad`、`oldies` |
| `strum_note` / `strum_note_en` | 刷法補充（中／英） | 任意文字，可省略 |

如果格式寫錯，Netlify 的部署會失敗，並在部署紀錄（Deploys → 點進那次部署）裡寫出哪個檔案、第幾行有問題。修正後再推送一次就好，舊版網站在這段期間照常運作。

---

## 四、在自己電腦上預覽（可省略）

需要先安裝 Node.js（https://nodejs.org）。

```
npm install
npm run dev
```

然後打開終端機顯示的網址。

## 五、注意

- `songs/` 裡目前的 14 首都是虛構範例，正式上線前請刪除或換成你自己的編曲。
- 「版權聲明」頁已填入聯絡人 pulipapa 和信箱；開始收費或開放會員公開上傳前，建議請律師看過。

---

## 六、網站上的其他功能

- **後台連結**：在某台裝置用 `你的網址/admin/` 進過一次後台後，那台裝置的網站側欄最下面就會出現「後台」。一般訪客看不到。
- **回報問題**：側欄和頁尾的「回報問題」會產生一段範本（自動帶入頁面網址和裝置），讓訪客複製後到 Instagram 私訊 pulipapa5986。
- **Instagram / YouTube**：側欄和每一頁的頁尾都有連結。要改帳號，在 `public/index.html` 搜尋 `IG_URL`。

## 七、會員同步（Supabase）

開啟後，訪客可以登入帳號，收藏、自建譜、最近瀏覽、移調設定和歌詞會在手機和電腦之間同步。沒設定之前，網站不會顯示登入按鈕，其他功能照常使用。

### 1. 建立 Supabase 專案
1. 到 https://supabase.com → **Start your project**，用 GitHub 帳號登入。
2. **New project**：
   - Name：`guitarpuli`
   - Database Password：按 Generate 產生，存到記事本
   - Region：選 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**
   - 其他維持預設，按 **Create new project**，等 1～2 分鐘。

### 2. 建立資料表
1. 左側選單 **SQL Editor** → **New query**。
2. 打開這個資料夾裡的 `supabase.sql`，全部複製貼上，按 **Run**，看到 Success 就完成。

### 3. 設定登入後回到哪個網址
1. 左側 **Authentication → URL Configuration**。
2. **Site URL** 填 `https://guitarpuli.netlify.app`（換成你的網址），按 Save。
3. **Redirect URLs** 按 Add URL，填 `https://guitarpuli.netlify.app/**`，按 Save。

做到這裡，**Email 登入**（寄登入連結）就能用了。Supabase 內建寄信服務每小時只能寄少量信件，自己測試足夠；會員變多後再到 Authentication → Emails 設定自己的寄信服務。

### 4. 把金鑰放進網站
1. 左側 **Project Settings → API Keys**（或首頁上方的 **Connect**）。
2. 複製 **Project URL**（像 `https://xxxx.supabase.co`）和 **Publishable key**（`sb_publishable_` 開頭；舊專案叫 anon key）。
   - 這兩個可以公開放在網頁裡，資料由第 2 步的權限保護。
   - **絕對不要**使用或貼出 `secret` / `service_role` key。
3. 在 GitHub 打開 `public/index.html`，按鉛筆編輯，搜尋 `SUPABASE_URL`，把兩行改成：
   ```
   const SUPABASE_URL='https://xxxx.supabase.co';
   const SUPABASE_KEY='sb_publishable_xxxx';
   ```
   Commit 後約 1 分鐘，側欄就會出現「登入」。

### 5. Google 登入（可以之後再做）
1. 到 https://console.cloud.google.com 建立專案 → **APIs & Services → OAuth consent screen**，填應用程式名稱「吉他普利」和你的 Email，對象選 External。
2. **Credentials → Create credentials → OAuth client ID**，類型選 **Web application**：
   - Authorized JavaScript origins：`https://guitarpuli.netlify.app`
   - Authorized redirect URIs：Supabase 的 **Authentication → Sign In / Providers → Google** 頁面顯示的 Callback URL（像 `https://xxxx.supabase.co/auth/v1/callback`）
3. 把 Google 給的 Client ID 和 Client Secret 貼回 Supabase 的 Google 設定，開啟並儲存。

### 同步規則
- 第一次登入時，會把這台裝置原本的資料和帳號裡的資料合併，不會互相蓋掉。
- 之後每次修改約 1 秒內上傳；切回網頁分頁時會自動抓最新資料。
- 歌詞只存在該會員自己的資料列，其他會員和訪客讀不到。
