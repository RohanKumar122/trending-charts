require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
let puppeteer;
let chromium;

if (process.env.VERCEL) {
    puppeteer = require('puppeteer-core');
    chromium = require('@sparticuz/chromium');
} else {
    puppeteer = require('puppeteer-core');
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const GOLD_URL = process.env.GOLD_URL || 'https://groww.in/gold-rates';
const SILVER_URL = process.env.SILVER_URL || 'https://groww.in/silver-rates';
const MONGODB_URI = process.env.MONGODB_URI;

// MongoDB Setup
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const rateSchema = new mongoose.Schema({
    gold: {
        gold24K: String,
        gold22K: String,
        num24K: Number, // Storing raw numbers for charts
        num22K: Number
    },
    silver: {
        silverPerGram: String,
        silverPerKg: String,
        numGram: Number, // Storing raw numbers for charts
        numKg: Number
    },
    timestamp: { type: Date, default: Date.now }
});

const Rate = mongoose.model('Rate', rateSchema);

async function scrapeRates() {
    console.log('--- Starting Meta Scraping Cycle ---');

    let browser;
    try {
        if (process.env.VERCEL) {
            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
                ignoreHTTPSErrors: true,
            });
        } else {
            const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            browser = await puppeteer.launch({
                executablePath: executablePath,
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
            });
        }
        const page = await browser.newPage();

        // 1. GOLD
        await page.goto(GOLD_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        const goldData = await page.evaluate(() => {
            let g24 = null, g22 = null;
            try {
                const nextData = document.getElementById('__NEXT_DATA__');
                if (nextData) {
                    const data = JSON.parse(nextData.innerText);
                    const recursiveSearch = (obj) => {
                        if (!obj || typeof obj !== 'object') return;
                        if (obj.twentyFourCaratTenGram && !g24) g24 = obj.twentyFourCaratTenGram;
                        if (obj.twentyTwoCaratTenGram && !g22) g22 = obj.twentyTwoCaratTenGram;
                        if (obj.spotPrice && !g24) g24 = obj.spotPrice;
                        if (obj.TWENTY_TWO && !g22) g22 = obj.TWENTY_TWO * 10;
                        if (g24 && g22) return;
                        Object.values(obj).forEach(recursiveSearch);
                    };
                    recursiveSearch(data);
                }
            } catch (e) { }

            const parseNum = (val) => {
                if (!val) return 0;
                return Math.round(parseFloat(val.toString().replace(/[^\d.]/g, '')));
            };

            const num24 = parseNum(g24);
            const num22 = parseNum(g22);

            return {
                gold24K: `₹${num24.toLocaleString('en-IN')}`,
                gold22K: `₹${num22.toLocaleString('en-IN')}`,
                num24K: num24,
                num22K: num22
            };
        });

        // 2. SILVER
        await page.goto(SILVER_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000));

        const silverData = await page.evaluate(() => {
            let kg = null;
            try {
                const nextData = document.getElementById('__NEXT_DATA__');
                if (nextData) {
                    const data = JSON.parse(nextData.innerText);
                    const recursiveSearch = (obj) => {
                        if (!obj || typeof obj !== 'object') return;
                        if (obj.spotPrice && !kg) kg = obj.spotPrice;
                        if (kg) return;
                        Object.values(obj).forEach(recursiveSearch);
                    };
                    recursiveSearch(data);
                }
            } catch (e) { }

            const parseNum = (val) => {
                if (!val) return 0;
                return Math.round(parseFloat(val.toString().replace(/[^\d.]/g, '')));
            };

            const numKg = parseNum(kg);
            const numGram = parseFloat((numKg / 1000).toFixed(2));

            return {
                silverPerGram: numGram ? `₹${numGram}` : null,
                silverPerKg: `₹${numKg.toLocaleString('en-IN')}`,
                numGram: numGram,
                numKg: numKg
            };
        });

        // --- Analysis Logic: Check if we should insert a new record ---
        // We only want to "append" if it's a new day or if the price changed significantly.
        // For a simple chart, appending every time is fine, but to keep it clean:
        const lastRate = await mongoose.model('Rate').findOne().sort({ timestamp: -1 });

        let shouldInsert = true;
        if (lastRate) {
            const isSameDay = new Date(lastRate.timestamp).toDateString() === new Date().toDateString();
            const samePrices = lastRate.gold.num24K === goldData.num24K && lastRate.silver.numKg === silverData.numKg;

            // If it's the same day and prices haven't changed, we can skip OR just update the timestamp.
            // But the user wants to "append", so we insert if it's a new day OR if price changed.
            if (isSameDay && samePrices) {
                console.log('Price same as last cache today. Skipping duplicate append.');
                shouldInsert = false;
            }
        }

        if (shouldInsert) {
            await Rate.create({ gold: goldData, silver: silverData });
            console.log('Successfully appended new rates to history');
        }

        return { gold: goldData, silver: silverData };
    } catch (err) {
        console.error('Scraping error:', err);
        throw err;
    } finally {
        if (browser) await browser.close();
    }
}

app.get('/api/rates', async (req, res) => {
    try {
        const cachedData = await Rate.findOne().sort({ timestamp: -1 });

        if (cachedData) {
            res.json({
                gold: cachedData.gold,
                silver: cachedData.silver,
                timestamp: cachedData.timestamp,
                source: 'cache'
            });

            const ageInMs = new Date() - new Date(cachedData.timestamp);
            if (ageInMs > 5 * 60 * 1000) {
                scrapeRates().catch(e => console.error('Background refresh failed:', e));
            }
        } else {
            const freshData = await scrapeRates();
            res.json({ ...freshData, source: 'live', timestamp: new Date() });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// New Endpoint for Chart Data
app.get('/api/history', async (req, res) => {
    try {
        // Get last 30 days of data for the chart
        const history = await Rate.find().sort({ timestamp: 1 }).limit(100);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', mongo: mongoose.connection.readyState === 1 });
});

app.listen(PORT, () => console.log(`Backend Server running on http://localhost:${PORT}`));
