// server.js - Simple backend for DJ Setlist app
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all origins (adjust for production)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Configure multer for file uploads
const upload = multer({
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'DJ Setlist Backend is running!',
        timestamp: new Date().toISOString()
    });
});

// Music recognition endpoint
app.post('/recognize', upload.single('audio'), async (req, res) => {
    console.log('Received recognition request');
    
    try {
        if (!req.file) {
            return res.status(400).json({ 
                error: 'No audio file provided' 
            });
        }

        console.log('Audio file size:', req.file.size, 'bytes');
        console.log('Audio file type:', req.file.mimetype);

        // Prepare form data for AudioTag.info API
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: 'audio.wav',
            contentType: req.file.mimetype
        });
        formData.append('api_token', '3ff9922a7a958b1fd4fce9a5aa2b262d');

        console.log('Sending request to AudioTag.info API...');

        // Call AudioTag.info API
        const response = await fetch('https://audiotag.info/api', {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });

        console.log('AudioTag API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AudioTag API error:', errorText);
            throw new Error(`AudioTag API failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('AudioTag API response:', result);

        // Parse the response and extract track info
        let trackInfo = null;

        // Try different response formats from AudioTag.info
        if (result && result.data && result.data.length > 0) {
            const track = result.data[0];
            trackInfo = {
                title: track.title || track.song,
                artist: track.artist || track.performer,
                confidence: track.confidence || 0,
                source: 'audiotag'
            };
        } else if (result && result.result && result.result.length > 0) {
            const track = result.result[0];
            trackInfo = {
                title: track.title,
                artist: track.artist,
                confidence: track.confidence || 0,
                source: 'audiotag'
            };
        } else if (result && result.title && result.artist) {
            trackInfo = {
                title: result.title,
                artist: result.artist,
                confidence: result.confidence || 0,
                source: 'audiotag'
            };
        }

        if (trackInfo && trackInfo.title && trackInfo.artist) {
            console.log('Successfully recognized:', trackInfo);
            res.json({
                success: true,
                track: trackInfo
            });
        } else {
            console.log('No track recognized');
            res.json({
                success: false,
                message: 'No track recognized'
            });
        }

    } catch (error) {
        console.error('Recognition error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to recognize audio'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

app.listen(port, () => {
    console.log(`DJ Setlist backend running on port ${port}`);
});

module.exports = app;