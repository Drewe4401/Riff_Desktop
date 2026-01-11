const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class SettingsManager {
    constructor() {
        this.settingsPath = null;
        this.settings = {
            spotifyClientId: '',
            spotifyClientSecret: ''
        };
    }

    initialize() {
        this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
        this.loadSettings();
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const data = fs.readFileSync(this.settingsPath, 'utf8');
                const loaded = JSON.parse(data);
                this.settings = { ...this.settings, ...loaded };
                console.log('Settings loaded successfully');
            } else {
                console.log('No settings file found, using defaults');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    saveSettings() {
        try {
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
            console.log('Settings saved successfully');
            return { success: true };
        } catch (error) {
            console.error('Error saving settings:', error);
            return { success: false, error: error.message };
        }
    }

    getSettings() {
        return { ...this.settings };
    }

    setSpotifyCredentials(clientId, clientSecret) {
        this.settings.spotifyClientId = clientId;
        this.settings.spotifyClientSecret = clientSecret;
        return this.saveSettings();
    }

    getSpotifyCredentials() {
        return {
            clientId: this.settings.spotifyClientId,
            clientSecret: this.settings.spotifyClientSecret
        };
    }

    hasSpotifyCredentials() {
        return !!(this.settings.spotifyClientId && this.settings.spotifyClientSecret);
    }

    clearSpotifyCredentials() {
        this.settings.spotifyClientId = '';
        this.settings.spotifyClientSecret = '';
        return this.saveSettings();
    }
}

module.exports = new SettingsManager();
