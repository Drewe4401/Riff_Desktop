const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const playlistManager = require('./playlistManager');

class DownloadManager {
    constructor() {
        this.downloadPath = null;
        this.downloads = new Map(); // Active downloads
        this.downloadedTracks = new Map(); // Track ID -> { filePath, track metadata }
        this.metadataPath = null;
    }

    initialize() {
        // Store downloads in user's Music folder
        const musicPath = app.getPath('music');
        this.downloadPath = path.join(musicPath, 'Riff');

        // Create download directory if it doesn't exist
        if (!fs.existsSync(this.downloadPath)) {
            fs.mkdirSync(this.downloadPath, { recursive: true });
        }

        // Load metadata about downloaded tracks
        const userDataPath = app.getPath('userData');
        this.metadataPath = path.join(userDataPath, 'downloads.json');
        this.loadMetadata();
    }

    loadMetadata() {
        try {
            if (fs.existsSync(this.metadataPath)) {
                const data = JSON.parse(fs.readFileSync(this.metadataPath, 'utf8'));

                // Handle both old format (just path string) and new format (object with metadata)
                for (const [trackId, value] of Object.entries(data)) {
                    if (typeof value === 'string') {
                        // Old format - just file path
                        if (fs.existsSync(value)) {
                            this.downloadedTracks.set(trackId, { filePath: value, track: null });
                        }
                    } else if (value && value.filePath) {
                        // New format - has track metadata
                        if (fs.existsSync(value.filePath)) {
                            this.downloadedTracks.set(trackId, value);
                        }
                    }
                }
                this.saveMetadata();
            }
        } catch (error) {
            console.error('Error loading download metadata:', error);
            this.downloadedTracks = new Map();
        }
    }

