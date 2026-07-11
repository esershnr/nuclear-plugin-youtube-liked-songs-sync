# YouTube Liked Songs Sync Plugin

A standalone plugin for **Nuclear Music Player** that automatically syncs your Liked Songs from YouTube Music directly to your local playlists. 

No external Python scripts or background services are required. The sync is processed entirely within the player using Tauri's backend bridge.

---

## 🚀 Installation & First-Time Setup

### Step 1: Install the Plugin
1. Open **Nuclear Music Player**.
2. Navigate to **Settings** (gear icon in the bottom-left corner) -> **Plugins** -> **Installed**.
3. Click the **Add Plugin** button.
4. Select the directory containing this eklenti (`nuclear-plugin-youtube-liked-songs-sync`).
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

1. Go to **Settings** -> **Plugins** -> **Installed**.
2. Toggle the **"Youtube Liked Songs Sync"** switch to **Disabled**, and then back to **Enabled**.
3. The plugin will immediately fetch your liked tracks in the background, updating the **Sync Status** in real-time (*Fetching page 1...*, *Fetching page 2...*, etc.).
4. Once completed, a browser alert will notify you of the synced track count, and a new playlist named **"YouTube Liked Songs"** will appear under your **Playlists** tab!
