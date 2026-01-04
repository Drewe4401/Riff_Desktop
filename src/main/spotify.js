const https = require('https');
require('dotenv').config();

class SpotifyService {
    constructor() {
        // Spotify API Credentials (loaded from .env)
        this.clientId = process.env.SPOTIFY_CLIENT_ID;
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    setCredentials(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    async authenticate() {
        if (!this.clientId || !this.clientSecret) {
            throw new Error('Missing Spotify credentials');
        }

        const authBuffer = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        return new Promise((resolve, reject) => {
            const req = https.request('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authBuffer}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.access_token) {
                            this.accessToken = response.access_token;
                            this.tokenExpiry = Date.now() + (response.expires_in * 1000) - 60000;
                            resolve(this.accessToken);
                        } else {
                            reject(new Error(response.error_description || 'Authentication failed'));
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse authentication response'));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.write('grant_type=client_credentials');
            req.end();
        });
    }

    async ensureAuthenticated() {
        if (!this.accessToken || Date.now() > this.tokenExpiry) {
            await this.authenticate();
        }
    }

    async search(query, type = 'track', limit = 30, offset = 0) {
        await this.ensureAuthenticated();

        return new Promise((resolve, reject) => {
            const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}&offset=${offset}`;

            const req = https.request(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            resolve(response);
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse search response'));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.end();
        });
    }

    async getTrack(trackId) {
        await this.ensureAuthenticated();

        return new Promise((resolve, reject) => {
            const url = `https://api.spotify.com/v1/tracks/${trackId}`;

            const req = https.request(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            resolve(response);
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse track response'));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.end();
        });
    }

    async getArtist(artistId) {
        await this.ensureAuthenticated();

        return new Promise((resolve, reject) => {
            const url = `https://api.spotify.com/v1/artists/${artistId}`;

            const req = https.request(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            resolve(response);
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse artist response'));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.end();
        });
    }

    // Format track data for frontend
    formatTrack(track) {
        return {
            id: track.id,
            name: track.name,
            artists: track.artists.map(a => ({ id: a.id, name: a.name })),
            artistNames: track.artists.map(a => a.name).join(', '),
            album: {
                id: track.album.id,
                name: track.album.name,
                images: track.album.images
            },
            duration_ms: track.duration_ms,
            duration: this.formatDuration(track.duration_ms),
            preview_url: track.preview_url,
            external_url: track.external_urls?.spotify,
            popularity: track.popularity,
            explicit: track.explicit
        };
    }

    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

module.exports = new SpotifyService();
