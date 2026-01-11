// ==================== WINDOW CONTROLS ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Riff...');

    const minBtn = document.getElementById('min-btn');
    const maxBtn = document.getElementById('max-btn');
    const closeBtn = document.getElementById('close-btn');

    if (window.electronAPI) {
        console.log('Electron API available');

        if (minBtn) {
            minBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.electronAPI.minimize();
            });
        }

        if (maxBtn) {
            maxBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.electronAPI.maximize();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.electronAPI.close();
            });
        }

        // Initialize download progress listener
        window.electronAPI.onDownloadProgress(handleDownloadProgress);
    } else {
        console.error('Electron API not available!');
    }

    // Load initial playlists
    loadPlaylists();
});

// ==================== SEARCH LOGIC ====================
const searchInput = document.getElementById('search-input');
const trackGrid = document.getElementById('track-grid');
const emptyState = document.querySelector('.empty-state');
const resultsArea = document.getElementById('results-area');
const contentArea = document.getElementById('content-area');

let debounceTimer;
let currentTracks = [];
let currentQuery = '';
let currentOffset = 0;
let hasMoreResults = false;
let isLoadingMore = false;

searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

    if (query.length === 0) {
        showEmptyState();
        currentQuery = '';
        currentOffset = 0;
        hasMoreResults = false;
        return;
    }

    if (query.length < 2) return;

    // Reset for new search
    currentQuery = query;
    currentOffset = 0;
    hasMoreResults = false;

    // Show loading state
    showLoadingState();

    debounceTimer = setTimeout(async () => {
        try {
            const result = await window.electronAPI.search({ query, offset: 0, limit: 30 });

            if (result.success) {
                currentTracks = result.tracks;
                hasMoreResults = result.hasMore;
                renderResults(result.tracks, false);
            } else if (result.needsCredentials) {
                showCredentialsRequired();
            } else {
                showError(result.error || 'Search failed');
            }
        } catch (error) {
            console.error('Search error:', error);
            showError('An error occurred while searching');
        }
    }, 400);
});

// Infinite scroll - load more when near bottom
contentArea?.addEventListener('scroll', () => {
    if (isLoadingMore || !hasMoreResults || !currentQuery) return;

    const scrollBottom = contentArea.scrollHeight - contentArea.scrollTop - contentArea.clientHeight;

    if (scrollBottom < 300) {
        loadMoreResults();
    }
});

async function loadMoreResults() {
    if (isLoadingMore || !hasMoreResults) return;

    isLoadingMore = true;
    currentOffset += 30;

    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'load-more-indicator';
    loadingIndicator.innerHTML = '<div class="loading-spinner"></div><span>Loading more...</span>';
    trackGrid.appendChild(loadingIndicator);

    try {
        const result = await window.electronAPI.search({
            query: currentQuery,
            offset: currentOffset,
            limit: 30
        });

        // Remove loading indicator
        loadingIndicator.remove();

        if (result.success && result.tracks.length > 0) {
            currentTracks = [...currentTracks, ...result.tracks];
            hasMoreResults = result.hasMore;

            // Append new tracks
            result.tracks.forEach(track => {
                const card = createTrackCard(track);
                trackGrid.appendChild(card);
            });
        } else {
            hasMoreResults = false;
        }
    } catch (error) {
        console.error('Load more error:', error);
        loadingIndicator.remove();
    } finally {
        isLoadingMore = false;
    }
}

function showEmptyState() {
    trackGrid.classList.add('hidden');
    trackGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = `
        <h2 class="text-2xl font-bold text-white mb-2 tracking-tight">Search for your favorite tracks</h2>
        <p class="text-base font-light">Find music from Spotify's entire library.</p>
    `;
}

function showLoadingState() {
    emptyState.classList.remove('hidden');
    trackGrid.classList.add('hidden');
    emptyState.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="loading-spinner"></div>
            <span class="text-text-muted">Searching...</span>
        </div>
    `;
}

function showError(message) {
    emptyState.classList.remove('hidden');
    trackGrid.classList.add('hidden');
    emptyState.innerHTML = `
        <div class="text-red-400 flex flex-col items-center gap-2">
            <svg class="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="font-medium">${message}</span>
            <button onclick="showEmptyState()" class="text-sm text-text-muted hover:text-white underline mt-2">Try again</button>
        </div>
    `;
}

function showCredentialsRequired() {
    emptyState.classList.remove('hidden');
    trackGrid.classList.add('hidden');
    emptyState.innerHTML = `
        <div class="credentials-required-card flex flex-col items-center gap-6 max-w-md mx-auto">
            <!-- Spotify Icon -->
            <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1DB954] to-[#1ed760] flex items-center justify-center shadow-2xl shadow-[#1DB954]/30 animate-pulse">
                <svg class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
            </div>
            
            <!-- Title & Description -->
            <div class="text-center">
                <h2 class="text-2xl font-bold text-white mb-2">Spotify API Required</h2>
                <p class="text-text-muted text-sm leading-relaxed">
                    To search and stream music, you need to connect your own Spotify API credentials. 
                    It only takes a minute to set up!
                </p>
            </div>
            
            <!-- Action Button -->
            <button id="go-to-settings-btn" class="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#1DB954] to-[#1ed760] text-black font-bold rounded-full hover:scale-105 transition-all shadow-lg shadow-[#1DB954]/30 hover:shadow-xl hover:shadow-[#1DB954]/40">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Open Settings
            </button>
            
            <!-- Help Text -->
            <p class="text-xs text-neutral-500 text-center">
                Your credentials are stored locally and never shared.
            </p>
        </div>
    `;

    // Add click handler
    document.getElementById('go-to-settings-btn')?.addEventListener('click', () => {
        switchView('settings');
    });
}

function renderResults(tracks, append = false) {
    if (!tracks || tracks.length === 0) {
        if (!append) {
            emptyState.classList.remove('hidden');
            trackGrid.classList.add('hidden');
            emptyState.innerHTML = `
                <h2 class="text-xl font-bold text-white mb-2">No results found</h2>
                <p class="text-base font-light text-text-muted">Try a different search term.</p>
            `;
        }
        return;
    }

    emptyState.classList.add('hidden');
    trackGrid.classList.remove('hidden');

    if (!append) {
        trackGrid.innerHTML = '';
    }

    tracks.forEach(track => {
        const card = createTrackCard(track);
        trackGrid.appendChild(card);
    });
}

function createTrackCard(track) {
    const card = document.createElement('div');
    card.className = 'track-card group';
    card.dataset.trackId = track.id;

    // Handle cover art
    let imageUrl = 'assets/placeholder.png';
    if (track.album?.images?.length > 0) {
        imageUrl = track.album.images[0].url;
    } else if (track.thumbnailUrl) {
        imageUrl = track.thumbnailUrl;
    }

    // Handle duration
    let duration = track.duration || '0:00';
    if (!track.duration && track.duration_ms) {
        const totalSeconds = Math.floor(track.duration_ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    const isDownloaded = track.isDownloaded;
    const isLiked = track.isLiked;

    card.innerHTML = `
        <div class="track-card-image">
            <img src="${imageUrl}" alt="${track.name}" loading="lazy">
            <div class="track-card-overlay">
                <button class="play-btn" title="Play">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
            </div>
            <div class="track-card-actions">
                <button class="action-btn like-btn ${isLiked ? 'active' : ''}" title="${isLiked ? 'Remove from Liked' : 'Add to Liked'}">
                    <svg class="w-4 h-4" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                </button>
                <button class="action-btn playlist-btn" title="Add to Playlist">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                </button>
                <button class="action-btn download-btn ${isDownloaded ? 'downloaded' : ''}" title="${isDownloaded ? 'Downloaded' : 'Download'}">
                    ${isDownloaded ? `
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                    ` : `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                    `}
                </button>
            </div>
            ${track.explicit ? '<span class="explicit-badge">E</span>' : ''}
        </div>
        <div class="track-card-info">
            <div class="track-name" title="${track.name}">${track.name}</div>
            <div class="track-artist" title="${track.artistNames}">${track.artistNames}</div>
            <div class="track-meta">
                <span class="track-duration">${duration}</span>
            </div>
        </div>
        <div class="download-progress hidden">
            <div class="download-progress-bar"></div>
        </div>
    `;

    // Event listeners
    const playBtn = card.querySelector('.play-btn');
    const likeBtn = card.querySelector('.like-btn');
    const playlistBtn = card.querySelector('.playlist-btn');
    const downloadBtn = card.querySelector('.download-btn');

    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playTrack(track);
    });

    likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLike(track, likeBtn);
    });

    playlistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPlaylistModal(track);
    });

    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!track.isDownloaded) {
            downloadTrack(track, card);
        }
    });

    // Click on card to play
    card.addEventListener('click', () => playTrack(track));

    return card;
}

// ==================== PLAYLIST LOGIC ====================
let playlists = [];

async function loadPlaylists() {
    try {
        const result = await window.electronAPI.getPlaylists();
        if (result.success) {
            playlists = result.playlists;
            updatePlaylistsSidebar();
        }
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
}

function updatePlaylistsSidebar() {
    const playlistList = document.querySelector('.playlist-nav ul');
    if (!playlistList) return;

    // Sort playlists: Downloads -> Liked Songs -> Alphabetical
    playlists.sort((a, b) => {
        if (a.id === 'downloads') return -2;
        if (b.id === 'downloads') return 2;
        if (a.id === 'liked-songs') return -1;
        if (b.id === 'liked-songs') return 1;
        return a.name.localeCompare(b.name);
    });

    const playlistItems = playlists.map(playlist => `
        <li class="sidebar-playlist-item p-2 text-sm text-text-muted hover:text-white cursor-pointer transition-colors duration-200 truncate rounded-md hover:bg-white/5 flex items-center justify-between group" data-playlist-id="${playlist.id}">
            <span class="truncate">${playlist.name}</span>
            <span class="text-xs text-text-muted/50 opacity-0 group-hover:opacity-100 transition-opacity">${playlist.trackCount}</span>
        </li>
    `).join('');

    playlistList.innerHTML = playlistItems;

    // Add click handlers to sidebar playlist items
    playlistList.querySelectorAll('.sidebar-playlist-item').forEach(item => {
        item.addEventListener('click', () => {
            const playlistId = item.dataset.playlistId;
            // Switch to Library view and open the playlist
            switchView('library');
            openPlaylistDetail(playlistId);
        });
    });
}

async function toggleLike(track, button) {
    try {
        const result = await window.electronAPI.toggleLike(track);
        if (result.success) {
            track.isLiked = result.liked;

            // Update button state
            if (result.liked) {
                button.classList.add('active');
                button.title = 'Remove from Liked';
                button.querySelector('svg').setAttribute('fill', 'currentColor');
                showToast('Added to Liked Songs', 'success');

                // Auto-download the track if not already downloaded
                if (!track.isDownloaded) {
                    const cardElement = button.closest('.track-card');
                    downloadTrack(track, cardElement);
                }
            } else {
                button.classList.remove('active');
                button.title = 'Add to Liked';
                button.querySelector('svg').setAttribute('fill', 'none');
                showToast('Removed from Liked Songs', 'info');
            }

            // Reload playlists to update count
            loadPlaylists();
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Failed to update', 'error');
    }
}

function showPlaylistModal(track) {
    // Remove existing modal
    const existingModal = document.getElementById('playlist-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'playlist-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add to Playlist</h3>
                <button class="modal-close">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="new-playlist-form">
                    <input type="text" id="new-playlist-name" placeholder="Create new playlist..." class="modal-input">
                    <button id="create-playlist-btn" class="btn-primary">Create</button>
                </div>
                <div class="playlist-list">
                    ${playlists.map(p => `
                        <div class="playlist-item" data-playlist-id="${p.id}">
                            <span class="playlist-name">${p.name}</span>
                            <span class="playlist-count">${p.trackCount} tracks</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Create new playlist
    const createBtn = modal.querySelector('#create-playlist-btn');
    const nameInput = modal.querySelector('#new-playlist-name');

    createBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (name) {
            try {
                const result = await window.electronAPI.createPlaylist(name);
                if (result.success) {
                    await loadPlaylists();
                    // Add track to the new playlist
                    await addToPlaylist(result.playlist.id, track);
                    modal.remove();
                    showToast(`Created "${name}" and added track`, 'success');
                } else {
                    showToast(result.error || 'Failed to create playlist', 'error');
                }
            } catch (error) {
                showToast('Failed to create playlist', 'error');
            }
        }
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createBtn.click();
    });

    // Add to existing playlist
    modal.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', async () => {
            const playlistId = item.dataset.playlistId;
            await addToPlaylist(playlistId, track);
            modal.remove();
        });
    });
}

