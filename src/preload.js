const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window Controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

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
    }
});
