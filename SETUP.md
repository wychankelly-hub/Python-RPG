# 中三五課版：部署與課堂設定

《珍珠奶茶店收銀機》是課堂主項目。本 RPG 每課只用約 5–8 分鐘回想及轉移概念；時間為設計目標，需按學生試用結果調整。

## GitHub Pages 與家中模式

將 `index.html` 放在儲存庫根目錄，在 Settings → Pages 選 Deploy from a branch、main、/(root)。以 Chrome 或 Edge 開啟：

`https://wychankelly-hub.github.io/Python-RPG/`

這是家中模式；依完成進度解鎖五課，沒有老師課節限制。函數位於獨立的 ⭐ 魔法塔（選修），不影響魔王城或證書。無需建置、npm、Firebase、Google Cloud 或 Google 登入。

本機開發：在儲存庫執行 `python3 -m http.server 8000 --bind 127.0.0.1`，以瀏覽器開啟本機伺服器。需允許 `cdn.jsdelivr.net` 下載 Pyodide 0.26.4；字型的 `fonts.googleapis.com`、`fonts.gstatic.com` 為選用。

## 建立 Google Sheet

建立試算表，工作表名稱必須是 **Sessions**，首列按以下欄位命名（順序可改，名稱不可重複）：

| Class | Session_Code | Lesson | Required_Missions | Bonus_Missions | Active |
|---|---|---|---|---|---|
| 3A | DRAGON28 | 2 | c2m1,c2m2,c2m3 | c2b1 | TRUE |
| 3B | SLIME35 | 2 | c2m1,c2m2 | c2b1 | TRUE |

`Session_Code` 是 4–40 個大楷英文字母、數字、底線或連字號；必須唯一。`Lesson` 是 1–5；`Active` 是 TRUE/FALSE（亦可用核取方塊）。任務 ID 以英文逗號分隔，同一任務不能同時出現在兩欄。不合法、重複、停用的課堂都會拒絕開啟。

`Required_Missions` 留空使用該課預設必做清單；`Bonus_Missions` 留空表示沒有額外挑戰。

| 課 | 預設今日必做 | 可選額外挑戰 | 其他家中練習 |
|---|---|---|---|
| 1 print 與變量 | c1m1,c1m3,c1m5 | c1b1 | c1m2,c1m4 |
| 2 數據類型與運算 | c2m1,c2m2,c2m3 | c2b1 | — |
| 3 輸入與決定 | c3m1,c3m2,c3m3 | c3b1 | — |
| 4 while | c4m1,c4m2,c4m3 | c4b1 | — |
| 5 整合 | c5m2,c5m4,c5m5 | — | c5m1,c5m3 |

第 1 課今日任務亦會展示「HP 不斷改變，所以需要記住目前狀態」的需要與圖解。第 5 課在家有五個階段；課堂選三個整合階段，前置程式由 carry 機制取學生已存程式，沒有時用參考前置程式，學生仍要加入或改寫當前步驟。老師可調整必做清單，但須保持任務的教學次序；課堂模式只承認明列任務的完成記錄。

## 部署 Apps Script

1. 從此試算表開啟「擴充功能 → Apps Script」。
2. 把本專案 `Code.gs` 貼到指令碼專案，儲存。從編輯器選擇並執行一次 `configureClassroom`，依 Google 畫面授權。它會把這份試算表 ID 存入指令碼屬性 `SPREADSHEET_ID`，讓網頁應用程式可明確開啟該表。試算表 ID 不是密鑰；不要把表設為公開可編輯。
3. 選「部署 → 新增部署 → 網頁應用程式」。
4. 執行身分選自己；存取權選「所有人」（包含未登入使用者）。首次依 Google 畫面授權這個綁定試算表的專案。
5. 複製以 `/exec` 結尾的部署網址。不要使用只供開發者的 `/dev` 網址。
6. 在 `index.html` 搜尋 `TEACHER_CONFIG`，把網址填進 `appsScriptUrl`，例如：

```js
const TEACHER_CONFIG = {
  enabled: false,
  lesson: 1,
  appsScriptUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
};
```

7. 提交這個設定並等待 Pages 更新。用未登入的瀏覽器測試 `你的部署網址?session=DRAGON28` 能取得 JSON，再以 Pages 實際測試跨網域 fetch 與重新導向。Apps Script 的 JSON 服務會重新導向到 `script.googleusercontent.com`，學校網絡也要允許它及 `script.google.com`。

若學校 Workspace 政策不容許「所有人」存取，需管理員處理或使用下述本機設定。遊戲不會在後端查詢失敗時偷偷切換成家中模式。部署權限、真實 Google 回應與跨網域連線必須在實際部署驗收。

