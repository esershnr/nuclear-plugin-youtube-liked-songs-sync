# YouTube Liked Songs Sync Plugin

A standalone plugin for **Nuclear Music Player** that automatically syncs your Liked Songs from YouTube Music directly to your local playlists. 

No external Python scripts or background services are required. The sync is processed entirely within the player using Tauri's backend bridge and respects your data privacy.

---

## 🚀 Installation & First-Time Setup

### Step 1: Install the Plugin
1. Open **Nuclear Music Player**.
2. Navigate to **Settings** (gear icon in the bottom-left corner) -> **Plugins** -> **Installed**.
3. Click the **Add Plugin** button.
4. Select this directory (`nuclear-plugin-youtube-liked-songs-sync`).
5. Ensure the plugin **"Youtube Liked Songs Sync"** is toggled to **Enabled**.

### Step 2: Restart Nuclear Music Player (Crucial)
> [!IMPORTANT]
> You **MUST restart** Nuclear Music Player completely after enabling the plugin for the settings UI to refresh and load the required input fields.

### Step 3: Configure Settings
1. After restarting, open Nuclear and navigate to **Preferences** -> **General** (or scroll down in the Settings menu) to find the **"Youtube Liked Songs Sync"** section.
2. Locate the two input fields: **YouTube Music Cookie** and **YouTube Music Authorization**.
3. To obtain these values:
   - Open [music.youtube.com](https://music.youtube.com) in your web browser and ensure you are logged in.
   - Press **F12** (Developer Tools) and select the **Network** tab.
   - Refresh the page, and type `/browse` in the filter search box.
   - Click on one of the browse requests (under the POST method).
   - In the right-hand panel under **Request Headers**:
     - Copy the value next to `cookie` and paste it into the **YouTube Music Cookie** setting.
     - Copy the value next to `authorization` (which starts with `SAPISIDHASH`) and paste it into the **YouTube Music Authorization** setting.

---

## 🔄 How to Sync

1. Go to **Preferences** -> **General** (or scroll down to the **"Youtube Liked Songs Sync"** section).
2. Click the **"Sync Liked Songs Now"** button.
3. The plugin will immediately fetch your liked tracks in the background, updating the **Sync Status** in real-time (*Fetching page 1...*, *Fetching page 2...*, etc.).
4. The button will dynamically show **"Syncing..."** and disable itself during the process. Once completed, it will re-enable, and you can check the final status in the **Sync Status** text field (e.g. *Success! Synced 1224 songs*).
5. All sync logs can also be monitored in real-time under the **Preferences** -> **Logs** section inside Nuclear Player!
