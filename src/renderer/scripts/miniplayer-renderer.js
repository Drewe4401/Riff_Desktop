// ==================== MINIPLAYER RENDERER ====================
// This script handles the miniplayer window's UI and communication with the main process

document.addEventListener('DOMContentLoaded', () => {
    console.log('Miniplayer initialized');

    // Window Controls
    const closeBtn = document.getElementById('close-btn');

    closeBtn?.addEventListener('click', () => {
        // Open main window and close miniplayer
        window.electronAPI.expandToMain();
    });

    // Request initial state and playlists from main window
    window.electronAPI.requestPlaybackState();
    loadPlaylists();
});

// ==================== DOM ELEMENTS ====================
const trackSection = document.getElementById('track-section');
const albumArt = document.getElementById('album-art');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const loopBtn = document.getElementById('loop-btn');
const miniplayer = document.getElementById('miniplayer');

// Volume elements
const volumeBtn = document.getElementById('volume-btn');
const volumeIcon = document.getElementById('volume-icon');
const volumeSlider = document.getElementById('volume-slider');
const volumeFill = document.getElementById('volume-fill');

// Playlist elements
const playlistBtn = document.getElementById('playlist-btn');
const playlistDropdown = document.getElementById('playlist-dropdown');
const playlistList = document.getElementById('playlist-list');

// ==================== PLAYBACK STATE ====================
let isPlaying = false;
let currentProgress = 0;
let duration = 0;
let currentVolume = 0.8;
let previousVolume = 0.8;

// ==================== CONTROL HANDLERS ====================
playPauseBtn?.addEventListener('click', () => {
    window.electronAPI.miniplayerControl('toggle-play');
});

prevBtn?.addEventListener('click', () => {
    window.electronAPI.miniplayerControl('prev');
});

nextBtn?.addEventListener('click', () => {
    window.electronAPI.miniplayerControl('next');
});

shuffleBtn?.addEventListener('click', () => {
    window.electronAPI.miniplayerControl('shuffle');
});

loopBtn?.addEventListener('click', () => {
    window.electronAPI.miniplayerControl('loop');
});

// Progress bar seek
progressBar?.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    window.electronAPI.miniplayerSeek(percent);
});

// ==================== PLAYLIST DROPDOWN ====================
playlistBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    playlistDropdown?.classList.toggle('show');
    if (playlistDropdown?.classList.contains('show')) {
        loadPlaylists();
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#playlist-dropdown') && !e.target.closest('#playlist-btn')) {
        playlistDropdown?.classList.remove('show');
    }
});

async function loadPlaylists() {
    try {
        const result = await window.electronAPI.getPlaylists();
        if (result.success && result.playlists) {
            renderPlaylists(result.playlists);
        }
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
}

function renderPlaylists(playlists) {
    if (!playlistList) return;

    // Sort playlists: Downloads -> Liked Songs -> Alphabetical
    playlists.sort((a, b) => {
        if (a.id === 'downloads') return -2;
        if (b.id === 'downloads') return 2;
        if (a.id === 'liked-songs') return -1;
        if (b.id === 'liked-songs') return 1;
        return a.name.localeCompare(b.name);
    });

    playlistList.innerHTML = playlists.map(playlist => `
        <div class="playlist-item" data-playlist-id="${playlist.id}">
            <span class="playlist-item-name">${playlist.name}</span>
            <span class="playlist-item-count">${playlist.trackCount || 0}</span>
        </div>
    `).join('');

    // Add click handlers
    playlistList.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', () => {
            const playlistId = item.dataset.playlistId;
            playPlaylist(playlistId);
            playlistDropdown?.classList.remove('show');
        });
    });
}

async function playPlaylist(playlistId) {
    try {
        // Send command to main window to play the playlist
        window.electronAPI.miniplayerControl(`play-playlist:${playlistId}`);
    } catch (error) {
        console.error('Error playing playlist:', error);
    }
}

// ==================== VOLUME CONTROL ====================
volumeSlider?.addEventListener('click', (e) => {
    const rect = volumeSlider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(percent);
});

volumeBtn?.addEventListener('click', () => {
    // Toggle mute
    if (currentVolume > 0) {
        previousVolume = currentVolume;
        setVolume(0);
    } else {
        setVolume(previousVolume || 0.5);
    }
});

function setVolume(percent) {
    currentVolume = percent;
    if (volumeFill) {
        volumeFill.style.width = `${percent * 100}%`;
    }
    updateVolumeIcon();
    // Send volume change to main window
    window.electronAPI.miniplayerControl(`volume:${percent}`);
}

function updateVolumeIcon() {
    if (!volumeIcon) return;

    if (currentVolume === 0) {
        // Muted icon
        volumeIcon.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15" stroke-width="2"></line>
            <line x1="17" y1="9" x2="23" y2="15" stroke-width="2"></line>
        `;
    } else if (currentVolume < 0.5) {
        // Low volume icon
        volumeIcon.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        `;
    } else {
        // High volume icon
        volumeIcon.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        `;
    }
}

// ==================== STATE UPDATES FROM MAIN ====================
window.electronAPI.onPlaybackState((state) => {
    updateUI(state);
});

window.electronAPI.onProgressUpdate((data) => {
    currentProgress = data.currentTime;
    duration = data.duration;
    updateProgress(data.currentTime, data.duration);
});

// ==================== UI UPDATE FUNCTIONS ====================
function updateUI(state) {
    if (!state) return;

    // Update track info
    if (state.track) {
        trackTitle.textContent = state.track.name || 'No Track Playing';
        trackArtist.textContent = state.track.artistNames || 'Select a track to play';

        const imageUrl = state.track.album?.images?.[0]?.url || '';
        if (imageUrl) {
            albumArt.style.backgroundImage = `url('${imageUrl}')`;
        } else {
            albumArt.style.backgroundImage = 'none';
        }
    } else {
        trackTitle.textContent = 'No Track Playing';
        trackArtist.textContent = 'Select a track to play';
        albumArt.style.backgroundImage = 'none';
    }

    // Update playing state
    isPlaying = state.isPlaying;
    updatePlayButton();

    // Update playing animation
    if (isPlaying) {
        miniplayer.classList.add('playing');
    } else {
        miniplayer.classList.remove('playing');
    }

    // Update shuffle/loop states
    if (state.isShuffleEnabled !== undefined) {
        updateShuffleButton(state.isShuffleEnabled);
    }
    if (state.loopMode !== undefined) {
        updateLoopButton(state.loopMode);
    }

    // Update progress
    if (state.currentTime !== undefined && state.duration !== undefined) {
        updateProgress(state.currentTime, state.duration);
    }

    // Update volume
    if (state.volume !== undefined) {
        currentVolume = state.volume;
        if (volumeFill) {
            volumeFill.style.width = `${currentVolume * 100}%`;
        }
        updateVolumeIcon();
    }
}

function updatePlayButton() {
    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

function updateProgress(current, total) {
    if (total > 0) {
        const percent = (current / total) * 100;
        progressFill.style.width = `${percent}%`;
    } else {
        progressFill.style.width = '0%';
    }

    timeCurrent.textContent = formatTime(current);
    timeTotal.textContent = formatTime(total);
}

function updateShuffleButton(enabled) {
    if (enabled) {
        shuffleBtn?.classList.add('active');
    } else {
        shuffleBtn?.classList.remove('active');
    }
}

function updateLoopButton(mode) {
    if (mode === 'off') {
        loopBtn?.classList.remove('active');
    } else {
        loopBtn?.classList.add('active');
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