async function addToPlaylist(playlistId, track) {
    try {
        const result = await window.electronAPI.addToPlaylist(playlistId, track);
        if (result.success) {
            showToast('Added to playlist', 'success');

            // Auto-download if not already downloaded
            if (!track.isDownloaded) {
                downloadTrack(track);
            }

            await loadPlaylists();

            // Refresh the playlist view if currently viewing this playlist
            if (currentPlaylistId === playlistId) {
                openPlaylistDetail(playlistId);
            }
        } else {
            showToast(result.message || 'Failed to add to playlist', 'error');
        }
    } catch (error) {
        console.error('Error adding to playlist:', error);
        showToast('Failed to add to playlist', 'error');
    }
}

// ==================== DOWNLOAD LOGIC ====================
const activeDownloads = new Map();

async function downloadTrack(track, cardElement) {
    if (activeDownloads.has(track.id)) return;

    // If no element provided, try to find it
    if (!cardElement) {
        cardElement = document.querySelector(`.track-card[data-track-id="${track.id}"]`);
    }

    activeDownloads.set(track.id, { track, element: cardElement });

    const progressContainer = cardElement?.querySelector('.download-progress');
    const progressBar = cardElement?.querySelector('.download-progress-bar');
    const downloadBtn = cardElement?.querySelector('.download-btn');

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (downloadBtn) downloadBtn.disabled = true;

    showToast(`Downloading "${track.name}"...`, 'info');

    try {
        const result = await window.electronAPI.downloadTrack(track);

        if (result.success) {
            track.isDownloaded = true;
            if (downloadBtn) {
                downloadBtn.classList.add('downloaded');
                downloadBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                `;
                downloadBtn.title = 'Downloaded';
            }
            showToast(`Downloaded "${track.name}"`, 'success');

            // If currently viewing downloads, refresh the list
            if (currentPlaylistId === 'downloads') {
                openPlaylistDetail('downloads');
            }
        } else {
            showToast(result.error || 'Download failed', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showToast(error.message || 'Download failed', 'error');
    } finally {
        activeDownloads.delete(track.id);
        if (progressContainer) progressContainer.classList.add('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (downloadBtn) downloadBtn.disabled = false;
    }
}

function handleDownloadProgress(data) {
    const download = activeDownloads.get(data.trackId);
    if (!download) return;

    if (download.element) {
        const progressBar = download.element.querySelector('.download-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${data.progress}%`;
        }
    }
}

// ==================== PLAYER LOGIC ====================
let currentAudio = new Audio();
let isPlaying = false;
let currentTrack = null;

// Queue system
let currentQueue = [];
let currentQueueIndex = -1;

// Shuffle and Loop state
let isShuffleEnabled = false;
let loopMode = 'off'; // 'off', 'all', 'one'
let originalQueue = []; // Store original queue order for un-shuffling

const playPauseBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const loopBtn = document.getElementById('loop-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const npTitle = document.getElementById('np-title');
const npArtist = document.getElementById('np-artist');
const npImage = document.getElementById('np-image-placeholder');
const progressFill = document.querySelector('.progress-fill');
const progressBar = document.querySelector('.progress-bar');
const timeCurrent = document.querySelector('.time-current');
const timeTotal = document.querySelector('.time-total');

playPauseBtn.addEventListener('click', togglePlay);

// Previous/Next track buttons
prevBtn?.addEventListener('click', playPreviousTrack);
nextBtn?.addEventListener('click', playNextTrack);

// Shuffle button
shuffleBtn?.addEventListener('click', toggleShuffle);

// Loop button
loopBtn?.addEventListener('click', toggleLoop);

// Toggle shuffle mode
function toggleShuffle() {
    isShuffleEnabled = !isShuffleEnabled;
    updateShuffleButton();

    if (isShuffleEnabled && currentQueue.length > 0) {
        // Save original queue before shuffling
        originalQueue = [...currentQueue];
        // Shuffle the queue (keeping current track in place)
        shuffleQueue();
        showToast('Shuffle enabled', 'info');
    } else if (!isShuffleEnabled && originalQueue.length > 0) {
        // Restore original queue order
        const currentTrackInQueue = currentQueue[currentQueueIndex];
        currentQueue = [...originalQueue];
        // Find current track in restored queue
        if (currentTrackInQueue) {
            currentQueueIndex = currentQueue.findIndex(t => t.id === currentTrackInQueue.id);
            if (currentQueueIndex === -1) currentQueueIndex = 0;
        }
        originalQueue = [];
        showToast('Shuffle disabled', 'info');
    }
}

// Shuffle the queue while keeping current track at current position
function shuffleQueue() {
    if (currentQueue.length <= 1) return;

    const currentTrackInQueue = currentQueue[currentQueueIndex];

    // Remove current track from queue
    const remainingTracks = currentQueue.filter((_, index) => index !== currentQueueIndex);

    // Fisher-Yates shuffle for remaining tracks
    for (let i = remainingTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingTracks[i], remainingTracks[j]] = [remainingTracks[j], remainingTracks[i]];
    }

    // Put current track at position 0, rest follows shuffled
    currentQueue = [currentTrackInQueue, ...remainingTracks];
    currentQueueIndex = 0;
}

// Update shuffle button visual state
function updateShuffleButton() {
    if (!shuffleBtn) return;

    if (isShuffleEnabled) {
        shuffleBtn.classList.add('active');
        shuffleBtn.classList.remove('text-text-muted');
        shuffleBtn.classList.add('text-accent-primary');
    } else {
        shuffleBtn.classList.remove('active');
        shuffleBtn.classList.add('text-text-muted');
        shuffleBtn.classList.remove('text-accent-primary');
    }
}

// Toggle loop mode: off -> all -> one -> off
function toggleLoop() {
    if (loopMode === 'off') {
        loopMode = 'all';
        showToast('Repeat all', 'info');
    } else if (loopMode === 'all') {
        loopMode = 'one';
        showToast('Repeat one', 'info');
    } else {
        loopMode = 'off';
        showToast('Repeat off', 'info');
    }
    updateLoopButton();
}

// Update loop button visual state
function updateLoopButton() {
    if (!loopBtn) return;

    const loopOneIndicator = loopBtn.querySelector('.loop-one-indicator');

    if (loopMode === 'off') {
        loopBtn.classList.remove('active');
        loopBtn.classList.add('text-text-muted');
        loopBtn.classList.remove('text-accent-primary');
        if (loopOneIndicator) loopOneIndicator.classList.add('hidden');
    } else if (loopMode === 'all') {
        loopBtn.classList.add('active');
        loopBtn.classList.remove('text-text-muted');
        loopBtn.classList.add('text-accent-primary');
        if (loopOneIndicator) loopOneIndicator.classList.add('hidden');
    } else if (loopMode === 'one') {
        loopBtn.classList.add('active');
        loopBtn.classList.remove('text-text-muted');
        loopBtn.classList.add('text-accent-primary');
        if (loopOneIndicator) loopOneIndicator.classList.remove('hidden');
    }
}

function playNextTrack() {
    if (currentQueue.length === 0) return;

    if (currentQueueIndex < currentQueue.length - 1) {
        currentQueueIndex++;
        playTrackFromQueue(currentQueue[currentQueueIndex]);
    } else {
        // Loop back to start
        currentQueueIndex = 0;
        playTrackFromQueue(currentQueue[currentQueueIndex]);
    }
}

function playPreviousTrack() {
    if (currentQueue.length === 0) return;

    // If more than 3 seconds into track, restart it
    if (currentAudio.currentTime > 3) {
        currentAudio.currentTime = 0;
        return;
    }

    if (currentQueueIndex > 0) {
        currentQueueIndex--;
        playTrackFromQueue(currentQueue[currentQueueIndex]);
    } else {
        // Go to last track
        currentQueueIndex = currentQueue.length - 1;
        playTrackFromQueue(currentQueue[currentQueueIndex]);
    }
}

// Progress bar click to seek
progressBar?.addEventListener('click', (e) => {
    if (!currentAudio.src || !currentAudio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    currentAudio.currentTime = percent * currentAudio.duration;
});

function togglePlay() {
    if (!currentAudio.src) return;

    if (isPlaying) {
        currentAudio.pause();
    } else {
        currentAudio.play();
    }
}

function updatePlayButton() {
    if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    }
}

async function playTrack(track, queue = null, queueIndex = -1) {
    currentTrack = track;

    // Set up queue if provided
    if (queue && queue.length > 0) {
        currentQueue = queue;
        currentQueueIndex = queueIndex >= 0 ? queueIndex : queue.findIndex(t => t.id === track.id);
        if (currentQueueIndex === -1) currentQueueIndex = 0;

        // If shuffle is enabled, save original and shuffle the queue
        if (isShuffleEnabled) {
            originalQueue = [...currentQueue];
            shuffleQueue();
        }
    }

    // Check if downloaded first
    // Check for download FIRST, regardless of track object state (which might be stale)
    let playedFromDownload = false;
    try {
        const result = await window.electronAPI.getDownloadPath(track.id);
        if (result.success && result.filePath) {
            currentAudio.src = `file://${result.filePath}`;
            playedFromDownload = true;
        }
    } catch (error) {
        console.error('Error checking download path:', error);
    }

    if (!playedFromDownload) {
        if (track.preview_url) {
            currentAudio.src = track.preview_url;
        } else {
            // Check if it's currently downloading
            if (activeDownloads.has(track.id)) {
                showToast('Track is still downloading, please wait...', 'info');
            } else {
                showToast('No preview available for this track', 'warning');
            }
            return;
        }
    }

    // Update UI - handle missing properties gracefully
    npTitle.textContent = track.name || 'Unknown Track';
    npArtist.textContent = track.artistNames || track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';

    const imageUrl = track.album?.images?.[0]?.url || track.thumbnailUrl || '';
    if (imageUrl) {
        npImage.style.backgroundImage = `url('${imageUrl}')`;
    } else {
        npImage.style.backgroundImage = 'none';
    }

    // Update time total
    if (timeTotal) {
        timeTotal.textContent = track.duration || '0:00';
    }

    currentAudio.play();
}

// Play a track from the current queue without modifying it
async function playTrackFromQueue(track) {
    currentTrack = track;

    // Check if downloaded first
    // Check for download FIRST, regardless of track object state (which might be stale)
    let playedFromDownload = false;
    try {
        const result = await window.electronAPI.getDownloadPath(track.id);
        if (result.success && result.filePath) {
            currentAudio.src = `file://${result.filePath}`;
            playedFromDownload = true;
        }
    } catch (error) {
        console.error('Error checking download path:', error);
    }

    if (!playedFromDownload) {
        if (track.preview_url) {
            currentAudio.src = track.preview_url;
        } else {
            // Check if it's currently downloading
            if (activeDownloads.has(track.id)) {
                showToast('Track is still downloading, please wait...', 'info');
            } else {
                showToast('No preview available for this track', 'warning');
            }
            return;
        }
    }

    // Update UI
    npTitle.textContent = track.name || 'Unknown Track';
    npArtist.textContent = track.artistNames || track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';

    const imageUrl = track.album?.images?.[0]?.url || track.thumbnailUrl || '';
    if (imageUrl) {
        npImage.style.backgroundImage = `url('${imageUrl}')`;
    } else {
        npImage.style.backgroundImage = 'none';
    }

    if (timeTotal) {
        timeTotal.textContent = track.duration || '0:00';
    }

    currentAudio.play();
}

// Set the queue without playing
function setQueue(tracks, startIndex = 0) {
    currentQueue = tracks;
    currentQueueIndex = startIndex;
}

// Audio Events
currentAudio.addEventListener('play', () => {
    isPlaying = true;
    updatePlayButton();
});

currentAudio.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayButton();
});

