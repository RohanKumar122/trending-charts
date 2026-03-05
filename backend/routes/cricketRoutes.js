const express = require('express');
const router = express.Router();
const Cricket = require('../models/Cricket');
const { scrapeCricket } = require('../services/cricketService');

router.get('/cricket-scores', async (req, res) => {
    try {
        let cachedData = await Cricket.findOne().sort({ timestamp: -1 });

        if (cachedData) {
            // Refresh if older than 1 minute (for live sports)
            const ageInMs = new Date() - new Date(cachedData.timestamp);
            if (ageInMs > 1 * 60 * 1000) {
                console.log('Cricket cache stale, refreshing...');
                try {
                    const freshData = await scrapeCricket();
                    return res.json({ ...freshData, source: 'live' });
                } catch (e) {
                    console.log('Cricket scrape failed, returning old cache');
                    return res.json({ ...cachedData.toObject(), source: 'cache_stale' });
                }
            }

            return res.json({
                ...cachedData.toObject(),
                source: 'cache'
            });
        } else {
            const freshData = await scrapeCricket();
            res.json({ ...freshData, source: 'live' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
