const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

const GOLD_URL = process.env.GOLD_URL || 'https://groww.in/gold-rates';
const SILVER_URL = process.env.SILVER_URL || 'https://groww.in/silver-rates';

async function scrapeRates() {
    console.log('--- Starting Meta Scraping (Ultra-Fast) ---');

    try {
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

module.exports = { scrapeRates };
