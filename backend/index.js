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
        gold22K: String
    },
    silver: {
        silverPerGram: String,
        silverPerKg: String
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

            const format = (num) => {
                if (!num) return null;
                const rounded = Math.round(parseFloat(num.toString().replace(/[^\d.]/g, '')));
                return `₹${rounded.toLocaleString('en-IN')}`;
            };

            return {
                gold24K: format(g24),
                gold22K: format(g22)
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

            const format = (num) => {
                if (!num) return null;
                const rounded = Math.round(parseFloat(num.toString().replace(/[^\d.]/g, '')));
                return `₹${rounded.toLocaleString('en-IN')}`;
            };

            const numKg = kg ? parseFloat(kg.toString().replace(/[^\d.]/g, '')) : 0;
            return {
                silverPerGram: numKg ? `₹${(numKg / 1000).toFixed(2)}` : null,
                silverPerKg: format(kg)
            };
        });

        const finalData = { gold: goldData, silver: silverData };

        // Save to MongoDB
        await Rate.create(finalData);
        console.log('Successfully scraped and cached new rates');

        return finalData;
    } catch (err) {
        console.error('Scraping error:', err);
        throw err;
    } finally {
        if (browser) await browser.close();
    }
}

app.get('/api/rates', async (req, res) => {
    try {
        // 1. Get the latest cached data from MongoDB
        const cachedData = await Rate.findOne().sort({ timestamp: -1 });

        // 2. Return cached data immediately if exists
        if (cachedData) {
            res.json({
                gold: cachedData.gold,
                silver: cachedData.silver,
                timestamp: cachedData.timestamp,
                source: 'cache'
            });

            // 3. Trigger background refresh if data is older than 5 minutes
            const ageInMs = new Date() - new Date(cachedData.timestamp);
            if (ageInMs > 5 * 60 * 1000) {
                console.log('Data is stale, triggering background refresh...');
                scrapeRates().catch(e => console.error('Background refresh failed:', e));
            }
        } else {
            // No data at all, must wait for first scrape
            const freshData = await scrapeRates();
            res.json({ ...freshData, source: 'live', timestamp: new Date() });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', mongo: mongoose.connection.readyState === 1 });
});

app.listen(PORT, () => console.log(`Backend Server running on http://localhost:${PORT}`));