currentAudio.addEventListener('ended', () => {
    isPlaying = false;
    updatePlayButton();
    progressFill.style.width = '0%';
    timeCurrent.textContent = '0:00';

    // Handle loop modes
    if (loopMode === 'one') {
        // Repeat current track
        currentAudio.currentTime = 0;
        currentAudio.play();
        return;
    }

    // Auto-play next track if in queue
    if (currentQueue.length > 0) {
        if (currentQueueIndex < currentQueue.length - 1) {
            // More tracks in queue
            playNextTrack();
        } else if (loopMode === 'all') {
            // At end of queue with repeat-all enabled, go back to start
            currentQueueIndex = 0;
            playTrackFromQueue(currentQueue[currentQueueIndex]);
        }
        // If loopMode is 'off' and at end, just stop (do nothing)
    }
});

currentAudio.addEventListener('timeupdate', () => {
    if (currentAudio.duration) {
        const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
        progressFill.style.width = `${progress}%`;
        timeCurrent.textContent = formatTime(currentAudio.currentTime);
    }
});

currentAudio.addEventListener('loadedmetadata', () => {
    if (timeTotal && currentAudio.duration) {
        timeTotal.textContent = formatTime(currentAudio.duration);
    }
});

// ==================== VOLUME CONTROL ====================
const volumeSlider = document.querySelector('.volume-slider');
const volumeFill = document.querySelector('.volume-fill');
const volumeIcon = document.querySelector('.volume-controls svg');

let currentVolume = 0.8; // Default 80%
currentAudio.volume = currentVolume;

// Update volume fill on load
if (volumeFill) {
    volumeFill.style.width = `${currentVolume * 100}%`;
}

// Volume slider click
volumeSlider?.addEventListener('click', (e) => {
    const rect = volumeSlider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(percent);
});

// Volume slider drag
let isDraggingVolume = false;

volumeSlider?.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    const rect = volumeSlider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(percent);
});

