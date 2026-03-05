require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const rateRoutes = require('./routes/rateRoutes');
const cricketRoutes = require('./routes/cricketRoutes');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// API Routes
app.use('/api', rateRoutes);
app.use('/api', cricketRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        mongo: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

const { scrapeRates } = require('./services/scraperService');
const { scrapeCricket } = require('./services/cricketService');

app.listen(PORT, () => {
    console.log(`Backend Server running on http://localhost:${PORT}`);

    // Periodic refresh (every 5 minutes for Cricket, every 15 for Rates)
    setInterval(() => {
        console.log('Background Sync: Fetching Cricket...');
        scrapeCricket().catch(e => console.log('Auto Sync Cricket failed:', e.message));
    }, 5 * 60 * 1000);

    setInterval(() => {
        console.log('Background Sync: Fetching Rates...');
        scrapeRates().catch(e => console.log('Auto Sync Rates failed:', e.message));
    }, 15 * 60 * 1000);

    // Initial Sync
    scrapeCricket().catch(e => console.log('Initial Cricket Sync failed:', e.message));
});
