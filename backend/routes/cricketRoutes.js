const express = require('express');
const router = express.Router();
const Cricket = require('../models/Cricket');
const { scrapeCricket } = require('../services/cricketService');

router.get('/cricket-scores', async (req, res) => {
    try {
        let cachedData = await Cricket.findOne().sort({ timestamp: -1 });

        if (cachedData && cachedData.matches && cachedData.matches.length > 0) {
            const ageInMs = new Date() - new Date(cachedData.timestamp);

            // If data is very stale (> 5 mins), wait for fresh data
            if (ageInMs > 5 * 60 * 1000) {
                console.log('Cricket cache VERY stale, waiting for fresh data...');
                const freshData = await scrapeCricket();
                return res.json({ ...freshData, source: 'live' });
            }

            // If data is slightly stale (> 1 min), refresh in background
            if (ageInMs > 1 * 60 * 1000) {
                console.log('Cricket cache slightly stale, refreshing in background...');
                scrapeCricket().catch(e => console.log('Background cricket scrape failed', e.message));
            }

            return res.json({
                ...cachedData.toObject(),
                source: 'cache'
            });
        } else {
            console.log('No cricket cache found, fetching live...');
            const freshData = await scrapeCricket();
            res.json({ ...freshData, source: 'live' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