document.addEventListener('mousemove', (e) => {
    if (!isDraggingVolume || !volumeSlider) return;
    const rect = volumeSlider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(percent);
});

document.addEventListener('mouseup', () => {
    isDraggingVolume = false;
});

// Click on volume icon to mute/unmute
let previousVolume = currentVolume;
volumeIcon?.parentElement?.addEventListener('click', (e) => {
    // Don't trigger on slider click or miniplayer button click
    if (e.target.closest('.volume-slider')) return;
    if (e.target.closest('#miniplayer-btn')) return;

    if (currentVolume > 0) {
        previousVolume = currentVolume;
        setVolume(0);
    } else {
        setVolume(previousVolume || 0.5);
    }
});

function setVolume(percent) {
    currentVolume = percent;
    currentAudio.volume = percent;

    if (volumeFill) {
        volumeFill.style.width = `${percent * 100}%`;
    }

    updateVolumeIcon();
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

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
        error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
        warning: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
        info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== NAVIGATION ====================
const navHome = document.getElementById('nav-home');
const navLibrary = document.getElementById('nav-library');
const navSettings = document.getElementById('nav-settings');
const homeView = document.getElementById('home-view');
const libraryView = document.getElementById('library-view');
const settingsView = document.getElementById('settings-view');

function switchView(viewName) {
    // Update nav
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    // Update views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active');
        view.classList.add('hidden');
    });

    if (viewName === 'home') {
        navHome?.classList.add('active');
        homeView?.classList.remove('hidden');
        homeView?.classList.add('active');
    } else if (viewName === 'library') {
        navLibrary?.classList.add('active');
        libraryView?.classList.remove('hidden');
        libraryView?.classList.add('active');

        // Always reset to grid view when clicking library nav
        if (playlistDetailView && playlistGridView) {
            playlistDetailView.classList.add('hidden');
            playlistGridView.classList.remove('hidden');
            currentPlaylistId = null;
        }

        renderLibrary();
    } else if (viewName === 'settings') {
        navSettings?.classList.add('active');
        settingsView?.classList.remove('hidden');
        settingsView?.classList.add('active');

        // Load current credentials when switching to settings
        loadSpotifyCredentials();
    }
}

navHome?.addEventListener('click', () => switchView('home'));
navLibrary?.addEventListener('click', () => switchView('library'));
navSettings?.addEventListener('click', () => switchView('settings'));

// ==================== LIBRARY VIEW ====================
const playlistGrid = document.getElementById('playlist-grid');
const playlistGridView = document.getElementById('playlist-grid-view');
const playlistDetailView = document.getElementById('playlist-detail-view');
const playlistTracks = document.getElementById('playlist-tracks');
const createPlaylistBtn = document.getElementById('create-playlist-btn');
const backToLibraryBtn = document.getElementById('back-to-library-btn');
const deletePlaylistBtn = document.getElementById('delete-playlist-btn');
const playPlaylistBtn = document.getElementById('play-playlist-btn');

let currentPlaylistId = null;
let currentPlaylistTracks = [];

async function renderLibrary() {
    await loadPlaylists();

    if (!playlistGrid) return;

    // Sort playlists: Downloads -> Liked Songs -> Alphabetical
    playlists.sort((a, b) => {
        if (a.id === 'downloads') return -2;
        if (b.id === 'downloads') return 2;
        if (a.id === 'liked-songs') return -1;
        if (b.id === 'liked-songs') return 1;
        return a.name.localeCompare(b.name);
    });

    if (playlists.length === 0) {
        playlistGrid.innerHTML = `
            <div class="library-empty col-span-full">
                <svg class="library-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                </svg>
                <h3>No playlists yet</h3>
                <p>Create your first playlist to start organizing your music</p>
            </div>
        `;
        return;
    }

    playlistGrid.innerHTML = playlists.map(playlist => createPlaylistCard(playlist)).join('');

    // Add event listeners
    playlistGrid.querySelectorAll('.playlist-card').forEach(card => {
        card.addEventListener('click', () => {
            const playlistId = card.dataset.playlistId;
            openPlaylistDetail(playlistId);
        });
    });
}

function createPlaylistCard(playlist) {
    const isLikedSongs = playlist.id === 'liked-songs';
    const isDownloads = playlist.id === 'downloads';
    const trackCount = playlist.trackCount || playlist.tracks?.length || 0;

    // Get cover image from first track if available
    let coverImage = '';

    if (playlist.customCover) {
        // Use custom cover if available (use file:// protocol for local files)
        const src = playlist.customCover.startsWith('http') ? playlist.customCover : `file://${playlist.customCover}`;
        coverImage = `<img src="${src}" alt="${playlist.name}" class="w-full h-full object-cover">`;
    } else if (isDownloads) {
        coverImage = `
            <div class="w-full h-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
                <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
            </div>
        `;
    } else if (playlist.firstTrackImage) {
        coverImage = `<img src="${playlist.firstTrackImage}" alt="${playlist.name}" class="w-full h-full object-cover">`;
    } else {
        coverImage = `
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${isLikedSongs ?
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>' :
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>'
            }
            </svg>
        `;
    }

    return `
        <div class="playlist-card ${isLikedSongs ? 'liked-songs' : ''}" data-playlist-id="${playlist.id}">
            <div class="playlist-card-cover">
                ${coverImage}
            </div>
            <div class="playlist-card-name">${playlist.name}</div>
            <div class="playlist-card-info">${trackCount} ${trackCount === 1 ? 'song' : 'songs'}</div>
            <button class="play-hover">
                <svg class="w-6 h-6 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </button>
        </div>
    `;
}

async function openPlaylistDetail(playlistId) {
    currentPlaylistId = playlistId;
    const isDownloads = playlistId === 'downloads';

    // Immediate UI update to prevent ghosting
    playlistGridView.classList.add('hidden');
    playlistDetailView.classList.remove('hidden');

    // Set loading state
    document.getElementById('playlist-detail-title').textContent = 'Loading...';
    document.getElementById('playlist-detail-count').textContent = '...';
    const cover = document.getElementById('playlist-cover');
    cover.innerHTML = '<div class="w-full h-full bg-surface-light animate-pulse rounded-lg"></div>';
    if (playlistTracks) {
        playlistTracks.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-text-muted">
                <div class="loading-spinner mb-2"></div>
                <span>Loading tracks...</span>
            </div>
        `;
    }

    try {
        let playlist;
        const result = await window.electronAPI.getPlaylist(playlistId);

        if (!result.success || !result.playlist) {
            showToast('Playlist not found', 'error');
            return;
        }
        playlist = result.playlist;

        currentPlaylistTracks = playlist.tracks || [];

        // Update header
        document.getElementById('playlist-detail-title').textContent = playlist.name;
        document.getElementById('playlist-detail-count').textContent =
            `${currentPlaylistTracks.length} ${currentPlaylistTracks.length === 1 ? 'song' : 'songs'}`;

        // Update cover
        // Determine cover content
        let coverContent = '';
        if (playlist.customCover) {
            const src = playlist.customCover.startsWith('http') ? playlist.customCover : `file://${playlist.customCover}`;
            coverContent = `<img src="${src}" class="w-full h-full object-cover rounded-lg">`;
        } else if (isDownloads) {
            coverContent = `
                <div class="w-full h-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
                    <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                </div>
            `;
        } else if (currentPlaylistTracks.length > 0 && currentPlaylistTracks[0].album?.images?.[0]?.url) {
            coverContent = `<img src="${currentPlaylistTracks[0].album.images[0].url}" class="w-full h-full object-cover rounded-lg">`;
        } else {
            const isLikedSongs = playlistId === 'liked-songs';
            coverContent = `
                <div class="w-full h-full ${isLikedSongs ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500' : 'bg-surface-light'} flex items-center justify-center">
                    <svg class="w-12 h-12 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${isLikedSongs ?
                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>' :
                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>'
                }
                    </svg>
                </div>
            `;
        }

        // Add hover overlay for editing (except for default system playlists if preferred, but allowing for now)
        // Disabling for Liked Songs and Downloads to preserve app theme
        const canEditCover = !isDownloads && playlistId !== 'liked-songs';

        // Professional edit overlay
        cover.innerHTML = `
            <div class="relative w-full h-full group rounded-lg overflow-hidden shadow-xl">
                ${coverContent}
                ${canEditCover ? `
                    <div id="edit-cover-btn" class="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer">
                        <div class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2 border border-white/20 hover:scale-110 hover:bg-white/20 transition-all">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </div>
                        <span class="text-white text-sm font-medium tracking-wide">Change Cover</span>
                    </div>
                ` : ''}
            </div>
        `;

        if (canEditCover) {
            document.getElementById('edit-cover-btn').addEventListener('click', () => handleSetCover(playlist.id));
        }

        // Hide delete button for liked songs and downloads
        if (playlistId === 'liked-songs' || isDownloads) {
            deletePlaylistBtn.classList.add('hidden');
        } else {
            deletePlaylistBtn.classList.remove('hidden');
        }

        // Render tracks
        renderPlaylistTracks(currentPlaylistTracks);

        // Show detail view
        playlistGridView.classList.add('hidden');
        playlistDetailView.classList.remove('hidden');

    } catch (error) {
        console.error('Error opening playlist:', error);
        showToast('Failed to load playlist', 'error');
    }
}

