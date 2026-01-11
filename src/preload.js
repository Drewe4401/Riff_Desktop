const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window Controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // Miniplayer Controls
    openMiniplayer: () => ipcRenderer.send('open-miniplayer'),
    closeMiniplayer: () => ipcRenderer.send('close-miniplayer'),
    closeApp: () => ipcRenderer.send('close-app'),
    expandToMain: () => ipcRenderer.send('expand-to-main'),
    miniplayerControl: (action) => ipcRenderer.send('miniplayer-control', action),
    miniplayerSeek: (percent) => ipcRenderer.send('miniplayer-seek', percent),
    requestPlaybackState: () => ipcRenderer.send('request-playback-state'),
    sendPlaybackState: (state) => ipcRenderer.send('send-playback-state', state),
    sendProgressUpdate: (data) => ipcRenderer.send('send-progress-update', data),
    isMiniplayerOpen: () => ipcRenderer.invoke('is-miniplayer-open'),

    // Miniplayer listeners (for miniplayer window)
    onPlaybackState: (callback) => {
        ipcRenderer.on('playback-state', (event, state) => callback(state));
    },
    onProgressUpdate: (callback) => {
        ipcRenderer.on('progress-update', (event, data) => callback(data));
    },

    // Main window listeners (for receiving miniplayer commands)
    onMiniplayerControl: (callback) => {
        ipcRenderer.on('miniplayer-control', (event, action) => callback(action));
    },
    onMiniplayerSeek: (callback) => {
        ipcRenderer.on('miniplayer-seek', (event, percent) => callback(percent));
    },
    onRequestPlaybackState: (callback) => {
        ipcRenderer.on('request-playback-state', () => callback());
    },
    onMiniplayerClosed: (callback) => {
        ipcRenderer.on('miniplayer-closed', () => callback());
    },

    // Spotify
    search: (query) => ipcRenderer.invoke('spotify-search', query),
    getTrack: (trackId) => ipcRenderer.invoke('spotify-get-track', trackId),

    // Playlists
    getPlaylists: () => ipcRenderer.invoke('playlist-get-all'),
    getPlaylist: (playlistId) => ipcRenderer.invoke('playlist-get', playlistId),
    createPlaylist: (name) => ipcRenderer.invoke('playlist-create', name),
    deletePlaylist: (playlistId) => ipcRenderer.invoke('playlist-delete', playlistId),
    addToPlaylist: (playlistId, track) => ipcRenderer.invoke('playlist-add-track', { playlistId, track }),
    removeFromPlaylist: (playlistId, trackId) => ipcRenderer.invoke('playlist-remove-track', { playlistId, trackId }),
    toggleLike: (track) => ipcRenderer.invoke('playlist-toggle-like', track),
    isLiked: (trackId) => ipcRenderer.invoke('playlist-is-liked', trackId),
    setPlaylistCover: (playlistId) => ipcRenderer.invoke('playlist-set-cover', playlistId),

    // Downloads
    downloadTrack: (track) => ipcRenderer.invoke('download-track', track),
    cancelDownload: (trackId) => ipcRenderer.invoke('download-cancel', trackId),
    deleteDownload: (trackId) => ipcRenderer.invoke('download-delete', trackId),
    isDownloaded: (trackId) => ipcRenderer.invoke('download-is-downloaded', trackId),
    getDownloads: () => ipcRenderer.invoke('download-get-all'),
    getDownloadPath: (trackId) => ipcRenderer.invoke('download-get-path', trackId),
    openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),

    // Download progress listener
    onDownloadProgress: (callback) => {
        ipcRenderer.on('download-progress', (event, progress) => callback(progress));
    },
    removeDownloadProgressListener: () => {
        ipcRenderer.removeAllListeners('download-progress');
    },

    // YouTube Import
    importFromYouTube: (youtubeUrl) => ipcRenderer.invoke('import-youtube', youtubeUrl),
    onYouTubeImportProgress: (callback) => {
        ipcRenderer.on('youtube-import-progress', (event, progress) => callback(progress));
    },
    removeYouTubeImportListener: () => {
        ipcRenderer.removeAllListeners('youtube-import-progress');
    },

    // Settings
    getSpotifyCredentials: () => ipcRenderer.invoke('settings-get-credentials'),
    saveSpotifyCredentials: (clientId, clientSecret) => ipcRenderer.invoke('settings-save-credentials', { clientId, clientSecret }),
    validateSpotifyCredentials: (clientId, clientSecret) => ipcRenderer.invoke('settings-validate-credentials', { clientId, clientSecret }),
    hasSpotifyCredentials: () => ipcRenderer.invoke('settings-has-credentials'),
    clearSpotifyCredentials: () => ipcRenderer.invoke('settings-clear-credentials')
});

