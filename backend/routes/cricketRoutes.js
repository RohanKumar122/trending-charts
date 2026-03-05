const express = require('express');
const router = express.Router();
const Cricket = require('../models/Cricket');
const { scrapeCricket } = require('../services/cricketService');

router.get('/cricket-scores', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        let cachedData = await Cricket.findOne().sort({ timestamp: -1 });

        if (cachedData && !forceRefresh) {
            const ageInMs = new Date() - new Date(cachedData.timestamp);
            if (ageInMs > 1 * 60 * 1000) {
                console.log('Cricket cache stale, refreshing in background...');
                // Background refresh, don't await
                scrapeCricket().catch(e => console.log('Background cricket scrape failed', e.message));
            }

            return res.json({
                ...cachedData.toObject(),
                source: 'cache'
            });
        } else {
            console.log(forceRefresh ? 'Forced cricket refresh requested...' : 'No cricket cache, scraping...');
            const freshData = await scrapeCricket();
            res.json({ ...freshData, source: 'live' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