function renderPlaylistTracks(tracks) {
    if (!playlistTracks) return;

    if (tracks.length === 0) {
        playlistTracks.innerHTML = `
            <div class="library-empty">
                <svg class="library-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                </svg>
                <h3>No songs yet</h3>
                <p>Search for songs and add them to this playlist</p>
            </div>
        `;
        return;
    }

    playlistTracks.innerHTML = tracks.map((track, index) => createTrackRow(track, index)).join('');

    // Add event listeners
    playlistTracks.querySelectorAll('.track-row').forEach((row, index) => {
        row.addEventListener('click', () => {
            // Pass the full playlist as the queue
            playTrack(tracks[index], tracks, index);
        });

        // Context Menu
        row.addEventListener('contextmenu', (e) => {
            showContextMenu(e, tracks[index]);
        });

        // Remove from playlist button
        row.querySelector('.remove-track-btn')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            await removeTrackFromCurrentPlaylist(tracks[index].id);
        });
    });
}

function createTrackRow(track, index) {
    // Handle cover art - check album images first, then top-level thumbnail
    let imageUrl = '';
    if (track.album?.images?.length > 0) {
        imageUrl = track.album.images[0].url;
    } else if (track.thumbnailUrl) {
        imageUrl = track.thumbnailUrl;
    }

    // Handle duration - format ms if string not provided
    let duration = track.duration || '0:00';
    if (!track.duration && track.duration_ms) {
        const totalSeconds = Math.floor(track.duration_ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    return `
        <div class="track-row" data-track-id="${track.id}">
            <span class="track-row-number">${index + 1}</span>
            <button class="track-row-play text-white">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </button>
            <div class="track-row-image">
                ${imageUrl ? `<img src="${imageUrl}" alt="${track.name}">` : ''}
            </div>
            <div class="track-row-info">
                <div class="track-row-title">${track.name}</div>
                <div class="track-row-artist">${track.artistNames || track.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}</div>
            </div>
            <span class="track-row-duration">${duration}</span>
            <div class="track-row-actions">
                <button class="remove-track-btn text-red-500" title="Remove from playlist">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

async function removeTrackFromCurrentPlaylist(trackId) {
    if (currentPlaylistId === 'downloads') {
        const confirmed = await showConfirmDialog(
            'Delete Download',
            'Are you sure you want to delete this download? This action cannot be undone.',
            'Delete',
            'Cancel',
            'danger'
        );

        if (!confirmed) return;

        try {
            const result = await window.electronAPI.deleteDownload(trackId);
            if (result.success) {
                currentPlaylistTracks = currentPlaylistTracks.filter(t => t.id !== trackId);
                renderPlaylistTracks(currentPlaylistTracks);
                document.getElementById('playlist-detail-count').textContent =
                    `${currentPlaylistTracks.length} ${currentPlaylistTracks.length === 1 ? 'song' : 'songs'}`;
                showToast('Download deleted', 'success');
            } else {
                showToast(result.message || 'Failed to delete download', 'error');
            }
        } catch (error) {
            console.error('Error deleting download:', error);
            showToast('Failed to delete download', 'error');
        }
        return;
    }

    try {
        const result = await window.electronAPI.removeFromPlaylist(currentPlaylistId, trackId);
        if (result.success) {
            currentPlaylistTracks = currentPlaylistTracks.filter(t => t.id !== trackId);
            renderPlaylistTracks(currentPlaylistTracks);
            document.getElementById('playlist-detail-count').textContent =
                `${currentPlaylistTracks.length} ${currentPlaylistTracks.length === 1 ? 'song' : 'songs'}`;
            showToast('Removed from playlist', 'success');
            loadPlaylists(); // Refresh sidebar
        }
    } catch (error) {
        console.error('Error removing track:', error);
        showToast('Failed to remove track', 'error');
    }
}

// Back to library grid
backToLibraryBtn?.addEventListener('click', () => {
    playlistDetailView.classList.add('hidden');
    playlistGridView.classList.remove('hidden');
    currentPlaylistId = null;
    renderLibrary();
});

// Delete playlist
deletePlaylistBtn?.addEventListener('click', async () => {
    if (!currentPlaylistId || currentPlaylistId === 'liked-songs') return;

    const confirmed = await showConfirmDialog(
        'Delete Playlist',
        'Are you sure you want to delete this playlist? This action cannot be undone.',
        'Delete',
        'Cancel',
        'danger'
    );

    if (confirmed) {
        try {
            const result = await window.electronAPI.deletePlaylist(currentPlaylistId);
            if (result.success) {
                showToast('Playlist deleted', 'success');
                playlistDetailView.classList.add('hidden');
                playlistGridView.classList.remove('hidden');
                currentPlaylistId = null;
                await loadPlaylists();
                renderLibrary();
            }
        } catch (error) {
            console.error('Error deleting playlist:', error);
            showToast('Failed to delete playlist', 'error');
        }
    }
});

// Play entire playlist
playPlaylistBtn?.addEventListener('click', () => {
    if (currentPlaylistTracks.length > 0) {
        // Set the queue and play from the first track
        playTrack(currentPlaylistTracks[0], currentPlaylistTracks, 0);
        showToast(`Playing ${currentPlaylistTracks.length} songs`, 'info');
    }
});

// Create new playlist button
createPlaylistBtn?.addEventListener('click', () => {
    showCreatePlaylistModal();
});

function showCreatePlaylistModal() {
    // Remove existing modal
    const existingModal = document.getElementById('create-playlist-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'create-playlist-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create New Playlist</h3>
                <button class="modal-close">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="new-playlist-form">
                    <input type="text" id="create-playlist-name" placeholder="Playlist name" class="modal-input" autofocus>
                    <button id="submit-playlist-btn" class="btn-primary">Create Playlist</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#create-playlist-name');
    const createBtn = modal.querySelector('#submit-playlist-btn');
    const closeBtn = modal.querySelector('.modal-close');

    // Focus input
    setTimeout(() => input.focus(), 50);

    // Event listeners
    closeBtn.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    const handleSubmit = async () => {
        const name = input.value.trim();
        if (name) {
            try {
                const result = await window.electronAPI.createPlaylist(name);
                if (result.success) {
                    showToast(`Created "${name}"`, 'success');
                    await loadPlaylists();
                    modal.remove();

                    // Open the new playlist
                    switchView('library');
                    openPlaylistDetail(result.playlist.id);
                } else {
                    showToast(result.error || 'Failed to create playlist', 'error');
                }
            } catch (error) {
                console.error('Error creating playlist:', error);
                showToast('Failed to create playlist', 'error');
            }
        }
    };

    createBtn.addEventListener('click', handleSubmit);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') modal.remove();
    });
}

async function handleSetCover(playlistId) {
    try {
        const result = await window.electronAPI.setPlaylistCover(playlistId);
        if (result.success) {
            if (result.cancelled) return;
            showToast('Playlist cover updated', 'success');
            await loadPlaylists(); // Refresh grid thumbnails
            openPlaylistDetail(playlistId); // Refresh detail view
        } else {
            showToast(result.error || 'Failed to update cover', 'error');
        }
    } catch (error) {
        console.error('Error setting cover:', error);
        showToast('Failed to update cover', 'error');
    }
}

// ==================== MINIPLAYER INTEGRATION ====================
const miniplayerBtn = document.getElementById('miniplayer-btn');
let isMiniplayerOpen = false;

// Open miniplayer button handler
miniplayerBtn?.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent triggering volume control click

    const isOpen = await window.electronAPI.isMiniplayerOpen();
    if (!isOpen) {
        window.electronAPI.openMiniplayer();
        isMiniplayerOpen = true;
        miniplayerBtn.classList.add('text-accent-primary');
        miniplayerBtn.classList.remove('text-text-muted');
        showToast('Miniplayer opened', 'info');

        // Send initial state after a small delay to ensure miniplayer is ready
        setTimeout(() => {
            sendPlaybackStateToMiniplayer();
        }, 300);
    } else {
        window.electronAPI.closeMiniplayer();
        isMiniplayerOpen = false;
        miniplayerBtn.classList.remove('text-accent-primary');
        miniplayerBtn.classList.add('text-text-muted');
    }
});

// Handle miniplayer closed notification
window.electronAPI.onMiniplayerClosed(() => {
    isMiniplayerOpen = false;
    miniplayerBtn?.classList.remove('text-accent-primary');
    miniplayerBtn?.classList.add('text-text-muted');
});

// Handle miniplayer control commands
window.electronAPI.onMiniplayerControl((action) => {
    // Check if it's a volume command
    if (action.startsWith('volume:')) {
        const volumeValue = parseFloat(action.split(':')[1]);
        if (!isNaN(volumeValue)) {
            setVolume(volumeValue);
        }
        return;
    }

    // Check if it's a play-playlist command
    if (action.startsWith('play-playlist:')) {
        const playlistId = action.split(':')[1];
        playPlaylistFromMiniplayer(playlistId);
        return;
    }

    switch (action) {
        case 'toggle-play':
            togglePlay();
            break;
        case 'prev':
            playPreviousTrack();
            break;
        case 'next':
            playNextTrack();
            break;
        case 'shuffle':
            toggleShuffle();
            sendPlaybackStateToMiniplayer();
            break;
        case 'loop':
            toggleLoop();
            sendPlaybackStateToMiniplayer();
            break;
    }
});

// Play a playlist from miniplayer request
async function playPlaylistFromMiniplayer(playlistId) {
    try {
        const result = await window.electronAPI.getPlaylist(playlistId);
        if (result.success && result.playlist && result.playlist.tracks.length > 0) {
            const tracks = result.playlist.tracks;
            playTrack(tracks[0], tracks, 0);
            showToast(`Playing "${result.playlist.name}"`, 'success');
        } else {
            showToast('Playlist is empty', 'warning');
        }
    } catch (error) {
        console.error('Error playing playlist from miniplayer:', error);
    }
}

// Handle miniplayer seek
window.electronAPI.onMiniplayerSeek((percent) => {
    if (currentAudio.duration) {
        currentAudio.currentTime = percent * currentAudio.duration;
    }
});

// Handle playback state request from miniplayer
window.electronAPI.onRequestPlaybackState(() => {
    sendPlaybackStateToMiniplayer();
});

// Send current playback state to miniplayer
function sendPlaybackStateToMiniplayer() {
    const state = {
        track: currentTrack,
        isPlaying: isPlaying,
        isShuffleEnabled: isShuffleEnabled,
        loopMode: loopMode,
        currentTime: currentAudio.currentTime || 0,
        duration: currentAudio.duration || 0,
        volume: currentVolume
    };
    window.electronAPI.sendPlaybackState(state);
}

// Send progress updates to miniplayer
function sendProgressToMiniplayer() {
    if (!isMiniplayerOpen) return;

    const data = {
        currentTime: currentAudio.currentTime || 0,
        duration: currentAudio.duration || 0
    };
    window.electronAPI.sendProgressUpdate(data);
}

// Hook into existing audio events to sync miniplayer
const originalPlayHandler = currentAudio.onplay;
currentAudio.addEventListener('play', () => {
    sendPlaybackStateToMiniplayer();
});

currentAudio.addEventListener('pause', () => {
    sendPlaybackStateToMiniplayer();
});

// Add timeupdate hook for miniplayer progress
currentAudio.addEventListener('timeupdate', () => {
    sendProgressToMiniplayer();
});

// Check miniplayer status on init
(async () => {
    const isOpen = await window.electronAPI.isMiniplayerOpen();
    isMiniplayerOpen = isOpen;
    if (isOpen) {
        miniplayerBtn?.classList.add('text-accent-primary');
        miniplayerBtn?.classList.remove('text-text-muted');
    }
})();

// ==================== CONFIRMATION DIALOG ====================
function showConfirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'confirm-dialog-overlay';
        modal.id = 'confirm-dialog-modal';

        const iconColor = type === 'danger' ? '#ef4444' : '#f59e0b';
        const iconBg = type === 'danger' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';

        modal.innerHTML = `
            <div class="confirm-dialog-modal">
                <!-- Animated Background Glow -->
                <div class="confirm-dialog-glow" style="background: radial-gradient(circle, ${iconColor}15 0%, transparent 70%);"></div>
                
                <!-- Icon -->
                <div class="confirm-dialog-icon-container">
                    <div class="confirm-dialog-icon-wrapper" style="background: ${iconBg}; border-color: ${iconColor}40;">
                        ${type === 'danger'
                ? `<svg class="confirm-dialog-icon" style="color: ${iconColor};" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                               </svg>`
                : `<svg class="confirm-dialog-icon" style="color: ${iconColor};" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                               </svg>`
            }
                        <div class="confirm-dialog-icon-pulse" style="background: ${iconColor}20;"></div>
                    </div>
                </div>

                <!-- Content -->
                <div class="confirm-dialog-content">
                    <h3 class="confirm-dialog-title">${title}</h3>
                    <p class="confirm-dialog-message">${message}</p>
                </div>

                <!-- Actions -->
                <div class="confirm-dialog-actions">
                    <button id="confirm-dialog-cancel-btn" class="confirm-dialog-btn confirm-dialog-btn-secondary">
                        <span>${cancelText}</span>
                    </button>
                    <button id="confirm-dialog-confirm-btn" class="confirm-dialog-btn confirm-dialog-btn-primary" style="background: linear-gradient(135deg, ${iconColor} 0%, ${type === 'danger' ? '#dc2626' : '#d97706'} 100%);">
                        <span>${confirmText}</span>
                        <div class="confirm-dialog-btn-ripple"></div>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Trigger entrance animations
        requestAnimationFrame(() => {
            modal.classList.add('confirm-dialog-overlay-enter');
            const modalContent = modal.querySelector('.confirm-dialog-modal');
            modalContent.classList.add('confirm-dialog-modal-enter');
        });

        const cancelBtn = document.getElementById('confirm-dialog-cancel-btn');
        const confirmBtn = document.getElementById('confirm-dialog-confirm-btn');

        // Handle keyboard
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                confirmBtn.click();
            }
        };

        document.addEventListener('keydown', handleKeydown);

        // Close modal with exit animation
        const closeModal = (result) => {
            document.removeEventListener('keydown', handleKeydown);
            modal.classList.add('confirm-dialog-overlay-exit');
            const modalContent = modal.querySelector('.confirm-dialog-modal');
            modalContent.classList.add('confirm-dialog-modal-exit');

            setTimeout(() => {
                modal.remove();
                resolve(result);
            }, 300);
        };

        // Ripple effect for buttons
        const createRipple = (e, button) => {
            const ripple = button.querySelector('.confirm-dialog-btn-ripple');
            if (!ripple) return;

            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('confirm-dialog-ripple-active');

            setTimeout(() => {
                ripple.classList.remove('confirm-dialog-ripple-active');
            }, 600);
        };

        cancelBtn.addEventListener('click', (e) => {
            createRipple(e, cancelBtn);
            setTimeout(() => closeModal(false), 100);
        });

        confirmBtn.addEventListener('click', (e) => {
            createRipple(e, confirmBtn);
            setTimeout(() => closeModal(true), 100);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(false);
        });
    });
}

