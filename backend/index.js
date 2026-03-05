require('dotenv').config();
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const GOLD_URL = process.env.GOLD_URL || 'https://groww.in/gold-rates';
const SILVER_URL = process.env.SILVER_URL || 'https://groww.in/silver-rates';

async function scrapeRates() {
    console.log('--- Starting Meta Scraping Cycle ---');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });
    const page = await browser.newPage();

    try {
        // --- 1. GOLD SCRAPING ---
        await page.goto(GOLD_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for page hydration
        await new Promise(r => setTimeout(r, 3000));

        const goldData = await page.evaluate(() => {
            let g24 = null, g22 = null;

            // Strategy A: JSON Extraction (Most Accurate)
            try {
                const nextData = document.getElementById('__NEXT_DATA__');
                if (nextData) {
                    const data = JSON.parse(nextData.innerText);

                    const recursiveSearch = (obj) => {
                        if (!obj || typeof obj !== 'object') return;

                        // Look for raw numeric values in the state
                        if (obj.twentyFourCaratTenGram && !g24) g24 = obj.twentyFourCaratTenGram;
                        if (obj.twentyTwoCaratTenGram && !g22) g22 = obj.twentyTwoCaratTenGram;

                        // Fallback keys found in Groww's state
                        if (obj.spotPrice && !g24) g24 = obj.spotPrice;
                        if (obj.TWENTY_TWO && !g22) g22 = obj.TWENTY_TWO * 10;

                        if (g24 && g22) return;
                        Object.values(obj).forEach(recursiveSearch);
                    };
                    recursiveSearch(data);
                }
            } catch (e) { }

            // Format found numbers as integers
            const format = (num) => {
                if (!num) return null;
                const rounded = Math.round(parseFloat(num.toString().replace(/[^\d.]/g, '')));
                return `₹${rounded.toLocaleString('en-IN')}`;
            };

            // Strategy B: Table Fallback
            if (!g24 || !g22) {
                const rows = Array.from(document.querySelectorAll('table tr'));
                rows.forEach(r => {
                    const txt = r.innerText.toUpperCase();
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const val = cells[1].innerText.trim();
                        if (val.includes('₹') && !val.includes('₹0')) {
                            if (txt.includes('24K') || txt.includes('24 CARAT')) g24 = g24 || val;
                            if (txt.includes('22K') || txt.includes('22 CARAT')) g22 = g22 || val;
                        }
                    }
                });
            }

            return {
                gold24K: typeof g24 === 'number' ? format(g24) : g24,
                gold22K: typeof g22 === 'number' ? format(g22) : g22
            };
        });
        console.log('Gold Rates:', goldData);

        // --- 2. SILVER SCRAPING ---
        await page.goto(SILVER_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000));

        const silverData = await page.evaluate(() => {
            let gram = null, kg = null;

            // JSON Extraction
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

            // Table Fallback
            const rows = Array.from(document.querySelectorAll('table tr'));
            rows.forEach(r => {
                const txt = r.innerText;
                const cells = r.querySelectorAll('td');
                if (cells.length >= 2) {
                    const val = cells[1].innerText.trim();
                    if (txt.includes('1 KG') || txt.includes('1 kg')) kg = kg || val;
                    if (txt.includes('1 Gram')) gram = gram || val;
                }
            });

            if (kg) {
                const numKg = parseFloat(kg.toString().replace(/[^\d.]/g, ''));
                if (!gram) gram = `₹${(numKg / 1000).toFixed(2)}`;
                kg = format(kg);
            }

            return { silverPerGram: gram, silverPerKg: kg };
        });
        console.log('Silver Rates:', silverData);

        return { gold: goldData, silver: silverData };
    } finally {
        await browser.close();
        console.log('--- Scraping Cycle Finished ---');
    }
}

app.get('/api/rates', async (req, res) => {
    try {
        const data = await scrapeRates();
        res.json({ ...data, timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Backend Server running on http://localhost:${PORT}`));
