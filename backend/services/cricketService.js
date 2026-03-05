const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
const Cricket = require('../models/Cricket');

const CRICKET_URL = 'https://www.cricbuzz.com/cricket-match/live-scores';

async function scrapeCricket() {
    console.log('--- Starting Cricket Robust Scraping ---');
    try {
        const res = await axios.get(CRICKET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        const html = res.data;
        const matches = [];
        const seenIds = new Set();

        // Find all matchIds appearing in the raw HTML/payload
        const idRegex = /matchId\\\":(\d+)/g;
        let idMatch;

        while ((idMatch = idRegex.exec(html)) !== null) {
            const id = idMatch[1];
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            // Pull a large enough chunk to contain match details and scores
            const segment = html.substring(idMatch.index, idMatch.index + 8000);

            // Helper to clean and extract fields
            const clean = (s) => (s || '').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
            const extract = (regex, index = 1) => {
                const m = segment.match(regex);
                return m ? clean(m[index]) : '';
            };

            const series = extract(/seriesName\\\":\\\"(.*?)\\\"/);
            const desc = extract(/matchDesc\\\":\\\"(.*?)\\\"/);
            const status = extract(/status\\\":\\\"(.*?)\\\"/);
            const stateRaw = extract(/state\\\":\\\"(.*?)\\\"/);
            const team1 = extract(/team1\\\":\{[\s\S]*?teamName\\\":\\\"(.*?)\\\"/);
            const team2 = extract(/team2\\\":\{[\s\S]*?teamName\\\":\\\"(.*?)\\\"/);

            if (!series || !team1 || !team2) continue;

            const extractScore = (label) => {
                const sReg = new RegExp(`${label}\\\\?\":\\{[\\s\\S]*?runs\\\\?\":(\\d+).*?wickets\\\\?\":(\\d+)`);
                const oReg = new RegExp(`${label}\\\\?\":\\{[\\s\\S]*?overs\\\\?\":\\\\?\"?([\\d.]+)\\\\?\"?`);

                const sMatch = segment.match(sReg);
                const oMatch = segment.match(oReg);

                if (!sMatch) return '';
                const base = `${sMatch[1]}/${sMatch[2]}`;
                return oMatch ? `${base} (${oMatch[1]})` : base;
            };

            const s1 = extractScore('team1Score');
            const s2 = extractScore('team2Score');

            // Map state to frontend types (Live, Preview, Complete)
            let mappedState = 'Live';
            if (stateRaw === 'Preview' || status.toLowerCase().includes('match starts')) mappedState = 'Preview';
            else if (stateRaw === 'Complete' || status.toLowerCase().includes('won by')) mappedState = 'Complete';
            else if (stateRaw === 'Stumps' || stateRaw === 'Innings Break' || stateRaw === 'Tea' || stateRaw === 'Lunch') mappedState = 'Live';

            let displayS1 = s1;
            let displayS2 = s2;
            if (mappedState === 'Live') {
                if (!displayS1) displayS1 = 'Yet to Bat';
                if (!displayS2) displayS2 = 'Yet to Bat';
            }

            matches.push({
                matchId: id,
                seriesName: series,
                matchDesc: desc,
                status: status,
                team1: { name: team1, score: displayS1 },
                team2: { name: team2, score: displayS2 },
                state: mappedState
            });
        }

        // Filter and Sort: Prioritize Live > Complete > Preview
        const sortedMatches = matches.sort((a, b) => {
            const states = { 'Live': 0, 'Complete': 1, 'Preview': 2 };
            return (states[a.state] ?? 1) - (states[b.state] ?? 1);
        });

        const now = new Date();
        const istTime = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        const finalData = {
            matches: sortedMatches,
            timestamp: now,
            istTimestamp: istTime,
            count: sortedMatches.length
        };

        // Save to file (fallback)
        try {
            fs.writeFileSync('./cricket_scores.json', JSON.stringify(finalData, null, 2));
        } catch (fsErr) {
            // Ignore write errors in serverless environments
        }

        // CRITICAL FIX: Only update DB if we found at least one match with a score OR enough matches
        // This prevents overwriting with an empty list if the scrape is blocked.
        const matchesWithScores = sortedMatches.filter(m => m.team1.score && m.team1.score !== 'Yet to Bat').length;

        if (sortedMatches.length > 3 || matchesWithScores > 0) {
            console.log(`Updating MongoDB with ${sortedMatches.length} matches...`);
            await Cricket.deleteMany({});
            await Cricket.create(finalData);
            console.log('MongoDB Update Successful');
        } else {
            console.log('--- WARNING: Poor scrap results. Skipping DB update. ---');
        }

        return finalData;
    } catch (err) {
        console.error('Cricket Scraping Error:', err.message);
        throw err;
    }
}

module.exports = { scrapeCricket };
