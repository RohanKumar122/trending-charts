const { scrapeRates } = require('./services/scraperService');
const mongoose = require('mongoose');
const Rate = require('./models/Rate');
require('dotenv').config({ path: './.env' });

async function test() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        console.log('Fetching last record from DB...');
        const last = await Rate.findOne().sort({ timestamp: -1 });
        if (last) {
            console.log('Last Record:', {
                time: last.timestamp,
                gold24K: last.gold.gold24K,
                silverKg: last.silver.silverPerKg
            });
        } else {
            console.log('No records in DB.');
        }

        console.log('Starting Scrape...');
        const data = await scrapeRates();
        console.log('Scraped Data:', JSON.stringify(data, null, 2));

        const countAfter = await Rate.countDocuments();
        console.log('Total Records in DB:', countAfter);

        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

test();
