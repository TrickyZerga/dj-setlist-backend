// server.js - Simple backend for DJ Setlist app
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false
}));

// Handle preflight requests
app.options('*', cors());

// Configure multer for file uploads
const upload = multer({
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit (increased)
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'DJ Setlist Backend is running!',
        timestamp: new Date().toISOString(),
        cors: 'enabled'
    });
});

// Music recognition endpoint
app.post('/recognize', upload.single('audio'), async (req, res) => {
    // Set CORS headers explicitly
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    console.log('Received recognition request');
    console.log('Request headers:', req.headers);
    console.log('File received:', req.file ? 'Yes' : 'No');
    
    try {
        if (!req.file) {
            console.log('No audio file in request');
            return res.status(400).json({ 
                success: false,
                error: 'No audio file provided' 
            });
        }

        console.log('Audio file size:', req.file.size, 'bytes');
        console.log('Audio file type:', req.file.mimetype);
        console.log('Audio file fieldname:', req.file.fieldname);

        // Prepare form data for AudioTag.info API
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: 'audio.wav',
            contentType: req.file.mimetype || 'audio/wav'
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
        console.log('AudioTag API response headers:', Object.fromEntries(response.headers));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AudioTag API error:', errorText);
            
            return res.json({
                success: false,
                message: `AudioTag API error: ${response.status}`,
                debug: errorText
            });
        }

        const result = await response.json();
        console.log('AudioTag API response:', JSON.stringify(result, null, 2));

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
                track: trackInfo,
                debug: {
                    audioSize: req.file.size,
                    apiResponse: result
                }
            });
        } else {
            console.log('No track recognized');
            res.json({
                success: false,
                message: 'No track recognized',
                debug: {
                    audioSize: req.file.size,
                    apiResponse: result
                }
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