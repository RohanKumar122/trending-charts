const express = require('express');
const router = express.Router();
const Cricket = require('../models/Cricket');
const { scrapeCricket } = require('../services/cricketService');

router.get('/cricket-scores', async (req, res) => {
    try {
        let cachedData = await Cricket.findOne().sort({ timestamp: -1 });

        if (cachedData && cachedData.matches && cachedData.matches.length > 0) {
            const ageInMs = new Date() - new Date(cachedData.timestamp);

            // If data is very stale (> 5 mins), try to refresh but FALL BACK to cache on failure
            if (ageInMs > 5 * 60 * 1000) {
                console.log('Cricket cache VERY stale, attempting live refresh...');
                try {
                    const freshData = await scrapeCricket();
                    return res.json({ ...freshData, source: 'live' });
                } catch (scrapeErr) {
                    console.warn('Live scrape failed, serving stale cache as fallback:', scrapeErr.message);
                    return res.json({ ...cachedData.toObject(), source: 'stale' });
                }
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
        console.error('Cricket route error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
