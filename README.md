# 串流平台 Session 管理器 (Streaming Session Manager) v2.2

[繁體中文](#繁體中文) | [English](#english-version)

---

## 繁體中文

這是一個功能強大的 Chrome 擴充功能，旨在幫助使用者跨平台管理多個串流平台帳號。您可以輕鬆地匯出、匯入與儲存 Disney+、Netflix、HBO、Amazon Prime Video 的會話資料 (Cookies & Storage)，並支援多帳號（分身）一鍵切換。

### 🚀 v2.2 重點更新
- **全方位多語系支援**：現在支援 **繁體中文**、**簡體中文**、**English** 與 **日本語**。
- **自定義介面語言**：在管理頁面中，您可以手動切換偏好的語系，不再受限於系統預設語系。
- **優化載入邏輯**：修正了非同步載入時的翻譯顯示問題，提供更流暢的使用體驗。

### ✨ 功能特色
- **多帳號管理**：為每個平台儲存多組「分身」，隨時切換，再也不需要反覆登入登出。
- **多語系介面**：所有功能標籤與提示訊息均已完全國際化。
- **全平台自動辨識**：匯入備份檔時，系統會自動偵測多個平台的資料並引導您存為獨立分身。
- **專屬管理大廳**：獨立的管理頁面 (`options.html`)，提供完整的更名、刪除、單獨匯出與語言切換功能。
- **細粒度匯出控制**：支援勾選特定平台進行備份，或是一鍵備份所有已儲存的分身。

### 🛠️ 支援平台
- **Disney+** (disneyplus.com)
- **Netflix** (netflix.com)
- **HBO Max / Max** (hbomax.com, max.com)
- **Amazon Prime Video** (primevideo.com)

### 📖 使用指南
#### 1. 儲存與切換分身
- 在串流平台登入後，點擊擴充功能圖示。
- 在「新分身名稱」輸入識別文字後點擊「儲存」。
- 之後只需在下拉選單中選擇該分身，即可立即切換會話。

#### 2. 進階管理與語言設定
- 點擊彈窗上方的「⚙️ 開啟帳號管理分頁」。
- 在頂端工具欄中，您可以：
    - 切換 **介面語言**。
    - 快速 **備份所有分身** 到單一 JSON 檔案。
- 在列表中您可以點選：
    - ✏️ **儲存修改**：更改分身名稱。
    - 📤 **匯出檔案**：單獨備份該分身。
    - 🗑️ **刪除**：移除不需要的分身。

#### 3. 匯入舊有資料
- 到管理頁面下方的「匯入分身資料」區塊，貼上匯出的 JSON 文字並點擊「開始匯入」。
- 系統會自動檢查是否重複，並自動完成分身新增。

---

## English Version

A powerful Chrome extension designed to help users manage multiple streaming accounts across different platforms. Easily export, import, and save session data (Cookies & Storage) for Disney+, Netflix, HBO, and Amazon Prime Video, with one-click profile switching.

### 🚀 v2.2 Highlights
- **Full Internationalization**: Now supports **Traditional Chinese**, **Simplified Chinese**, **English**, and **Japanese**.
- **Custom UI Language**: Manually switch to your preferred language in the management page, independent of system settings.
- **Optimized Loading**: Fixed asynchronous loading issues for a smoother translation experience.

### ✨ Key Features
- **Profile Management**: Save multiple "Profiles" for each platform and switch instantly—no more repetitive logins.
- **Multilingual Interface**: All UI elements and tooltips are fully localized.
- **Auto-Detection**: When importing backups, the system automatically detects multiple platform data and guides you to save them as separate profiles.
- **Management Dashboard**: A dedicated options page (`options.html`) for renaming, deleting, individual exports, and language switching.
- **Granular Export Control**: Choose specific platforms to backup or export all saved profiles into a single JSON file.

### 🛠️ Supported Platforms
- **Disney+** (disneyplus.com)
- **Netflix** (netflix.com)
- **HBO Max / Max** (hbomax.com, max.com)
- **Amazon Prime Video** (primevideo.com)

### 📖 Usage Guide
#### 1. Saving & Switching Profiles
- Log in to your favorite streaming site and click the extension icon.
- Enter a name in "New Profile Name" and click "Save".
- Simply select the profile from the dropdown menu to switch sessions instantly.

#### 2. Advanced Management & Language Settings
- Click "⚙️ Open Management Page" at the top of the popup.
- In the toolbar, you can:
    - Switch the **Interface Language**.
    - Quickly **Backup All Profiles** to a single JSON file.
- In the profile list, you can:
    - ✏️ **Save Changes**: Rename a profile.
    - 📤 **Export File**: Backup that specific profile.
    - 🗑️ **Delete**: Remove unwanted profiles.

#### 3. Importing Data
- Go to the "Import Profile Data" section in the management page, paste your exported JSON, and click "Start Import".
- The system will check for duplicates and add new profiles automatically.

---
> [!IMPORTANT]
> **Note**: Restoring Storage data (LocalStorage/SessionStorage) typically requires the specific platform's tab to be open. It is recommended to refresh the target tab after switching profiles.

---
*Developed with ❤️ for streaming enthusiasts.*