## 課堂網址與控制

例：`https://wychankelly-hub.github.io/Python-RPG/?mode=class&session=DRAGON28`

老師在 Sheet 改 `Lesson` 及任務 ID 就可更改當日課節，不需重新部署 HTML。學生重新載入網址以取得新設定。停用課堂：將 `Active` 改為 FALSE。已開啟的頁面不會即時輪詢 Sheet；要收回存取需學生重新載入或關閉頁面。本系統是教學導引，並非可防篡改的考試或存取授權系統。

建議每次課堂使用新代碼，例如 `DRAGON29`。相同代碼及課節會恢復該瀏覽器課堂進度；新代碼可重新記錄今日任務。學生即使在家已完成第 4 課，進入第 2 課的課堂代碼也只會開啟該課明列任務。完成後可以重玩、玩額外挑戰或回地圖，不會自動解鎖下一課。

開發時可明確啟用固定課節：`enabled: true, lesson: 2`，再開 `?mode=class&lesson=2`。只有設定一致才接受。帶有 `session=` 時一律查詢後端，失敗不會使用固定課節替代。正式部署建議保持 `enabled: false`。

## 存檔與私隱

新課程家中存檔使用 `pythonHeroLegend.save.f3.v2`；課堂使用另一組按代碼及課節分開的 localStorage key。課堂不接受家中存檔碼或老師全解鎖捷徑。`HERO-章-任務-檢查碼` 格式保留，新課程碼涵蓋六個區域（第六區為選修）。

舊五章的內容及任務編號意義不同，舊 `pythonHeroLegend.save.v1` 資料原封保留，但不自動當成新課程的完成紀錄。舊存檔碼沒有課程版本，請勿以舊碼恢復新課程進度。課堂進度只留在該瀏覽器，清除網站資料後會消失。

此版本只實作公開唯讀課堂查詢，不實作選用的學生完成上報；不收集班別、學號、姓名，也不記錄按鍵、錯誤、提示或程式碼。工作表中的 Class 只供老師管理，API 不回傳它。不要在公開 Session 表放入學生個人資料。

## input 與圖解

學生仍寫正常 Python `input()`。引擎只在內部把主程式中的 input 呼叫轉為可等待的 AST 節點，使用 Pyodide coroutine 和 Web Worker 訊息暫停/繼續，不重跑程式、不使用瀏覽器 prompt，也不需要 SharedArrayBuffer 或 GitHub Pages 特殊回應標頭。支援同一程式多次輸入及 while 內輸入；不支援在自訂函數內使用 input（會顯示明確錯誤，此概念不屬必修路徑）。等待輸入不計入 Python 執行時間；三分鐘取消等待。仍保留三秒 Python 執行時限、八秒 worker watchdog、輸出及動畫事件上限。

所有概念圖解由資料指定，支援重播、跳過及減少動態效果。動畫標示步驟，但文字保持可見。七種圖解涵蓋儲存、更新、類型、輸入轉換、條件分支、迴圈與整合流程。

選修魔法塔的細項進度留在瀏覽器家中存檔；紙本 HERO 存檔碼只表示必修五課進度，避免單獨玩選修時錯誤解鎖整條必修路徑。

## 自動驗證

環境已有 Node 24 及 Chromium。先啟動上述 HTTP 伺服器，再啟動 Chromium 的 CDP（9222 只限本機）：

```sh
chromium --headless --no-sandbox --disable-dev-shm-usage \
  --proxy-server="$HTTPS_PROXY" '--proxy-bypass-list=localhost;127.0.0.1' \
  --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
  --user-data-dir=/tmp/python-rpg-test-profile about:blank
```

`--no-sandbox` 只適用於這個已隔離的雲端容器。一般桌面開啟瀏覽器毋須此選項。使用環境繼承的 CA 信任；不要略過 TLS 憑證檢查。

執行 `node tests/browser.mjs`。測試會使用這個 Chromium 個人檔案的測試存檔，請使用獨立測試個人檔案。程式會驗證真實 Pyodide、23 個教材參考程式、多次輸入及等候、錯誤/執行時限、家中/課堂隔離、任務鎖定、圖解控制。`node tests/ui.mjs` 另驗證常見螢幕尺寸、七種圖解、分步提示與 worker 硬逾時後恢復，並把桌面截圖寫至 `/tmp/rpg-desktop.png`。`node tests/backend.mjs` 用模擬工作表測試 Apps Script 查詢邏輯；不代表已部署 Google 服務。
