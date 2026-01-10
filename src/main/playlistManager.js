const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class PlaylistManager {
    constructor() {
        this.dataPath = null;
        this.playlists = {};
    }

    initialize() {
        // Store playlists in user data directory
        const userDataPath = app.getPath('userData');
        this.dataPath = path.join(userDataPath, 'playlists.json');
        this.loadPlaylists();
    }

    loadPlaylists() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf8');
                this.playlists = JSON.parse(data);
            } else {
                this.playlists = {};
            }

            // Ensure default playlists exist
            let changed = false;

            if (!this.playlists['Liked Songs']) {
                this.playlists['Liked Songs'] = {
                    id: 'liked-songs',
                    name: 'Liked Songs',
                    tracks: [],
                    createdAt: Date.now(),
                    isDefault: true
                };
                changed = true;
            }

            if (!this.playlists['Downloads']) {
                this.playlists['Downloads'] = {
                    id: 'downloads',
                    name: 'Downloads',
                    tracks: [],
                    createdAt: Date.now(),
                    isDefault: true
                };
                changed = true;
            }

            if (changed) {
                this.savePlaylists();
            }

        } catch (error) {
            console.error('Error loading playlists:', error);
            this.playlists = {};
        }
    }

    savePlaylists() {
        try {
            fs.writeFileSync(this.dataPath, JSON.stringify(this.playlists, null, 2));
        } catch (error) {
            console.error('Error saving playlists:', error);
            throw error;
        }
    }

    getPlaylists() {
        return Object.values(this.playlists).map(p => ({
            id: p.id,
            name: p.name,
            trackCount: p.tracks.length,
            createdAt: p.createdAt,
            isDefault: p.isDefault || false,
            customCover: p.customCover || null,
            firstTrackImage: p.tracks.length > 0 ? (p.tracks[0].album?.images?.[0]?.url || p.tracks[0].thumbnailUrl) : null
        }));
    }

    setPlaylistCover(playlistId, coverPath) {
        const playlist = Object.values(this.playlists).find(p => p.id === playlistId);
        if (!playlist) {
            throw new Error('Playlist not found');
        }
        playlist.customCover = coverPath;
        this.savePlaylists();
        return { success: true, coverPath };
    }

    getPlaylist(playlistId) {
        const playlist = Object.values(this.playlists).find(p => p.id === playlistId);
        if (!playlist) {
            throw new Error('Playlist not found');
        }
        return playlist;
    }

    createPlaylist(name) {
        if (this.playlists[name]) {
            throw new Error('Playlist already exists');
        }

        const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

        this.playlists[name] = {
            id,
            name,
            tracks: [],
            createdAt: Date.now(),
            isDefault: false,
            customCover: null
        };

        this.savePlaylists();
        return this.playlists[name];
    }

    deletePlaylist(playlistId) {
        const playlist = Object.values(this.playlists).find(p => p.id === playlistId);
        if (!playlist) {
            throw new Error('Playlist not found');
        }
        if (playlist.isDefault) {
            throw new Error('Cannot delete default playlist');
        }

        delete this.playlists[playlist.name];
        this.savePlaylists();
        return { success: true };
    }

    addTrack(playlistId, track) {
        const playlist = Object.values(this.playlists).find(p => p.id === playlistId);
        if (!playlist) {
            throw new Error('Playlist not found');
        }

        // Check if track already exists
        const exists = playlist.tracks.some(t => t.id === track.id);
        if (exists) {
            return { success: false, message: 'Track already in playlist' };
        }

        playlist.tracks.push({
            ...track,
            addedAt: Date.now()
        });

        this.savePlaylists();
        return { success: true, message: 'Track added to playlist' };
    }

    removeTrack(playlistId, trackId) {
        const playlist = Object.values(this.playlists).find(p => p.id === playlistId);
        if (!playlist) {
            throw new Error('Playlist not found');
        }

        const index = playlist.tracks.findIndex(t => t.id === trackId);
        if (index === -1) {
            throw new Error('Track not found in playlist');
        }

        playlist.tracks.splice(index, 1);
        this.savePlaylists();
        return { success: true };
    }

    removeTrackFromAllPlaylists(trackId) {
        let removedFromAny = false;
        Object.values(this.playlists).forEach(playlist => {
            const index = playlist.tracks.findIndex(t => t.id === trackId);
            if (index !== -1) {
                playlist.tracks.splice(index, 1);
                removedFromAny = true;
            }
        });

        if (removedFromAny) {
            this.savePlaylists();
        }
        return { success: true, removed: removedFromAny };
    }

    isTrackInPlaylist(playlistId, trackId) {
        const playlist = Object.values(this.playlists).find(p => p.id === playlistId);
        if (!playlist) return false;
        return playlist.tracks.some(t => t.id === trackId);
    }

    // Get all liked/saved tracks
    getLikedTracks() {
        const likedPlaylist = this.playlists['Liked Songs'];
        return likedPlaylist ? likedPlaylist.tracks : [];
    }

    // Toggle like on a track
    toggleLike(track) {
        const likedPlaylist = this.playlists['Liked Songs'];
        if (!likedPlaylist) {
            this.playlists['Liked Songs'] = {
                id: 'liked-songs',
                name: 'Liked Songs',
                tracks: [],
                createdAt: Date.now(),
                isDefault: true
            };
        }

        const index = this.playlists['Liked Songs'].tracks.findIndex(t => t.id === track.id);

        if (index === -1) {
            this.playlists['Liked Songs'].tracks.push({
                ...track,
                addedAt: Date.now()
            });
            this.savePlaylists();
            return { liked: true };
        } else {
            this.playlists['Liked Songs'].tracks.splice(index, 1);
            this.savePlaylists();
            return { liked: false };
        }
    }

    isLiked(trackId) {
        const likedPlaylist = this.playlists['Liked Songs'];
        if (!likedPlaylist) return false;
        return likedPlaylist.tracks.some(t => t.id === trackId);
    }
}

module.exports = new PlaylistManager();
