# Google AI Studio 自動同步設置指南

## 📋 已完成的步驟

### ✅ 步驟 1: 創建自動同步工作流程
已創建 `.github/workflows/sync-from-google-ai-studio.yml` 文件，配置為：
- 每 30 分鐘自動檢查更新
- 支援手動觸發
- 自動提交和部署

### ✅ 步驟 2: 添加 GitHub Secret
已添加 `DRIVE_FILE_ID`：`1OSsFLLhuXIDp_Qcgfro5Z1vdZvN_eICy`

## 🔧 待完成的步驟

### 步驟 3: 設置 Google Cloud 服務帳戶

要讓 GitHub Actions 能夠自動從 Google Drive 下載文件，需要：

1. **前往 [Google Cloud Console](https://console.cloud.google.com/)**

2. **創建新專案或選擇現有專案**

3. **啟用 Google Drive API**
   - 前往「API 和服務」>「啟用 API 和服務」
   - 搜尋「Google Drive API」
   - 點擊「啟用」

4. **創建服務帳戶**
   - 前往「IAM 和管理」>「服務帳戶」
   - 點擊「創建服務帳戶」
   - 名稱：`github-actions-sync`
   - 點擊「創建並繼續」
   - 角色：選擇「基本」>「瀏覽者」
   - 點擊「完成」

5. **創建密鑰**
   - 點擊剛創建的服務帳戶
   - 前往「密鑰」標籤
   - 點擊「新增密鑰」>「創建新密鑰」
   - 選擇「JSON」格式
   - 下載 JSON 文件

6. **分享 Google Drive 文件給服務帳戶**
   - 在 Google AI Studio 中，找到您的專案
   - 點擊「Share」或在 Google Drive 中找到對應文件
   - 將文件分享給服務帳戶的電子郵件地址（格式：`github-actions-sync@your-project.iam.gserviceaccount.com`）
   - 權限設為「檢視者」

7. **將服務帳戶密鑰添加到 GitHub Secrets**
   - 前往 GitHub Repo > Settings > Secrets and variables > Actions
   - 點擊「New repository secret」
   - Name: `GOOGLE_CREDENTIALS`
   - Value: 貼上整個 JSON 文件的內容
   - 點擊「Add secret」

8. **更新工作流程文件以使用服務帳戶**

## 🚀 替代方案：簡化版（推薦）

如果覺得 Google Cloud 設置太複雜，可以使用以下更簡單的方法：

### 方法 1: 手動觸發 + 複製貼上
保持現有的手動複製貼上方式，每次在 Google AI Studio 修改後：
1. 複製 index.html 內容
2. 在 GitHub 編輯並提交
3. 自動部署

### 方法 2: 使用 GitHub CLI + 腳本
創建本地腳本自動化上傳過程

## 📊 當前狀態

- ✅ 自動同步工作流程已創建
- ✅ DRIVE_FILE_ID 已設置
- ⏳ 等待 Google API 認證設置
- ⏳ 工作流程暫時使用手動觸發模式

## 💡 使用建議

基於您的自動化專業背景和效率需求，建議：

1. **短期**：繼續使用複製貼上方式（5 分鐘/次）
2. **中期**：完成 Google Cloud 設置，啟用自動同步
3. **長期**：考慮將 Google AI Studio 整合到 CI/CD 流程中
