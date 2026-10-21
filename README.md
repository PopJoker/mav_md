# MavMD 專案說明

這份 README 說明每個檔案的職責，方便日後維護時快速定位。

---

## 專案結構總覽

```
/
├── index.html          ← HTML 骨架 + 外部資源引入
├── .nojekyll           ← 空檔案（GitHub Pages 用）
├── example.md          ← Markdown 語法範例文件
├── sw.js               ← Service Worker（離線快取，目前 v5）
├── css/
│   └── style.css       ← 全部自訂樣式
└── js/
    ├── main.js         ← 進入點（組裝所有模組）
    ├── config.js       ← 共用常數、state、DOM 快取
    ├── prefs.js        ← 使用者偏好、配色、PWA Manifest
    ├── pwa.js          ← SW 註冊、安裝提示、icon 精靈、toast
    ├── storage.js      ← IndexedDB（FileSystemHandle 持久化）
    ├── fs.js           ← 檔案系統操作（開檔、存檔、改名、移動）
    ├── panels.js       ← 三欄版面寬度、拖曳調整
    ├── markdown.js     ← Markdown 渲染、標題 slug、TOC
    ├── images.js       ← 圖片拖入 / 貼上處理
    ├── localimg.js     ← 本機相對路徑圖片載入
    └── urlshare.js     ← 專屬連結（#file= / #share= / #url=）
```

---

## 根目錄檔案

### `index.html`

- **職責**：純 HTML 骨架，不含任何內嵌 CSS 或 JS 邏輯。
- **內容**：
  - 引入 Tailwind、marked、highlight.js、DOMPurify（CDN）
  - `<link>` 引入 `css/style.css`
  - 動態 manifest 的 `<link id="pwaManifest">`（由 JS 產生 Data URL）
  - 所有 UI 區塊：Topbar、側邊欄、主工作區、Icon 精靈、Toast、分享 / 新增筆記 modal
  - 「安裝 App」按鈕預設帶 `hidden` class，由 `pwa.js` 動態決定是否顯示
  - 最後用 `<script type="module" src="./js/main.js">` 載入進入點
- **注意**：
  - 用 ES Module，**必須透過 http(s) 開啟**（不能 `file://`）
  - CSS 載入必須在 Tailwind 之後，才能覆寫

### `.nojekyll`

- **職責**：空的標記檔（0 bytes）。
- **用途**：告訴 GitHub Pages **不要用 Jekyll 處理**。
- **為什麼需要**：否則 `example.md` 可能被 Jekyll 當成頁面渲染成 `.html`，`fetch('./example.md')` 就拿不到原始 Markdown 內容。

### `example.md`

- **職責**：Markdown 語法完整範例文件。
- **用途**：使用者點「下載範例」按鈕時，透過 `fetch('./example.md')` 載入。
- **好處**：從 `index.html` 抽出，主檔瘦身約 400 行；可獨立編輯，不影響主檔邏輯。

### `sw.js`

- **職責**：Service Worker，負責 PWA 離線快取。
- **內容**：
  - `CACHE_NAME` 版本號（**目前為 `mavmd-pwa-v5`**，改版時務必更新，如 `v5` → `v6`）
  - `ASSETS` 清單：列出所有本機與外部資源
  - `install`：快取全部資源（外部資源用 `no-cors` 模式）
  - `activate`：清除舊版本快取
  - `fetch`：導航請求失敗時 fallback 到 `index.html`；其他請求優先讀快取
- **注意**：
  - 修改任何被快取的檔案後，必須更新 `CACHE_NAME`，否則瀏覽器會一直用舊版
  - DevTools → Application → Service Workers → 勾「Update on reload」可強制更新

---

## `css/` 目錄

### `css/style.css`

- **職責**：所有自訂樣式（Tailwind 之外的）。
- **內容分區**：
  - `:root` CSS 變數（`--accent`、`--surface`、`--ink` 等，供主題切換）
  - 版面配置（側邊欄、三欄 resizer、面板）
  - `.markdown-body` 預覽區樣式（標題、清單、程式碼、表格、引用）
  - 程式碼複製按鈕
  - Icon 精靈 modal、Toast
  - 拖曳上傳提示
  - 響應式斷點（`max-width: 640px`）
- **注意**：
  - 顏色一律用 CSS 變數，避免硬編碼
  - `!important` 只用於對抗 Tailwind 的地方（`.primary`、`.ghost` 等）

---

## `js/` 目錄

模組之間透過 ES Module `import` / `export` 互相依賴。依賴方向大致為：`main.js` → 其他模組 → `config.js`（最底層）。

### `js/config.js`（基礎層）

