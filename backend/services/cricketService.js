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


        // This regex is very specific to the Next.js chunked format we saw in the logs
        const matchRegex = /matchId\\\":(\d+),.*?seriesName\\\":\\\"(.*?)\\\",.*?matchDesc\\\":\\\"(.*?)\\\",.*?status\\\":\\\"(.*?)\\\",.*?team1\\\":\{.*?teamName\\\":\\\"(.*?)\\\".*?team2\\\":\{.*?teamName\\\":\\\"(.*?)\\\"/g;

        let match;
        while ((match = matchRegex.exec(html)) !== null) {
            const [full, id, series, desc, status, t1, t2] = match;

            // NEW: Bound the segment to only THIS match object to prevent picking up the next match's score
            const nextMatchIdx = html.indexOf('matchId', match.index + 20);
            const segmentEnd = nextMatchIdx > -1 ? nextMatchIdx : match.index + 3000;
            const segment = html.substring(match.index, segmentEnd);

            // Try to find the score in the same escaped format
            const scoreRegex = /matchScore\\\":\{.*?team1Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+),.*?overs\\\":\\\"([\d.]+)\\\".*?team2Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+),.*?overs\\\":\\\"([\d.]+)\\\"/;
            const scoreMatch = segment.match(scoreRegex);

            let s1 = '', s2 = '';
            let state = 'Preview';

            if (scoreMatch) {
                s1 = `${scoreMatch[1]}/${scoreMatch[2]} (${scoreMatch[3]})`;
                s2 = `${scoreMatch[4]}/${scoreMatch[5]} (${scoreMatch[6]})`;
                state = 'Live';
            } else {
                // Try simpler score check
                const s1m = segment.match(/team1Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+)/);
                const s2m = segment.match(/team2Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+)/);
                if (s1m) s1 = `${s1m[1]}/${s1m[2]}`;
                if (s2m) s2 = `${s2m[1]}/${s2m[2]}`;
                if (s1m || s2m) state = 'Live';
            }

            if (!matches.some(m => String(m.matchId) === String(id))) {
                // Cleaning up escaped double quotes properly
                const clean = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

                // If match is Live but score is empty, it means they haven't started batting
                let displayS1 = s1;
                let displayS2 = s2;

                if (state === 'Live') {
                    if (!displayS1) displayS1 = 'Yet to Bat';
                    if (!displayS2) displayS2 = 'Yet to Bat';
                }

                matches.push({
                    matchId: id,
                    seriesName: clean(series),
                    matchDesc: clean(desc),
                    status: clean(status),
                    team1: { name: clean(t1), score: displayS1 },
                    team2: { name: clean(t2), score: displayS2 },
                    state: state
                });
            }
        }

        // Filter and Sort: Prioritize Live > Complete > Preview
        // Also remove previews that are too far in the future if we have enough live data
        const sortedMatches = matches.sort((a, b) => {
            const states = { 'Live': 0, 'Complete': 1, 'Preview': 2 };
            return states[a.state] - states[b.state];
        });

        const now = new Date();
        const istTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        const finalData = {
            matches: sortedMatches,
            timestamp: now,
            istTimestamp: istTime,
            count: sortedMatches.length
        };

        // Save to file as fallback/log (non-fatal — production may have read-only FS)
        try {
            fs.writeFileSync('./cricket_scores.json', JSON.stringify(finalData, null, 2));
        } catch (fsErr) {
            console.warn('Could not write cricket_scores.json (likely read-only FS in production):', fsErr.message);
        }

        // CRITICAL FIX: Only update DB if we found matches!
        if (sortedMatches.length > 0) {
            console.log(`Updating MongoDB with ${sortedMatches.length} matches...`);
            await Cricket.deleteMany({});
            await Cricket.create(finalData);
            console.log('MongoDB Update Successful');
        } else {
            console.log('--- WARNING: No matches found during scrap. Skipping DB update to preserve cache. ---');
        }

        return finalData;
    } catch (err) {
        console.error('Cricket Scraping Error:', err.message);
        throw err;
    }
}

module.exports = { scrapeCricket };
