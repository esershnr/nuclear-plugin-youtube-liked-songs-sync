import React, { useState, useEffect } from 'react';
import type { NuclearPlugin, NuclearPluginAPI } from '@nuclearplayer/plugin-sdk';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function findTracksRecursive(obj: any, tracksList: any[] = []): any[] {
  if (!obj || typeof obj !== 'object') return tracksList;
  
  if (obj.musicResponsiveListItemRenderer) {
    tracksList.push(obj.musicResponsiveListItemRenderer);
  } else {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        findTracksRecursive(obj[key], tracksList);
      }
    }
  }
  return tracksList;
}

function findContinuationToken(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  
  if (obj.continuationCommand && obj.continuationCommand.token) {
    return obj.continuationCommand.token;
  }
  if (obj.nextContinuationData && obj.nextContinuationData.continuation) {
    return obj.nextContinuationData.continuation;
  }
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const token = findContinuationToken(obj[key]);
      if (token) return token;
    }
  }
  return null;
}

interface ParsedTrack {
  title: string;
  artists: { name: string; roles: any[] }[];
  artworkItems: { url: string; width: number; height: number }[];
  videoId: string;
}

function parseTrackRenderer(renderer: any): ParsedTrack | null {
  let videoId: string | null = null;
  if (renderer.playlistItemData && renderer.playlistItemData.videoId) {
    videoId = renderer.playlistItemData.videoId;
  } else {
    const str = JSON.stringify(renderer);
    const watchMatch = str.match(/"videoId"\s*:\s*"([^"]+)"/);
    if (watchMatch) videoId = watchMatch[1];
  }
  
  if (!videoId) return null;
  
  let title = "Unknown Title";
  const artists: { name: string; roles: any[] }[] = [];
  
  try {
    const flexColumns = renderer.flexColumns || [];
    
    if (flexColumns[0] && flexColumns[0].musicResponsiveListItemFlexColumnRenderer) {
      const text = flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text;
      if (text && text.runs && text.runs[0]) {
        title = text.runs[0].text;
      }
    }
    
    if (flexColumns[1] && flexColumns[1].musicResponsiveListItemFlexColumnRenderer) {
      const text = flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text;
      if (text && text.runs) {
        const runs = text.runs;
        for (const run of runs) {
          if (run.text.includes("•") || run.text.includes("\u2022")) {
            break;
          }
          const name = run.text.trim();
          if (name && name !== "&" && name !== ",") {
            artists.push({ name, roles: [] });
          }
        }
        if (artists.length === 0 && text.runs[0]) {
          artists.push({ name: text.runs[0].text, roles: [] });
        }
      }
    }
  } catch (e) {
    console.error("Error parsing flexColumns:", e);
  }
  
  let artworkItems: { url: string; width: number; height: number }[] = [];
  try {
    if (renderer.thumbnail && renderer.thumbnail.musicThumbnailRenderer) {
      const thumbnails = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails || [];
      artworkItems = thumbnails.map((t: any) => ({
        url: t.url,
        width: t.width,
        height: t.height
      }));
    }
  } catch (e) {}
  
  return {
    title,
    artists,
    artworkItems,
    videoId
  };
}