- **職責**：全專案共用的常數、狀態、工具函式。
- **內容**：
  - `$`：`document.getElementById` 的簡寫
  - `state`：全域狀態（`files`、`active`、`dir`、`content`、`dirty`、`showEditor/Preview/TOC`）
  - `defaults`：預設顏色
  - `colorInputs`：四個 `<input type="color">` 的 DOM 參照
  - `DEFAULT_WIDTHS` / `MIN_WIDTHS`：三欄的預設與最小寬度
  - `els`：主要 DOM 快取（用 getter，避免模組載入順序問題）
  - 工具函式：`setStatus`、`setDirty`、`showWorkspace`、`mix`、`validName`
- **依賴**：無（最底層）

### `js/prefs.js`（偏好設定）

- **職責**：localStorage 讀寫、顏色套用、PWA Manifest 產生。
- **內容**：
  - `loadPrefs()` / `savePrefs(paneWidths)`：讀寫 localStorage（顏色、資料夾名、面板寬度）
  - `applyColors(colors)`：套用顏色到 CSS 變數與 `theme-color` meta
  - `makePngIconDataUrl(color, size)`：用 Canvas 動態產生 PWA 圖示
  - `buildManifest(accent)` / `applyManifest(accent)`：產生並套用 manifest Data URL
  - `makeIconPreview(color, size)`：供 Icon 精靈預覽用
- **依賴**：`config.js`

### `js/storage.js`（IndexedDB）

- **職責**：持久化儲存 `FileSystemHandle`（資料夾 / 檔案句柄）。
- **內容**：
  - `handleDB`：IndexedDB 開啟的 Promise（DB 名：`MavMD檔案記憶`）
  - `storeHandle(key, handle)`：存入句柄（key 為 `'directory'` 或 `'activeFile'`）
  - `getStoredHandle(key)`：取出句柄
  - `permit(handle, fromClick)`：查詢 / 請求讀寫權限
- **為什麼需要**：瀏覽器重開後，需要 IndexedDB 存句柄才能「恢復上次開啟」
- **依賴**：無

### `js/fs.js`（檔案系統操作，最大的模組）

- **職責**：所有 File System Access API 的實際操作。
- **內容分區**：
  - **樹狀結構**：`addRow`（加一個檔案列）、`scan`（遞迴掃描資料夾）、`rebuildTree`（重建整棵樹）
  - **狀態**：`activate`（設定作用中檔案）、`confirmDiscard`（離開前確認）
  - **開檔**：`openNote`、`openFile`、`openFolder`
  - **讀寫**：`writeHandle`、`save`
  - **CRUD**：`newFile`（自訂 modal）、`saveAs`、`renameFile`、`moveFile`
  - **恢復**：`restoreLastOpen`（頁面載入時自動恢復上次資料夾 / 檔案）
  - `chooseTargetDirectory`：共用資料夾選擇器
- **依賴**：`config.js`、`storage.js`、`prefs.js`、`markdown.js`

### `js/panels.js`（版面控制）

- **職責**：三欄（編輯 / 預覽 / TOC）的寬度計算、拖曳調整、顯示切換。
- **內容**：
  - `currentWidths`：目前三欄比例（初始來自 prefs）
  - `applyPaneWidths(widths)`：依比例 + 最小寬度計算實際 flex 值並套用
  - `updatePanels()`：更新 toggle 按鈕文字、觸發 `applyPaneWidths`
  - `toggleTOC()`：切換 TOC 顯示
  - `initResizers()`：綁定兩條 resizer 的 mousedown / mousemove / mouseup
  - `getPaneWidths()` / `setCurrentWidths()`：寬度讀寫
- **依賴**：`config.js`、`prefs.js`

### `js/markdown.js`（渲染核心）

- **職責**：Markdown → HTML 的完整渲染流程。
- **內容**：
  - `slugify(text)`：產生 heading id（支援全 Unicode，含中文、日文、emoji）
  - `render()`：主渲染函式
    1. 把 `[[wiki 連結]]` 轉成 `[text](wiki:...)`
    2. `marked.parse` 解析成 HTML
    3. `DOMParser` 為標題補上唯一 id
    4. `DOMPurify.sanitize` 消毒
    5. `hljs.highlightElement` 語法高亮
    6. 為每個 `pre` 加上「複製」按鈕
    7. 解析 `wiki:` 連結並綁定點擊開啟對應筆記
    8. 呼叫 `generateTOC`
    9. 呼叫 `hydrateLocalImages()`（非同步載入本機相對路徑圖片）
  - `generateTOC()`：從 `viewer` 抓取所有標題，產生右側導覽列
