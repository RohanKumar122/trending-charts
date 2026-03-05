const express = require('express');
const router = express.Router();
const Cricket = require('../models/Cricket');
const { scrapeCricket } = require('../services/cricketService');

router.get('/cricket-scores', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        let cachedData = await Cricket.findOne().sort({ timestamp: -1 });

        if (cachedData && cachedData.matches && cachedData.matches.length > 0 && !forceRefresh) {
            const ageInMs = new Date() - new Date(cachedData.timestamp);
            const isLiveMatchPresent = cachedData.matches.some(m => m.state === 'Live');

            // For Live matches, be much more aggressive (stale after 1 min)
            const staleThreshold = isLiveMatchPresent ? 1 * 60 * 1000 : 5 * 60 * 1000;

            if (ageInMs > staleThreshold) {
                console.log(`Cricket cache stale (${Math.round(ageInMs / 1000)}s), fetching fresh scores...`);
                try {
                    const freshData = await scrapeCricket();
                    return res.json({ ...freshData, source: 'live' });
                } catch (scrapeErr) {
                    console.warn('Live refresh failed, serving stale cache:', scrapeErr.message);
                    return res.json({ ...cachedData.toObject(), source: 'stale' });
                }
            }

            return res.json({
                ...cachedData.toObject(),
                source: 'cache'
            });
        } else {
            console.log(forceRefresh ? 'Force refresh requested...' : 'No cricket cache, fetching live...');
            const freshData = await scrapeCricket();
            res.json({ ...freshData, source: 'live' });
        }
    } catch (err) {
        console.error('Cricket route error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