const youtubeLikedSongsSyncPlugin: NuclearPlugin = {
  onLoad: async (api: NuclearPluginAPI) => {
    if (api.Logger) api.Logger.info("YouTube Liked Songs Sync Plugin Loaded (TSX Edition)!");
    
    // Define the custom settings React Button widget
    const SyncButtonWidget: React.FC = () => {
      const [isSyncing, setIsSyncing] = useState(false);

      useEffect(() => {
        const unsub = api.Settings.subscribe('syncStatus', (status: string | unknown) => {
          const statusStr = typeof status === 'string' ? status : '';
          if (statusStr && (
            statusStr.startsWith('Fetching') || 
            statusStr.startsWith('Preparing') || 
            statusStr.startsWith('Processing') || 
            statusStr.startsWith('Importing')
          )) {
            setIsSyncing(true);
          } else {
            setIsSyncing(false);
          }
        });
        return () => unsub();
      }, []);

      return (
        <button
          className="ui button primary"
          style={{
            padding: '10px 20px',
            backgroundColor: isSyncing ? '#767676' : '#2185d0',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            transition: 'background-color 0.2s ease'
          }}
          disabled={isSyncing}
          onClick={async () => {
            await api.Settings.set('syncTrigger', true);
          }}
        >
          {isSyncing ? 'Syncing...' : 'Sync Liked Songs Now'}
        </button>
      );
    };

    try {
      api.Settings.registerWidget('yt-liked-songs-sync-button-widget', SyncButtonWidget);
    } catch (e: any) {
      if (api.Logger) api.Logger.error("Failed to register custom widget: " + e.message);
    }
    
    try {
      await api.Settings.register([
        {
          id: 'ytCookie',
          title: 'YouTube Music Cookie',
          description: 'Steps: 1. Open music.youtube.com & log in. 2. Press F12, go to Network tab. 3. Refresh page, type "/browse" in filter. 4. Click a browse POST request. 5. Copy the value of the "cookie" header from Request Headers.',
          category: 'YouTube Liked Songs Sync',
          kind: 'string',
          default: ''
        },
        {
          id: 'ytAuth',
          title: 'YouTube Music Authorization',
          description: 'Steps: Copy the value of the "authorization" header (starts with "SAPISIDHASH") from the same "/browse" Request Headers in the Network tab.',
          category: 'YouTube Liked Songs Sync',
          kind: 'string',
          default: ''
        },
        {
          id: 'syncStatus',
          title: 'Sync Status',
          description: 'Status of the latest sync process.',
          category: 'YouTube Liked Songs Sync',
          kind: 'string',
          default: 'Ready'
        },
        {
          id: 'syncTriggerButton',
          title: 'Sync Action',
          description: 'Click the button below to start syncing your Liked Songs from YouTube Music.',
          category: 'YouTube Liked Songs Sync',
          kind: 'custom',
          widgetId: 'yt-liked-songs-sync-button-widget',
          default: null
        },
        {
          id: 'syncTrigger',
          title: 'Sync Trigger (Hidden)',
          description: 'Internal sync trigger flag.',
          category: 'YouTube Liked Songs Sync',
          kind: 'boolean',
          default: false,
          hidden: true
        }
      ]);
    } catch (e: any) {
      if (api.Logger) api.Logger.error("Failed to register settings: " + e.message);
    }
    
    api.Settings.subscribe('syncTrigger', async (value: boolean | unknown) => {
      if (value === true) {
        if (api.Logger) api.Logger.info("Starting YouTube Music Sync directly in TSX...");
        
        try {
          await api.Settings.set('syncStatus', 'Preparing headers...');
          
          const ytCookie = await api.Settings.get<string>('ytCookie');
          const ytAuth = await api.Settings.get<string>('ytAuth');
          
          if (!ytCookie || ytCookie.trim() === '') {
            throw new Error("Cookie is empty! Please paste your YouTube Music cookie first.");
          }
          if (!ytAuth || ytAuth.trim() === '') {
            throw new Error("Authorization is empty! Please paste your YouTube Music authorization first.");
          }
          
          const parsedHeaders: Record<string, string> = {
            'content-type': 'application/json',
            'cookie': ytCookie.trim(),
            'authorization': ytAuth.trim(),
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'x-goog-authuser': '0',
            'x-origin': 'https://music.youtube.com',
            'origin': 'https://music.youtube.com',
            'referer': 'https://music.youtube.com/',
            'x-youtube-client-name': '67',
            'x-youtube-client-version': '1.20260707.12.00'
          };
          
          let allTracks: any[] = [];
          let continuationToken: string | null = null;
          
          await api.Settings.set('syncStatus', 'Fetching page 1...');
          if (api.Logger) api.Logger.info("Fetching first page of liked tracks from YouTube Music...");
          
          const initialBody = {
            browseId: 'VLLM',
            context: {
              client: {
                clientName: 'WEB_REMIX',
                clientVersion: '1.20260711.01.00',
                hl: 'en'
              },
              user: {}
            }
          };
          
          const response = await api.Http.fetch('https://music.youtube.com/youtubei/v1/browse?alt=json', {
            method: 'POST',
            headers: parsedHeaders,
            body: JSON.stringify(initialBody)
          });
          
          if (response.status !== 200) {
            throw new Error(`Connection failed. HTTP status ${response.status}`);
          }
          
          const responseData = await response.json();
          const foundRenderers = findTracksRecursive(responseData);
          allTracks = allTracks.concat(foundRenderers);
          continuationToken = findContinuationToken(responseData);
          
          let pageCount = 1;
          while (continuationToken) {
            pageCount++;
            await api.Settings.set('syncStatus', `Fetching page ${pageCount}... (${allTracks.length} tracks found)`);
            if (api.Logger) api.Logger.info(`Fetching continuation page ${pageCount}... (${allTracks.length} tracks fetched so far)`);
            
            const continuationBody = {
              context: {
                client: {
                  clientName: 'WEB_REMIX',
                  clientVersion: '1.20260711.01.00',
                  hl: 'en'
                },
                user: {}
              }
            };
            
            const contUrl = `https://music.youtube.com/youtubei/v1/browse?alt=json&continuation=${continuationToken}&ctoken=${continuationToken}`;
            const contResponse = await api.Http.fetch(contUrl, {
              method: 'POST',
              headers: parsedHeaders,
              body: JSON.stringify(continuationBody)
            });
            
            if (contResponse.status !== 200) {
              if (api.Logger) api.Logger.warn(`Continuation fetch failed at page ${pageCount} with status ${contResponse.status}. Stopping search.`);
              break;
            }
            
            const contData = await contResponse.json();
            const contRenderers = findTracksRecursive(contData);
            
            if (contRenderers.length === 0) {
              break;
            }
            
            allTracks = allTracks.concat(contRenderers);
            continuationToken = findContinuationToken(contData);
          }
          
          await api.Settings.set('syncStatus', `Processing ${allTracks.length} tracks...`);
          if (api.Logger) api.Logger.info(`Fetched ${allTracks.length} raw track renderers from YouTube Music. Starting parsing...`);
          
          const parsedTracks: any[] = [];
          const nowIso = new Date().toISOString();
          
          for (const renderer of allTracks) {
            const parsed = parseTrackRenderer(renderer);
            if (parsed) {
              parsedTracks.push({
                id: generateUUID(),
                track: {
                  title: parsed.title,
                  artists: parsed.artists,
                  artwork: {
                    items: parsed.artworkItems
                  },
                  source: {
                    id: parsed.videoId,
                    provider: 'youtube'
                  }
                },
                addedAtIso: nowIso
              });
            }
          }
          
          if (parsedTracks.length === 0) {
            throw new Error("Could not parse any tracks. Check if your credentials are valid.");
          }
          
          const playlistToImport = {
            id: generateUUID(),
            name: "YouTube Liked Songs",
            createdAtIso: nowIso,
            lastModifiedIso: nowIso,
            isReadOnly: false,
            items: parsedTracks
          };
          
          await api.Settings.set('syncStatus', 'Importing into Nuclear...');
          if (api.Logger) api.Logger.info(`Starting import of ${parsedTracks.length} tracks into Nuclear playlists database...`);
          await api.Playlists.importPlaylist(playlistToImport);
          
          await api.Settings.set('syncStatus', `Success! Synced ${parsedTracks.length} songs.`);
          if (api.Logger) api.Logger.info(`[YouTube Sync Status] SUCCESS: Successfully synced and imported ${parsedTracks.length} tracks into local playlists!`);
        } catch (e: any) {
          if (api.Logger) api.Logger.error("Sync failed: " + e.message);
          await api.Settings.set('syncStatus', `Error: ${e.message}`);
        } finally {
          try {
            await api.Settings.set('syncTrigger', false);
          } catch (e) {}
        }
      }
    });
  },
  onEnable: async (api: NuclearPluginAPI) => {
    if (api.Logger) api.Logger.info("YouTube Liked Songs Sync Plugin Enabled!");
  },
  onDisable: async (api: NuclearPluginAPI) => {
    if (api.Logger) api.Logger.info("YouTube Liked Songs Sync Plugin Disabled!");
  }
};

export default youtubeLikedSongsSyncPlugin;