- **依賴**：`config.js`、`fs.js`（`openNote`）、`localimg.js`

### `js/images.js`（圖片拖入 / 貼上）

- **職責**：攔截編輯器的貼上與拖放事件，把圖片寫入本機資料夾。
- **內容**：
  - `insertAtCursor(text)`：在游標位置插入文字
  - `ensureWritableFolder()`：確認有可寫入的資料夾
  - `persistImage(file)`：把圖片寫入 `assets/`，回傳相對路徑
  - `handleImageFiles(files)`：批次處理圖片，逐張插入 Markdown
  - `initImageDrop()`：綁定編輯器 `paste` 與 `drop` 事件
- **依賴**：`config.js`、`markdown.js`

### `js/localimg.js`（本機圖片載入）

- **職責**：把 Markdown 裡的相對路徑圖片，從本機資料夾讀出轉成 blob URL。
- **內容**：
  - `resolveFileHandle(baseDir, relativePath)`：依相對路徑找出 `FileSystemFileHandle`
  - `isLocalRelative(src)`：判斷是否為「應從本機載入」的路徑（排除 `http:`、`data:`、`blob:`）
  - `releaseLocalImages()`：釋放舊的 blob URL
  - `hydrateLocalImages()`：主函式，掃描 `viewer` 內所有 `<img>` 並替換 `src`
- **注意**：瀏覽器 FileSystem API 沒有 parent 存取，**不支援 `../`** 向上跳的路徑
- **依賴**：`config.js`

### `js/urlshare.js`（專屬連結）

- **職責**：處理 `#file=`、`#share=`、`#url=` 三種 hash，並產生「取得連結」彈窗。
- **內容**：
  - `encodeShare(text)` / `decodeShare(b64url)`：Base64 URL-safe 編碼（供 `#share=` 用）
  - `copyShareLink()`：產生 `#file=<path>` 連結並開啟 modal
  - `handleFileHash()`：解析 `#file=`；若資料夾已授權就直接開檔，否則顯示授權橫幅
  - `loadFromHash()`：頁面載入時解析 hash，依序處理 `#file=` → `#share=` → `#url=`
  - `applyExternalContent(md, title)`：把外部內容載入編輯器
  - `initShareButton()`：綁定按鈕、modal 關閉、`hashchange` 監聽
- **依賴**：`config.js`、`markdown.js`、`fs.js`（動態 import）

### `js/pwa.js`（PWA 功能）

- **職責**：Service Worker 註冊、安裝提示、Icon 精靈、Toast 提示。
- **內容**：
  - `registerServiceWorker()`：註冊 `./sw.js`
  - `isAppInstalled()`：判斷目前是否以 standalone 模式運行（含 iOS Safari 的 `navigator.standalone`）
  - `initInstallPrompt()`：**已安裝時直接隱藏「安裝 App」按鈕**；未安裝時先隱藏，等 `beforeinstallprompt` 才顯示；同時監聽 `matchMedia('(display-mode: standalone)')` 變化與 `appinstalled` 事件
  - `initIconWizard()`：綁定 icon 精靈的取消 / 確認按鈕
  - `openIconWizard(accent)` / `closeIconWizard()`：開關精靈
  - `showToast(text, actionLabel, actionFn, duration)`：底部 Toast
  - `hasDeferredPrompt()`：是否有可用的安裝提示
- **依賴**：`config.js`、`prefs.js`

### `js/main.js`（進入點）

- **職責**：組裝所有模組、綁定 UI 事件、啟動應用程式。
- **內容**：
  - 載入偏好、套用顏色、套用 manifest
  - 綁定顏色輸入、側邊欄、開檔 / 存檔 / 改名 / 移動等主按鈕
  - `Ctrl+S` / `Cmd+S` 快捷鍵
  - 齒輪選單開關
  - 面板切換按鈕（`editToggle`、`previewToggle`、`tocToggleTop`）
  - 搜尋過濾
  - **下載範例**：`fetch('./example.md')` → 下載 + 載入編輯器
  - 編輯器 `input` 事件 → 觸發 `render()` + `setDirty`
  - 拖曳上傳（`initDragAndDrop`、`handleDroppedHandles`、`handleDroppedFiles`）
  - 啟動順序：`restoreLastOpen` → `loadFromHash` → `registerServiceWorker` → `initInstallPrompt` → `initIconWizard` → `initDragAndDrop` → `initResizers` → `updatePanels`
- **依賴**：幾乎所有模組

---

## 模組依賴關係圖

