const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const spotifyService = require('./spotify');
const playlistManager = require('./playlistManager');
const downloadManager = require('./downloadManager');

let mainWindow = null;
let miniplayerWindow = null;

// ==================== MINIPLAYER POSITION PERSISTENCE ====================
const getMiniplayerSettingsPath = () => {
    return path.join(app.getPath('userData'), 'miniplayer-settings.json');
};

const saveMiniplayerPosition = () => {
    if (!miniplayerWindow || miniplayerWindow.isDestroyed()) return;

    try {
        const bounds = miniplayerWindow.getBounds();
        const settings = { x: bounds.x, y: bounds.y };
        fs.writeFileSync(getMiniplayerSettingsPath(), JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving miniplayer position:', error);
    }
};

const loadMiniplayerPosition = () => {
    try {
        const settingsPath = getMiniplayerSettingsPath();
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading miniplayer position:', error);
    }
    return null;
};

// ==================== MINIPLAYER WINDOW ====================
const createMiniplayerWindow = () => {
    if (miniplayerWindow) {
        miniplayerWindow.focus();
        return;
    }

    // Get the primary display's work area
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Default position (bottom-right corner)
    const miniWidth = 340;
    const miniHeight = 190;
    let xPos = screenWidth - miniWidth - 20;
    let yPos = screenHeight - miniHeight - 20;

    // Load saved position if available
    const savedPosition = loadMiniplayerPosition();
    if (savedPosition) {
        // Validate position is within screen bounds
        if (savedPosition.x >= 0 && savedPosition.x < screenWidth - 50 &&
            savedPosition.y >= 0 && savedPosition.y < screenHeight - 50) {
            xPos = savedPosition.x;
            yPos = savedPosition.y;
        }
    }

    miniplayerWindow = new BrowserWindow({
        width: miniWidth,
        height: miniHeight,
        x: xPos,
        y: yPos,
        frame: false,
        transparent: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        backgroundColor: '#0c0c0c',
        icon: path.join(__dirname, '../../build/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    });

    miniplayerWindow.loadFile(path.join(__dirname, '../renderer/miniplayer.html'));

    // Save position when window is moved
    miniplayerWindow.on('moved', () => {
        saveMiniplayerPosition();
    });

    // Save position before closing
    miniplayerWindow.on('close', () => {
        saveMiniplayerPosition();
    });

    miniplayerWindow.on('closed', () => {
        miniplayerWindow = null;
        // Show main window when miniplayer is closed and notify
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('miniplayer-closed');
        }
    });

    // Hide main window when miniplayer opens
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
    }
};

const closeMiniplayerWindow = (showMain = true) => {
    if (miniplayerWindow) {
        miniplayerWindow.close();
        miniplayerWindow = null;
    }
    // Show main window if requested
    if (showMain && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
    }
};

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        backgroundColor: '#0a0a0a',
        icon: path.join(__dirname, '../../build/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Initialize managers
    playlistManager.initialize();
    downloadManager.initialize();

    // Window Control IPC
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.restore();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('window-close', () => mainWindow.close());

    // ==================== MINIPLAYER IPC ====================

    // Open miniplayer from main window
    ipcMain.on('open-miniplayer', () => {
        createMiniplayerWindow();
    });

    // Close miniplayer
    ipcMain.on('close-miniplayer', () => {
        closeMiniplayerWindow();
    });

    // Close entire app (from miniplayer)
    ipcMain.on('close-app', () => {
        app.quit();
    });

    // Expand to main window (from miniplayer)
    ipcMain.on('expand-to-main', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
        }
        // Close miniplayer without trying to show main again (already shown above)
        if (miniplayerWindow) {
            miniplayerWindow.removeAllListeners('closed'); // Prevent double-show
            miniplayerWindow.close();
            miniplayerWindow = null;
        }
    });

    // Miniplayer control commands (forwarded to main window)
    ipcMain.on('miniplayer-control', (event, action) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('miniplayer-control', action);
        }
    });

    // Miniplayer seek (forwarded to main window)
    ipcMain.on('miniplayer-seek', (event, percent) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('miniplayer-seek', percent);
        }
    });

    // Request playback state from main window (called by miniplayer on init)
    ipcMain.on('request-playback-state', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('request-playback-state');
        }
    });

    // Send playback state to miniplayer
    ipcMain.on('send-playback-state', (event, state) => {
        if (miniplayerWindow && !miniplayerWindow.isDestroyed()) {
            miniplayerWindow.webContents.send('playback-state', state);
        }
    });

    // Send progress update to miniplayer
    ipcMain.on('send-progress-update', (event, data) => {
        if (miniplayerWindow && !miniplayerWindow.isDestroyed()) {
            miniplayerWindow.webContents.send('progress-update', data);
        }
    });

    // Check if miniplayer is open
    ipcMain.handle('is-miniplayer-open', () => {
        return miniplayerWindow !== null && !miniplayerWindow.isDestroyed();
    });

    // ==================== SPOTIFY IPC ====================

    ipcMain.handle('spotify-search', async (event, searchParams) => {
        try {
            // Support both string query and object with offset
            const query = typeof searchParams === 'string' ? searchParams : searchParams.query;
            const offset = typeof searchParams === 'object' ? (searchParams.offset || 0) : 0;
            const limit = typeof searchParams === 'object' ? (searchParams.limit || 30) : 30;

            const results = await spotifyService.search(query, 'track', limit, offset);

            if (results.tracks && results.tracks.items) {
                // Format tracks and add download/like status
                const formattedTracks = results.tracks.items.map(track => {
                    const formatted = spotifyService.formatTrack(track);
                    formatted.isDownloaded = downloadManager.isDownloaded(track.id);
                    formatted.isLiked = playlistManager.isLiked(track.id);
                    return formatted;
                });

                return {
                    success: true,
                    tracks: formattedTracks,
                    total: results.tracks.total,
                    offset: offset,
                    hasMore: offset + formattedTracks.length < results.tracks.total
                };
            }

            return { success: true, tracks: [], total: 0, hasMore: false };
        } catch (error) {
            console.error('Spotify Search Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('spotify-get-track', async (event, trackId) => {
        try {
            const track = await spotifyService.getTrack(trackId);
            const formatted = spotifyService.formatTrack(track);
            formatted.isDownloaded = downloadManager.isDownloaded(trackId);
            formatted.isLiked = playlistManager.isLiked(trackId);
            return { success: true, track: formatted };
        } catch (error) {
            console.error('Get Track Error:', error);
            return { success: false, error: error.message };
        }
    });

    // ==================== PLAYLIST IPC ====================

    ipcMain.handle('playlist-get-all', async () => {
        try {
            const playlists = playlistManager.getPlaylists();
            return { success: true, playlists };
        } catch (error) {
            console.error('Get Playlists Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('playlist-get', async (event, playlistId) => {
        try {
            const playlist = playlistManager.getPlaylist(playlistId);
            return { success: true, playlist };
        } catch (error) {
            console.error('Get Playlist Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('playlist-create', async (event, name) => {
        try {
            const playlist = playlistManager.createPlaylist(name);
            return { success: true, playlist };
        } catch (error) {
            console.error('Create Playlist Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('playlist-delete', async (event, playlistId) => {
        try {
            const result = playlistManager.deletePlaylist(playlistId);
            return { success: true, ...result };
        } catch (error) {
            console.error('Delete Playlist Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('playlist-add-track', async (event, { playlistId, track }) => {
        try {
            const result = playlistManager.addTrack(playlistId, track);
            return result;
        } catch (error) {
            console.error('Add Track Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('playlist-remove-track', async (event, { playlistId, trackId }) => {
        try {
            const result = playlistManager.removeTrack(playlistId, trackId);
            return result;
        } catch (error) {
            console.error('Remove Track Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('playlist-toggle-like', async (event, track) => {
        try {
            const result = playlistManager.toggleLike(track);
            return { success: true, ...result };
        } catch (error) {
            console.error('Toggle Like Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('playlist-set-cover', async (event, playlistId) => {
        try {
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'Select Playlist Cover',
                properties: ['openFile'],
                filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
            });

            if (filePaths.length === 0) {
                return { success: false, cancelled: true };
            }

            const sourcePath = filePaths[0];
            const userDataPath = app.getPath('userData');
            const coversDir = path.join(userDataPath, 'covers');

            // Create covers directory if needed
            const fs = require('fs');
            if (!fs.existsSync(coversDir)) {
                fs.mkdirSync(coversDir, { recursive: true });
            }

            // Copy file with unique name
            const ext = path.extname(sourcePath);
            const fileName = `${playlistId}-${Date.now()}${ext}`;
            const destPath = path.join(coversDir, fileName);

            fs.copyFileSync(sourcePath, destPath);

            // Update playlist
            const result = playlistManager.setPlaylistCover(playlistId, destPath);
            return result;
        } catch (error) {
            console.error('Set Playlist Cover Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('playlist-is-liked', async (event, trackId) => {
        try {
            const liked = playlistManager.isLiked(trackId);
            return { success: true, liked };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ==================== DOWNLOAD IPC ====================

    ipcMain.handle('download-track', async (event, track) => {
        try {
            const result = await downloadManager.downloadTrack(track, (progress) => {
                // Send progress updates to renderer
                mainWindow.webContents.send('download-progress', progress);
            });
            return result;
        } catch (error) {
            console.error('Download Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('download-cancel', async (event, trackId) => {
        try {
            const result = downloadManager.cancelDownload(trackId);
            return result;
        } catch (error) {
            console.error('Cancel Download Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('download-delete', async (event, trackId) => {
        try {
            const result = downloadManager.deleteDownload(trackId);
            return result;
        } catch (error) {
            console.error('Delete Download Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('download-is-downloaded', async (event, trackId) => {
        try {
            const downloaded = downloadManager.isDownloaded(trackId);
            const filePath = downloaded ? downloadManager.getDownloadPath(trackId) : null;
            return { success: true, downloaded, filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('download-get-all', async () => {
        try {
            const downloads = downloadManager.getDownloadedTracks();
            return { success: true, downloads };
        } catch (error) {
            console.error('Get Downloads Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('download-get-path', async (event, trackId) => {
        try {
            const filePath = downloadManager.getDownloadPath(trackId);
            return { success: true, filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Open downloads folder
    ipcMain.handle('open-downloads-folder', async () => {
        try {
            const { shell } = require('electron');
            shell.openPath(downloadManager.downloadPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Uncomment to open DevTools in dev mode
    // mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
