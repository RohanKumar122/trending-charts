const express = require('express');
const router = express.Router();
const Rate = require('../models/Rate');
const { scrapeRates } = require('../services/scraperService');

// Get latest rates with caching
router.get('/rates', async (req, res) => {
    try {
        const cachedData = await Rate.findOne().sort({ timestamp: -1 });

        if (cachedData) {
            // Check if data is stale (> 15 minutes)
            const ageInMs = new Date() - new Date(cachedData.timestamp);
            if (ageInMs > 15 * 60 * 1000) {
                console.log('Rate cache stale (>15m), refreshing in background...');
                scrapeRates().catch(e => console.log('Background rate refresh failed', e.message));
            }

            return res.json({
                ...cachedData.toObject(),
                source: 'cache'
            });
        } else {
            const freshData = await scrapeRates();
            res.json({ ...freshData, source: 'live' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get historical data for charts
router.get('/history', async (req, res) => {
    try {
        const history = await Rate.find().sort({ timestamp: 1 }).limit(100);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