// ==================== YOUTUBE IMPORT ====================
const importYouTubeBtn = document.getElementById('import-youtube-btn');

importYouTubeBtn?.addEventListener('click', () => {
    showYouTubeImportModal();
});

function showYouTubeImportModal() {
    const modal = document.createElement('div');
    modal.className = 'youtube-import-overlay';
    modal.id = 'youtube-import-modal';

    modal.innerHTML = `
        <div class="youtube-import-modal">
            <!-- Animated Background Glow -->
            <div class="youtube-modal-glow"></div>
            
            <!-- Header with Icon Animation -->
            <div class="youtube-modal-header">
                <div class="youtube-icon-container">
                    <div class="youtube-icon-wrapper">
                        <svg class="youtube-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                        </svg>
                        <div class="youtube-icon-shine"></div>
                    </div>
                </div>
                <div class="youtube-modal-title-group">
                    <h3 class="youtube-modal-title">Import from YouTube</h3>
                    <p class="youtube-modal-subtitle">Paste a YouTube link to add music to your library</p>
                </div>
            </div>
            
            <!-- Input Field with Animation -->
            <div class="youtube-input-wrapper">
                <div class="youtube-input-container">
                    <svg class="youtube-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    <input type="text" id="youtube-url-input" 
                        placeholder="https://youtube.com/watch?v=..." 
                        class="youtube-url-input">
                    <div class="youtube-input-glow"></div>
                </div>
            </div>
            
            <!-- Import Status with Progress Animation -->
            <div id="import-status" class="youtube-import-status hidden">
                <div class="youtube-status-content">
                    <div class="youtube-spinner-container">
                        <div class="youtube-spinner">
                            <div class="youtube-spinner-ring"></div>
                            <div class="youtube-spinner-ring"></div>
                            <div class="youtube-spinner-ring"></div>
                        </div>
                    </div>
                    <div class="youtube-progress-content">
                        <p id="import-status-text" class="youtube-status-text">Fetching video info...</p>
                        <div class="youtube-progress-container">
                            <div id="import-progress-bar" class="youtube-progress-bar">
                                <div class="youtube-progress-shimmer"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="youtube-modal-actions">
                <button id="cancel-import-btn" class="youtube-btn youtube-btn-secondary">
                    <span>Cancel</span>
                </button>
                <button id="confirm-import-btn" class="youtube-btn youtube-btn-primary">
                    <svg class="youtube-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                    </svg>
                    <span>Import</span>
                    <div class="youtube-btn-ripple"></div>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Trigger entrance animations
    requestAnimationFrame(() => {
        modal.classList.add('youtube-overlay-enter');
        const modalContent = modal.querySelector('.youtube-import-modal');
        modalContent.classList.add('youtube-modal-enter');
    });

    const urlInput = document.getElementById('youtube-url-input');
    const cancelBtn = document.getElementById('cancel-import-btn');
    const confirmBtn = document.getElementById('confirm-import-btn');
    const importStatus = document.getElementById('import-status');
    const importStatusText = document.getElementById('import-status-text');
    const importProgressBar = document.getElementById('import-progress-bar');

    // Ensure input is selectable and focusable
    if (urlInput) {
        urlInput.style.userSelect = 'text';
        urlInput.style.webkitUserSelect = 'text';
        urlInput.style.MozUserSelect = 'text';
        urlInput.style.cursor = 'text';
        urlInput.setAttribute('tabindex', '0');
        urlInput.readOnly = false;
        urlInput.disabled = false;
    }

    // Focus input with animation delay
    setTimeout(() => {
        if (urlInput) {
            urlInput.focus();
            // Also try to select any existing text
            if (urlInput.value) {
                urlInput.select();
            }
        }
    }, 400);

    // Close modal with exit animation
    const closeModal = () => {
        modal.classList.add('youtube-overlay-exit');
        const modalContent = modal.querySelector('.youtube-import-modal');
        modalContent.classList.add('youtube-modal-exit');

        setTimeout(() => {
            modal.remove();
            window.electronAPI.removeYouTubeImportListener();
        }, 300);
    };

    // Ripple effect for buttons
    const createRipple = (e, button) => {
        const ripple = button.querySelector('.youtube-btn-ripple');
        if (!ripple) return;

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('youtube-ripple-active');

        setTimeout(() => {
            ripple.classList.remove('youtube-ripple-active');
        }, 600);
    };

    cancelBtn.addEventListener('click', (e) => {
        createRipple(e, cancelBtn);
        setTimeout(closeModal, 100);
    });

    confirmBtn.addEventListener('click', (e) => {
        createRipple(e, confirmBtn);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Input animations
    urlInput.addEventListener('focus', () => {
        urlInput.parentElement.classList.add('youtube-input-focused');
    });

    urlInput.addEventListener('blur', () => {
        if (!urlInput.value) {
            urlInput.parentElement.classList.remove('youtube-input-focused');
        }
    });

    // Ensure clicking the container focuses the input
    const inputContainer = urlInput.closest('.youtube-input-container');
    if (inputContainer) {
        inputContainer.addEventListener('click', (e) => {
            // Only focus if clicking on the container itself, not on the input
            if (e.target === inputContainer || e.target.classList.contains('youtube-input-icon')) {
                e.preventDefault();
                e.stopPropagation();
                urlInput.focus();
                urlInput.select();
            }
        }, true); // Use capture phase to ensure we get the event
    }

    // Allow paste on the input
    urlInput.addEventListener('paste', (e) => {
        // Allow default paste behavior
    }, true);

    // Handle import
    const handleImport = async () => {
        const url = urlInput.value.trim();
        if (!url) {
            // Shake animation for empty input
            urlInput.parentElement.classList.add('youtube-input-error');
            setTimeout(() => {
                urlInput.parentElement.classList.remove('youtube-input-error');
            }, 600);
            showToast('Please enter a YouTube URL', 'warning');
            return;
        }

        // Validate URL format
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;
        if (!youtubeRegex.test(url)) {
            urlInput.parentElement.classList.add('youtube-input-error');
            setTimeout(() => {
                urlInput.parentElement.classList.remove('youtube-input-error');
            }, 600);
            showToast('Invalid YouTube URL', 'error');
            return;
        }

        // Show progress with animation
        importStatus.classList.remove('hidden');
        requestAnimationFrame(() => {
            importStatus.classList.add('youtube-status-visible');
        });

        confirmBtn.disabled = true;
        confirmBtn.classList.add('youtube-btn-loading');
        urlInput.disabled = true;
        urlInput.parentElement.classList.add('youtube-input-disabled');

        // Listen for progress updates
        window.electronAPI.onYouTubeImportProgress((progress) => {
            if (progress.status === 'fetching_info') {
                importStatusText.textContent = 'Fetching video info...';
                importProgressBar.style.width = '15%';
                importProgressBar.classList.add('youtube-progress-animate');
            } else if (progress.status === 'downloading') {
                importStatusText.textContent = `Downloading: ${progress.title || 'Track'}`;
                const progressPercent = Math.max(15, Math.min(95, progress.progress));
                importProgressBar.style.width = `${progressPercent}%`;
            } else if (progress.status === 'complete') {
                importStatusText.textContent = 'Import complete!';
                importProgressBar.style.width = '100%';
                importStatus.classList.add('youtube-status-success');
            }
        });

        try {
            const result = await window.electronAPI.importFromYouTube(url);

            if (result.success) {
                // Success animation
                importStatus.classList.add('youtube-status-success');
                setTimeout(() => {
                    showToast(`Imported: ${result.track?.name || 'Track'}`, 'success');
                    closeModal();
                    // Refresh playlists to show the new download
                    loadPlaylists();
                }, 800);
            } else {
                showToast(result.error || 'Import failed', 'error');
                importStatus.classList.remove('youtube-status-visible');
                setTimeout(() => {
                    importStatus.classList.add('hidden');
                }, 300);
                confirmBtn.disabled = false;
                confirmBtn.classList.remove('youtube-btn-loading');
                urlInput.disabled = false;
                urlInput.parentElement.classList.remove('youtube-input-disabled');
            }
        } catch (error) {
            console.error('YouTube import error:', error);
            showToast(error.message || 'Import failed', 'error');
            importStatus.classList.remove('youtube-status-visible');
            setTimeout(() => {
                importStatus.classList.add('hidden');
            }, 300);
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('youtube-btn-loading');
            urlInput.disabled = false;
            urlInput.parentElement.classList.remove('youtube-input-disabled');
        }
    };

    confirmBtn.addEventListener('click', handleImport);
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleImport();
        if (e.key === 'Escape') closeModal();
    });
}


// ==================== CONTEXT MENU ====================
const contextMenu = document.getElementById('context-menu');
const ctxTrackName = document.getElementById('ctx-track-name');
const ctxArtistName = document.getElementById('ctx-artist-name');
const ctxLikeBtn = document.getElementById('ctx-like-btn');
const ctxLikeIcon = document.getElementById('ctx-like-icon');
const ctxLikeText = document.getElementById('ctx-like-text');
const ctxAddToPlaylistBtn = document.getElementById('ctx-add-to-playlist-btn');
const ctxRemoveBtn = document.getElementById('ctx-remove-btn');

let contextMenuTrack = null;

// Only close if clicking strictly OUTSIDE the menu
document.addEventListener('mousedown', (e) => {
    if (contextMenu && !contextMenu.classList.contains('hidden') && !contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

function hideContextMenu() {
    if (!contextMenu) return;
    contextMenu.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        contextMenu.classList.add('hidden');
    }, 100);
}

function showContextMenu(e, track) {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation immediately
    contextMenuTrack = track;

    // Update menu content
    if (ctxTrackName) ctxTrackName.textContent = track.name;
    if (ctxArtistName) ctxArtistName.textContent = track.artistNames || track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';

    // Update Like button state
    const isLiked = track.isLiked;
    if (ctxLikeIcon && ctxLikeText) {
        if (isLiked) {
            ctxLikeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>';
            ctxLikeIcon.classList.add('text-accent-primary', 'fill-current');
            ctxLikeText.textContent = 'Remove from Liked Songs';
        } else {
            ctxLikeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>';
            ctxLikeIcon.classList.remove('text-accent-primary', 'fill-current');
            ctxLikeText.textContent = 'Save to Liked Songs';
        }
    }

    // Show/Hide Remove button based on context
    if (ctxRemoveBtn) {
        if (currentPlaylistId && currentPlaylistId !== 'liked-songs' && currentPlaylistId !== 'downloads') {
            ctxRemoveBtn.classList.remove('hidden');
            // Try to get playlist name from header
            const playlistNameEl = document.getElementById('playlist-detail-name');
            const playlistName = playlistNameEl ? playlistNameEl.textContent : 'this Playlist';
            // Update the text content of the button (keeping the icon svg)
            const textNode = Array.from(ctxRemoveBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (textNode) {
                textNode.textContent = `Remove from ${playlistName}`;
            } else {
                // If text node not found, just append/set text safely without killing svg
                ctxRemoveBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Remove from ${playlistName}
                `;
            }
        } else {
            ctxRemoveBtn.classList.add('hidden');
        }
    }

    // Position menu
    const menuWidth = 220;
    const menuHeight = 200;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;

    contextMenu.classList.remove('hidden');
    // Force reflow
    void contextMenu.offsetWidth;
    contextMenu.classList.remove('opacity-0', 'scale-95');
}

ctxLikeBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (contextMenuTrack) {
        try {
            const result = await window.electronAPI.toggleLike(contextMenuTrack);
            if (result.success) {
                contextMenuTrack.isLiked = result.liked;
                if (currentPlaylistId === 'liked-songs' && !result.liked) {
                    await removeTrackFromCurrentPlaylist(contextMenuTrack.id);
                } else if (currentPlaylistId === 'liked-songs' && result.liked) {
                    loadPlaylists();
                }
                showToast(result.liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'success');
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
        hideContextMenu();
    }
});

ctxAddToPlaylistBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (contextMenuTrack) {
        showPlaylistModal(contextMenuTrack);
        hideContextMenu();
    }
});

ctxRemoveBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (contextMenuTrack && currentPlaylistId) {
        await removeTrackFromCurrentPlaylist(contextMenuTrack.id);
        hideContextMenu();
    }
});

// ==================== SETTINGS LOGIC ====================
const spotifyClientIdInput = document.getElementById('spotify-client-id');
const spotifyClientSecretInput = document.getElementById('spotify-client-secret');
const toggleSecretVisibilityBtn = document.getElementById('toggle-secret-visibility');
const eyeIcon = document.getElementById('eye-icon');
const eyeOffIcon = document.getElementById('eye-off-icon');
const validateCredentialsBtn = document.getElementById('validate-credentials-btn');
const saveCredentialsBtn = document.getElementById('save-credentials-btn');
const clearCredentialsBtn = document.getElementById('clear-credentials-btn');
const statusBadge = document.getElementById('status-badge');
const validationMessage = document.getElementById('validation-message');

