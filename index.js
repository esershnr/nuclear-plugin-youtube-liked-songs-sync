function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function findTracksRecursive(obj, tracksList = []) {
  if (!obj || typeof obj !== 'object') return tracksList;
  
  if (obj.musicResponsiveListItemRenderer) {
    tracksList.push(obj.musicResponsiveListItemRenderer);
  } else {
    for (let key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        findTracksRecursive(obj[key], tracksList);
      }
    }
  }
  return tracksList;
}

function findContinuationToken(obj) {
  if (!obj || typeof obj !== 'object') return null;
  
  if (obj.continuationCommand && obj.continuationCommand.token) {
    return obj.continuationCommand.token;
  }
  if (obj.nextContinuationData && obj.nextContinuationData.continuation) {
    return obj.nextContinuationData.continuation;
  }
  
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const token = findContinuationToken(obj[key]);
      if (token) return token;
    }
  }
  return null;
}

function parseTrackRenderer(renderer) {
  let videoId = null;
  if (renderer.playlistItemData && renderer.playlistItemData.videoId) {
    videoId = renderer.playlistItemData.videoId;
  } else {
    const str = JSON.stringify(renderer);
    const watchMatch = str.match(/"videoId"\s*:\s*"([^"]+)"/);
    if (watchMatch) videoId = watchMatch[1];
  }
  
  if (!videoId) return null;
  
  let title = "Unknown Title";
  let artists = [];
  
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
        for (let run of runs) {
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
  
  let artworkItems = [];
  try {
    if (renderer.thumbnail && renderer.thumbnail.musicThumbnailRenderer) {
      const thumbnails = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails || [];
      artworkItems = thumbnails.map(t => ({
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

module.exports = {
  onLoad: async function(api) {
    if (api.Logger) api.Logger.info("Youtube Liked Songs Sync Plugin Loaded!");
    
    try {
      await api.Settings.register([
        {
          id: 'ytCookie',
          title: 'YouTube Music Cookie',
          description: 'Steps: 1. Open music.youtube.com & log in. 2. Press F12, go to Network tab. 3. Refresh page, type "/browse" in filter. 4. Click a browse POST request. 5. Copy the value of the "cookie" header from Request Headers.',
          category: 'Youtube Liked Songs Sync',
          kind: 'string',
          default: ''
        },
        {
          id: 'ytAuth',
          title: 'YouTube Music Authorization',
          description: 'Steps: Copy the value of the "authorization" header (starts with "SAPISIDHASH") from the same "/browse" Request Headers in the Network tab.',
          category: 'Youtube Liked Songs Sync',
          kind: 'string',
          default: ''
        },
        {
          id: 'syncStatus',
          title: 'Sync Status',
          description: 'Status of the latest sync process.',
          category: 'Youtube Liked Songs Sync',
          kind: 'string',
          default: 'Ready'
        },
        {
          id: 'syncTrigger',
          title: 'Sync Liked Songs Now',
          description: 'Toggle this switch to start syncing your YouTube Music Liked Songs directly.',
          category: 'Youtube Liked Songs Sync',
          kind: 'boolean',
          default: false,
          widget: { type: 'toggle' }
        }
      ]);
    } catch (e) {
      if (api.Logger) api.Logger.error("Failed to register settings: " + e.message);
    }
    
    api.Settings.subscribe('syncTrigger', async (value) => {
      if (value === true) {
        if (api.Logger) api.Logger.info("Starting YouTube Music Sync directly in JS...");
        
        try {
          await api.Settings.set('syncStatus', 'Preparing headers...');
          
          const ytCookie = await api.Settings.get('ytCookie');
          const ytAuth = await api.Settings.get('ytAuth');
          
          if (!ytCookie || ytCookie.trim() === '') {
            throw new Error("Cookie is empty! Please paste your YouTube Music cookie first.");
          }
          if (!ytAuth || ytAuth.trim() === '') {
            throw new Error("Authorization is empty! Please paste your YouTube Music authorization first.");
          }
          
          const parsedHeaders = {
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
          
          let allTracks = [];
          let continuationToken = null;
          
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
          let foundRenderers = findTracksRecursive(responseData);
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
          if (api.Logger) api.Logger.info(`Successfully fetched ${allTracks.length} tracks. Starting track parser...`);
          
          const parsedTracks = [];
          const nowIso = new Date().toISOString();
          
          for (let renderer of allTracks) {
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
          if (api.Logger) api.Logger.info("Importing parsed tracks into local playlist library...");
          await api.Playlists.importPlaylist(playlistToImport);
          
          await api.Settings.set('syncStatus', `Success! Synced ${parsedTracks.length} songs.`);
          if (api.Logger) api.Logger.info(`Sync completed successfully! Imported ${parsedTracks.length} tracks.`);
        } catch (e) {
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
  onEnable: async function(api) {
    if (api.Logger) api.Logger.info("Youtube Liked Songs Sync Plugin Enabled!");
  },
  onDisable: async function(api) {
    if (api.Logger) api.Logger.info("Youtube Liked Songs Sync Plugin Disabled!");
  }
};