    saveMetadata() {
        try {
            const data = {};
            for (const [trackId, value] of this.downloadedTracks) {
                data[trackId] = value;
            }
            fs.writeFileSync(this.metadataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving download metadata:', error);
        }
    }

    isDownloaded(trackId) {
        return this.downloadedTracks.has(trackId);
    }

    getDownloadPath(trackId) {
        const data = this.downloadedTracks.get(trackId);
        return data ? data.filePath : null;
    }

    getDownloadedTracks() {
        const tracks = [];
        for (const [id, data] of this.downloadedTracks) {
            if (data.track) {
                tracks.push({
                    ...data.track,
                    id,
                    filePath: data.filePath,
                    isDownloaded: true
                });
            } else {
                // Old format without metadata - just return basic info
                tracks.push({
                    id,
                    name: path.basename(data.filePath, path.extname(data.filePath)),
                    artistNames: 'Unknown Artist',
                    filePath: data.filePath,
                    isDownloaded: true
                });
            }
        }
        return tracks;
    }

    // Download track using yt-dlp
    async downloadTrack(track, onProgress) {
        const trackId = track.id;

        // Check if already downloaded
        if (this.isDownloaded(trackId)) {
            return {
                success: true,
                message: 'Track already downloaded',
                filePath: this.getDownloadPath(trackId)
            };
        }

        // Check if already downloading
        if (this.downloads.has(trackId)) {
            return { success: false, message: 'Download already in progress' };
        }

        // Create search query for YouTube
        const searchQuery = `${track.name} ${track.artistNames} audio`;
        const safeFileName = this.sanitizeFileName(`${track.artistNames} - ${track.name}`);
        const outputPath = path.join(this.downloadPath, `${safeFileName}.mp3`);

        return new Promise((resolve, reject) => {
            // Get path to bundled ffmpeg
            let ffmpegPath;
            if (app.isPackaged) {
                ffmpegPath = path.join(process.resourcesPath, 'FFMPEG/bin');
            } else {
                ffmpegPath = path.join(__dirname, '../../FFMPEG/bin');
            }

            // Use yt-dlp to search and download from YouTube
            const args = [
                `ytsearch1:${searchQuery}`,  // Search YouTube
                '-x',                          // Extract audio
                '--audio-format', 'mp3',       // Convert to MP3
                '--audio-quality', '0',        // Best quality
                '-o', outputPath,              // Output path
                '--no-playlist',               // Don't download playlists
                '--embed-thumbnail',           // Embed thumbnail
                '--add-metadata',              // Add metadata
                '--ffmpeg-location', ffmpegPath, // Use local ffmpeg
                '--progress',                  // Show progress
                '--newline'                    // Progress on new lines
            ];

            console.log(`Starting download: ${searchQuery}`);

            const process = spawn('yt-dlp', args);

            this.downloads.set(trackId, {
                process,
                track,
                progress: 0,
                status: 'downloading'
            });

            let lastProgress = 0;

            process.stdout.on('data', (data) => {
                const output = data.toString();
                console.log('yt-dlp:', output);

                // Parse progress from yt-dlp output
                const progressMatch = output.match(/(\d+\.?\d*)%/);
                if (progressMatch) {
                    const progress = parseFloat(progressMatch[1]);
                    if (progress !== lastProgress) {
                        lastProgress = progress;
                        if (onProgress) {
                            onProgress({ trackId, progress, status: 'downloading' });
                        }
                    }
                }
            });

            process.stderr.on('data', (data) => {
                console.error('yt-dlp error:', data.toString());
            });

            process.on('close', (code) => {
                this.downloads.delete(trackId);

                if (code === 0) {
                    // Success - find the actual downloaded file
                    // yt-dlp might add extensions or modify filename
                    const files = fs.readdirSync(this.downloadPath);
                    const audioExtensions = ['.mp3', '.m4a', '.webm', '.opus', '.ogg', '.wav'];
                    const downloadedFile = files.find(f =>
                        f.startsWith(safeFileName) && audioExtensions.some(ext => f.endsWith(ext))
                    );

                    if (downloadedFile) {
                        const finalPath = path.join(this.downloadPath, downloadedFile);
                        // Store both file path and track metadata
                        this.downloadedTracks.set(trackId, {
                            filePath: finalPath,
                            track: track,
                            downloadedAt: Date.now()
                        });
                        this.saveMetadata();

                        // Add to Downloads playlist with local file path
                        try {
                            const downloadedTrack = {
                                ...track,
                                filePath: finalPath,
                                isDownloaded: true,
                                downloadedAt: Date.now()
                            };
                            playlistManager.addTrack('downloads', downloadedTrack);
                        } catch (error) {
                            console.error('Error adding to Downloads playlist:', error);
                        }

                        if (onProgress) {
                            onProgress({ trackId, progress: 100, status: 'complete' });
                        }

                        resolve({
                            success: true,
                            message: 'Download complete',
                            filePath: finalPath
                        });
                    } else {
                        reject(new Error('Download completed but file not found'));
                    }
                } else {
                    if (onProgress) {
                        onProgress({ trackId, progress: 0, status: 'error' });
                    }
                    reject(new Error(`Download failed with code ${code}`));
                }
            });

            process.on('error', (error) => {
                this.downloads.delete(trackId);

                if (error.code === 'ENOENT') {
                    reject(new Error('yt-dlp not found. Please install yt-dlp: https://github.com/yt-dlp/yt-dlp'));
                } else {
                    reject(error);
                }
            });
        });
    }

    cancelDownload(trackId) {
        const download = this.downloads.get(trackId);
        if (download) {
            download.process.kill();
            this.downloads.delete(trackId);
            return { success: true };
        }
        return { success: false, message: 'Download not found' };
    }

    deleteDownload(trackId) {
        const data = this.downloadedTracks.get(trackId);
        if (!data) {
            return { success: false, message: 'Track not found in downloads' };
        }

        const filePath = typeof data === 'string' ? data : data.filePath;
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            this.downloadedTracks.delete(trackId);
            this.saveMetadata();
            try {
                playlistManager.removeTrack('downloads', trackId);
            } catch (error) {
                console.error('Error removing from downloads playlist:', error);
            }
            return { success: true };
        }

        // File doesn't exist but clean up the entry anyway
        this.downloadedTracks.delete(trackId);
        this.saveMetadata();
        try {
            playlistManager.removeTrack('downloads', trackId);
        } catch (error) {
            console.error('Error removing from downloads playlist:', error);
        }
        return { success: true, message: 'Entry removed (file was already deleted)' };
    }

    sanitizeFileName(name) {
        return name
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 200);
    }

    getActiveDownloads() {
        return Array.from(this.downloads.entries()).map(([id, data]) => ({
            id,
            track: data.track,
            progress: data.progress,
            status: data.status
        }));
    }
}

module.exports = new DownloadManager();
