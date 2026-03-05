require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const GOLD_URL = process.env.GOLD_URL || 'https://groww.in/gold-rates';
const SILVER_URL = process.env.SILVER_URL || 'https://groww.in/silver-rates';
const MONGODB_URI = process.env.MONGODB_URI;

// MongoDB Setup
if (!MONGODB_URI) {
    console.error('CRITICAL: MONGODB_URI is not defined.');
} else {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB connection error:', err));
}

const rateSchema = new mongoose.Schema({
    gold: {
        gold24K: String,
        gold22K: String,
        num24K: Number,
        num22K: Number
    },
    silver: {
        silverPerGram: String,
        silverPerKg: String,
        numGram: Number,
        numKg: Number
    },
    timestamp: { type: Date, default: Date.now },
    istTimestamp: String
});

const Rate = mongoose.model('Rate', rateSchema);

// Fast Scraping using axios + cheerio (Perfect for Vercel)
async function scrapeRates() {
    console.log('--- Starting Meta Scraping (Ultra-Fast) ---');

    try {
        // 1. Fetch Gold & Silver HTML in parallel
        const [goldRes, silverRes] = await Promise.all([
            axios.get(GOLD_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            axios.get(SILVER_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        ]);

        const format = (num) => {
            if (!num) return null;
            const rounded = Math.round(parseFloat(num.toString().replace(/[^\d.]/g, '')));
            return `₹${rounded.toLocaleString('en-IN')}`;
        };

        const parseNum = (val) => {
            if (!val) return 0;
            return Math.round(parseFloat(val.toString().replace(/[^\d.]/g, '')));
        };

        const extractFromJson = (html) => {
            const $ = cheerio.load(html);
            const script = $('#__NEXT_DATA__').html();
            if (!script) return {};
            const data = JSON.parse(script);

            let result = {};
            const search = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                if (obj.twentyFourCaratTenGram && !result.g24) result.g24 = obj.twentyFourCaratTenGram;
                if (obj.twentyTwoCaratTenGram && !result.g22) result.g22 = obj.twentyTwoCaratTenGram;
                if (obj.spotPrice && !result.spot) result.spot = obj.spotPrice;
                if (obj.TWENTY_TWO && !result.t22) result.t22 = obj.TWENTY_TWO * 10;
                if (Object.keys(result).length >= 4) return;
                Object.values(obj).forEach(search);
            };
            search(data);
            return result;
        };

        const goldJson = extractFromJson(goldRes.data);
        const silverJson = extractFromJson(silverRes.data);

        const goldData = {
            gold24K: format(goldJson.g24 || goldJson.spot),
            gold22K: format(goldJson.g22 || goldJson.t22),
            num24K: parseNum(goldJson.g24 || goldJson.spot),
            num22K: parseNum(goldJson.g22 || goldJson.t22)
        };

        const numKg = parseNum(silverJson.spot);
        const numGram = parseFloat((numKg / 1000).toFixed(2));
        const silverData = {
            silverPerGram: `₹${numGram}`,
            silverPerKg: format(numKg),
            numGram: numGram,
            numKg: numKg
        };

        const now = new Date();
        const istTime = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const finalData = {
            gold: goldData,
            silver: silverData,
            timestamp: now,
            istTimestamp: istTime
        };

        // Save to History (Append if new or changed)
        const last = await Rate.findOne().sort({ timestamp: -1 });
        if (!last || last.gold.num24K !== goldData.num24K || last.silver.numKg !== silverData.numKg || new Date(last.timestamp).toDateString() !== now.toDateString()) {
            await Rate.create(finalData);
            console.log('Appended to history.');
        }

        return finalData;
    } catch (err) {
        console.error('Fast Scraping Error:', err.message);
        throw err;
    }
}

app.get('/api/rates', async (req, res) => {
    try {
        const cachedData = await Rate.findOne().sort({ timestamp: -1 });

        if (cachedData) {
            // Check if data is stale (> 5 minutes)
            const ageInMs = new Date() - new Date(cachedData.timestamp);
            if (ageInMs > 5 * 60 * 1000) {
                console.log('Cache stale, refreshing...');
                try {
                    const freshData = await scrapeRates();
                    return res.json({ ...freshData, source: 'live' });
                } catch (e) {
                    console.log('Scrape failed, returning stale cache');
                    return res.json({ ...cachedData.toObject(), source: 'cache_stale' });
                }
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

app.get('/api/history', async (req, res) => {
    try {
        const history = await Rate.find().sort({ timestamp: 1 }).limit(100);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', mongo: mongoose.connection.readyState === 1 });
});

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