let isSecretVisible = false;

// Toggle password visibility
toggleSecretVisibilityBtn?.addEventListener('click', () => {
    isSecretVisible = !isSecretVisible;
    spotifyClientSecretInput.type = isSecretVisible ? 'text' : 'password';
    eyeIcon?.classList.toggle('hidden', isSecretVisible);
    eyeOffIcon?.classList.toggle('hidden', !isSecretVisible);
});

// Load current credentials
async function loadSpotifyCredentials() {
    try {
        const result = await window.electronAPI.getSpotifyCredentials();
        if (result.success) {
            if (result.hasCredentials) {
                spotifyClientIdInput.value = result.clientId;
                spotifyClientSecretInput.value = '';
                spotifyClientSecretInput.placeholder = result.clientSecretMasked || 'Current secret saved (enter new to change)';
                updateStatusBadge('configured');
            } else {
                spotifyClientIdInput.value = '';
                spotifyClientSecretInput.value = '';
                spotifyClientSecretInput.placeholder = 'e.g., AbC123dEf456gHi789...';
                updateStatusBadge('not-configured');
            }
        }
    } catch (error) {
        console.error('Error loading credentials:', error);
        showValidationMessage('error', 'Failed to load credentials');
    }
}

// Update status badge
function updateStatusBadge(status) {
    if (!statusBadge) return;

    if (status === 'configured') {
        statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400';
        statusBadge.textContent = 'Configured';
    } else if (status === 'not-configured') {
        statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400';
        statusBadge.textContent = 'Not Configured';
    } else if (status === 'validated') {
        statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400';
        statusBadge.textContent = '✓ Validated';
    }
}

// Show validation message
function showValidationMessage(type, message) {
    if (!validationMessage) return;

    validationMessage.classList.remove('hidden');

    if (type === 'success') {
        validationMessage.className = 'px-4 py-3 rounded-lg text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30';
    } else if (type === 'error') {
        validationMessage.className = 'px-4 py-3 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30';
    } else if (type === 'info') {
        validationMessage.className = 'px-4 py-3 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30';
    }

    validationMessage.innerHTML = `
        <div class="flex items-center gap-2">
            ${type === 'success' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : ''}
            ${type === 'error' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' : ''}
            ${type === 'info' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' : ''}
            <span>${message}</span>
        </div>
    `;

    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            validationMessage.classList.add('hidden');
        }, 5000);
    }
}

// Hide validation message
function hideValidationMessage() {
    if (validationMessage) {
        validationMessage.classList.add('hidden');
    }
}

// Validate credentials
validateCredentialsBtn?.addEventListener('click', async () => {
    const clientId = spotifyClientIdInput?.value.trim();
    const clientSecret = spotifyClientSecretInput?.value.trim();

    if (!clientId) {
        showValidationMessage('error', 'Please enter your Client ID');
        return;
    }

    if (!clientSecret) {
        showValidationMessage('error', 'Please enter your Client Secret to validate');
        return;
    }

    // Show loading state
    validateCredentialsBtn.disabled = true;
    validateCredentialsBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Validating...
    `;

    try {
        const result = await window.electronAPI.validateSpotifyCredentials(clientId, clientSecret);

        if (result.success && result.valid) {
            showValidationMessage('success', 'Credentials are valid! You can now save them.');
            updateStatusBadge('validated');
        } else {
            showValidationMessage('error', result.error || 'Invalid credentials. Please check your Client ID and Secret.');
        }
    } catch (error) {
        console.error('Validation error:', error);
        showValidationMessage('error', 'Failed to validate credentials. Check your internet connection.');
    } finally {
        validateCredentialsBtn.disabled = false;
        validateCredentialsBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Validate
        `;
    }
});

// Save credentials
saveCredentialsBtn?.addEventListener('click', async () => {
    const clientId = spotifyClientIdInput?.value.trim();
    const clientSecret = spotifyClientSecretInput?.value.trim();

    if (!clientId) {
        showValidationMessage('error', 'Please enter your Client ID');
        return;
    }

    if (!clientSecret) {
        // Check if we have existing credentials and user only wants to update ID
        const existing = await window.electronAPI.getSpotifyCredentials();
        if (!existing.hasCredentials) {
            showValidationMessage('error', 'Please enter your Client Secret');
            return;
        }
        showValidationMessage('info', 'Leave Client Secret empty to keep the existing secret, or enter a new one to update it.');
        return;
    }

    // Show loading state
    saveCredentialsBtn.disabled = true;
    saveCredentialsBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Saving...
    `;

    try {
        const result = await window.electronAPI.saveSpotifyCredentials(clientId, clientSecret);

        if (result.success) {
            showValidationMessage('success', 'Credentials saved successfully! The app is now ready to use.');
            updateStatusBadge('configured');
            showToast('Spotify credentials saved', 'success');

            // Update placeholder to show masked secret
            spotifyClientSecretInput.value = '';
            spotifyClientSecretInput.placeholder = clientSecret.slice(0, 4) + '••••••••' + clientSecret.slice(-4);
        } else {
            showValidationMessage('error', result.error || 'Failed to save credentials');
        }
    } catch (error) {
        console.error('Save error:', error);
        showValidationMessage('error', 'Failed to save credentials');
    } finally {
        saveCredentialsBtn.disabled = false;
        saveCredentialsBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
            </svg>
            Save Credentials
        `;
    }
});

// Clear credentials
clearCredentialsBtn?.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog(
        'Clear Credentials',
        'Are you sure you want to clear your Spotify credentials? You will need to re-enter them to use Riff.',
        'Clear',
        'Cancel',
        'warning'
    );

    if (confirmed) {
        try {
            const result = await window.electronAPI.clearSpotifyCredentials();

            if (result.success) {
                spotifyClientIdInput.value = '';
                spotifyClientSecretInput.value = '';
                spotifyClientSecretInput.placeholder = 'e.g., AbC123dEf456gHi789...';
                updateStatusBadge('not-configured');
                hideValidationMessage();
                showToast('Credentials cleared', 'info');
            } else {
                showValidationMessage('error', 'Failed to clear credentials');
            }
        } catch (error) {
            console.error('Clear error:', error);
            showValidationMessage('error', 'Failed to clear credentials');
        }
    }
});

// Check for credentials on startup and show settings if not configured
(async () => {
    try {
        const result = await window.electronAPI.hasSpotifyCredentials();
        if (result.success && !result.hasCredentials) {
            // No credentials configured, show a gentle prompt
            setTimeout(() => {
                showToast('Configure your Spotify credentials in Settings to get started', 'info');
            }, 1500);
        }
    } catch (error) {
        console.error('Error checking credentials:', error);
    }
})();

console.log('Riff renderer initialized');