```
main.js
  ├── config.js  ← 所有模組都會用到
  ├── prefs.js      → config
  ├── storage.js    （無依賴）
  ├── fs.js         → config, storage, prefs, markdown
  ├── panels.js     → config, prefs
  ├── markdown.js   → config, fs, localimg
  ├── images.js     → config, markdown
  ├── localimg.js   → config
  ├── urlshare.js   → config, markdown
  └── pwa.js        → config, prefs
```

**原則**：底層模組（`config`、`storage`、`localimg`）不應 import 上層模組，避免循環依賴。

---

## 常見維護場景速查

| 我想… | 改哪個檔案 |
|-------|-----------|
| 改配色 / 主題 CSS | `css/style.css` 的 `:root` 變數 |
| 改預設顏色 | `js/config.js` 的 `defaults` |
| 改三欄預設寬度 | `js/config.js` 的 `DEFAULT_WIDTHS` |
| 加新的 Markdown 語法 | `js/markdown.js` 的 `render()` |
| 改範例文件 | `example.md`（不需要動 JS） |
| 加新的存檔方式 | `js/fs.js` |
| 改 PWA 快取清單 | `sw.js` 的 `ASSETS`（並更新 `CACHE_NAME`） |
| 加新的 UI 事件 | `js/main.js` 對應區塊 |
| 改檔名驗證規則 | `js/config.js` 的 `validName` |
| 加新的偏好設定項目 | `js/prefs.js` 的 `loadPrefs` / `savePrefs` |
| 改「安裝 App」按鈕顯示邏輯 | `js/pwa.js` 的 `initInstallPrompt` / `isAppInstalled` |
| 改圖片存放位置或命名規則 | `js/images.js` 的 `persistImage` |
| 改本機圖片路徑解析規則 | `js/localimg.js` 的 `resolveFileHandle` |
| 改專屬連結格式 | `js/urlshare.js` 的 `copyShareLink` / `handleFileHash` |

---

## 開發注意事項

1. **ES Module 必須透過 http(s) 開啟**
   ```bash
   npx serve .
   # 或
   python -m http.server 8000
   ```
   直接雙擊 `index.html` 用 `file://` 開啟，模組會載入失敗。

2. **改 `sw.js` 後要更新 `CACHE_NAME`**
   目前版本：`mavmd-pwa-v5`。改為 `v6`、`v7`… 否則瀏覽器會一直回傳舊快取。
   DevTools → Application → Service Workers 可勾「Update on reload」強制更新。

3. **`.nojekyll` 不可刪除**
   否則 GitHub Pages 上 `fetch('./example.md')` 會拿到渲染後的 HTML 而不是原始 Markdown。

4. **新增模組時**
   - 從 `config.js` import `$`、`state`、`els` 等共用資源
   - 避免從上層模組 import（例如 `markdown.js` 不要 import `main.js`）
   - 在 `main.js` 中呼叫並綁定

5. **改版號**
   - `sw.js` 的 `CACHE_NAME`（`mavmd-pwa-v5` → `v6`）
   - `index.html` 的 `<title>`、meta 版本號（如有）

6. **PWA 安裝按鈕的可見性**
   - 按鈕 `#installPwaBtn` 在 HTML 中預設帶 `hidden`，避免載入瞬間閃現
   - `initInstallPrompt()` 會在以下情況主動隱藏：
     - 目前以 standalone 模式運行（`display-mode: standalone`、`window-controls-overlay`、iOS `navigator.standalone`）
     - 收到 `appinstalled` 事件後
     - 使用者於 `beforeinstallprompt` 對話框按下「安裝」
   - 只有在「尚未安裝」且瀏覽器觸發 `beforeinstallprompt` 時才會顯示
   - 已安裝的 PWA 重新開啟時，`beforeinstallprompt` **不會**再觸發，因此必須靠 `isAppInstalled()` 主動偵測

7. **本機圖片的限制**
   - 圖片會存到「筆記所在資料夾」下的 `assets/`
   - Markdown 內的路徑是相對於筆記本身（`./assets/xxx.png`）
   - `localimg.js` **不支援 `../`**（FileSystem API 無 parent handle 可取得）
   - 若找不到圖片，會把 `alt` 改成錯誤訊息提示

---

## 未來可選優化

- 把 `js/fs.js`（約 350 行）再拆成 `fs-open.js` / `fs-write.js` / `fs-crud.js`
- CDN 的 UMD 改為 ESM（`https://esm.sh/marked@14`）避免全域變數
- 上線前壓縮：`npx lightningcss --minify css/style.css -o css/style.min.css`
- 加入靜態 `manifest.json`（若不需要動態換色，可完全取代 Data URL 方案）
- 以 `idb` 套件簡化 `storage.js` 的 IndexedDB 樣板碼